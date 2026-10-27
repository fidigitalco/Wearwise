import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase

from .colors import extract_colors
from .engine.harmony import PairTable
from .engine.recommend import NotEnoughGarments, build_candidates, recommend
from .engine.scoring import score_weather
from .models import Garment, TasteProfile, User


def png(color, size=(80, 80), bg=(250, 250, 250)):
    """A garment-coloured square on a light backdrop, like a flat-lay."""
    img = Image.new('RGB', size, bg)
    img.paste(Image.new('RGB', (size[0] // 2, size[1] // 2), color), (size[0] // 4, size[1] // 4))
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    buf.seek(0)
    return buf


def garment(user, category, color, **kw):
    kw.setdefault('subcategory', '')
    return Garment.objects.create(user=user, category=category, colors=[{'name': color, 'share': 1.0}], **kw)


def ctx(**kw):
    base = {'occasion': 'work', 'today': date(2026, 10, 28), 'season': 'autumn', 'temp_c': 11, 'precip_prob': 0.7}
    base.update(kw)
    return base


class ColorTests(APITestCase):
    def test_flat_lay_navy(self):
        colors, low_light = extract_colors(png((30, 40, 80)))
        self.assertEqual(colors[0]['name'], 'navy')
        self.assertFalse(low_light)

    def test_cutout_alpha_ignores_background(self):
        img = Image.new('RGBA', (60, 60), (0, 0, 0, 0))
        img.paste(Image.new('RGBA', (30, 30), (217, 169, 51, 255)), (15, 15))
        buf = io.BytesIO()
        img.save(buf, 'PNG')
        buf.seek(0)
        colors, _ = extract_colors(buf)
        self.assertEqual([c['name'] for c in colors], ['yellow'])


class EngineTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@example.com', 'pw-12345678')
        self.taste = TasteProfile.objects.create(user=self.user)
        self.pairs = PairTable()

    def closet(self):
        u = self.user
        return [
            garment(u, 'top', 'white', subcategory='shirt', formality=3, warmth=1),
            garment(u, 'top', 'navy', subcategory='sweater', formality=3, warmth=2, surface='knit'),
            garment(u, 'top', 'grey', subcategory='t_shirt', formality=1, warmth=1),
            garment(u, 'bottom', 'beige', subcategory='chinos', formality=3, warmth=2),
            garment(u, 'bottom', 'charcoal', subcategory='trousers', formality=4, warmth=2),
            garment(u, 'shoes', 'brown', subcategory='loafers', formality=3, warmth=0),
            garment(u, 'outerwear', 'yellow', subcategory='rain_jacket', formality=2, warmth=2, rain_ok=True),
            garment(u, 'outerwear', 'camel', subcategory='coat', formality=4, warmth=4),
        ]

    def test_needs_top_and_bottom_or_dress(self):
        with self.assertRaises(NotEnoughGarments):
            build_candidates([garment(self.user, 'top', 'white')], ctx(), __import__('random').Random(0))

    def test_three_distinct_outfits_with_explanations(self):
        res = recommend(self.closet(), ctx(), self.pairs, self.taste, seed=1)
        self.assertEqual(len(res), 3)
        for r in res:
            o = r['outfit']
            self.assertIn('shoes', o)
            self.assertIn('outerwear', o)  # cold and wet: a layer is required
            self.assertTrue(r['explanation'].endswith('.'))
            self.assertGreater(r['scores']['total'], 0)
        keys = [frozenset(g.id for s, g in r['outfit'].items() if s in ('top', 'bottom')) for r in res]
        self.assertEqual(len(set(keys)), 3)

    def test_rain_prefers_rain_jacket(self):
        c = self.closet()
        top, bottom, shoes, rain, coat = c[0], c[3], c[5], c[6], c[7]
        wet = ctx(precip_prob=0.9)
        a = score_weather({'top': top, 'bottom': bottom, 'shoes': shoes, 'outerwear': rain}, 11, 0.9, 'autumn')
        b = score_weather({'top': top, 'bottom': bottom, 'shoes': shoes, 'outerwear': coat}, 11, 0.9, 'autumn')
        self.assertGreater(a, b, wet)

    def test_no_heavy_coat_in_heat(self):
        res = recommend(self.closet(), ctx(temp_c=30, precip_prob=0.0), self.pairs, self.taste, seed=1)
        for r in res:
            self.assertFalse(r['outfit'].get('outerwear') and r['outfit']['outerwear'].warmth > 1)


class ApiFlowTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'Me@Example.com', 'password': 'wardrobe-123'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def add(self, category, rgb, **fields):
        data = {'category': category, 'image': SimpleUploadedFile('g.png', png(rgb).read(), 'image/png')}
        data.update(fields)
        r = self.client.post('/api/garments/', data, format='multipart')
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_login_is_case_insensitive(self):
        self.client.credentials()
        r = self.client.post('/api/auth/login/', {'email': 'me@example.com', 'password': 'wardrobe-123'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_requires_auth(self):
        self.client.credentials()
        self.assertEqual(self.client.get('/api/garments/').status_code, 401)

    def test_upload_detects_color(self):
        g = self.add('top', (30, 40, 80), subcategory='sweater')
        self.assertEqual(g['primary_color'], 'navy')

    def test_rejects_wrong_subcategory(self):
        r = self.client.post('/api/garments/', {'category': 'top', 'subcategory': 'jeans'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_recommend_feedback_wear(self):
        self.add('top', (245, 245, 245), formality='3')
        self.add('top', (30, 40, 80), formality='3')
        self.add('bottom', (215, 195, 160), formality='3')
        self.add('bottom', (60, 62, 66), formality='3')
        self.add('shoes', (110, 70, 40), formality='3')
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 18, 'precip_prob': 0.1}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        outfits = r.data['outfits']
        self.assertTrue(1 <= len(outfits) <= 3)
        first = outfits[0]
        self.assertTrue(first['explanation'])

        r = self.client.post('/api/feedback/', {'outfit': first['id'], 'rank': 1, 'liked': True}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(TasteProfile.objects.get(user__email='me@example.com').weights)

        r = self.client.post(f"/api/outfits/{first['id']}/wear/")
        self.assertEqual(r.status_code, 200)
        stats = self.client.get('/api/stats/').data
        self.assertGreater(stats['worn_last_30_days'], 0)

    def test_not_enough_garments(self):
        r = self.client.post('/api/recommendations/', {'occasion': 'casual', 'temp_c': 20}, format='json')
        self.assertEqual(r.status_code, 422)

    def test_other_users_garments_are_hidden(self):
        g = self.add('top', (30, 40, 80))
        self.client.credentials()
        r = self.client.post('/api/auth/register/', {'email': 'b@example.com', 'password': 'wardrobe-456'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.assertEqual(self.client.get(f"/api/garments/{g['id']}/").status_code, 404)
        r = self.client.post('/api/check-outfit/', {'garment_ids': [g['id']], 'occasion': 'work'}, format='json')
        self.assertEqual(r.status_code, 400)


class LowLightTests(APITestCase):
    def test_dark_frame_is_flagged(self):
        _, low_light = extract_colors(png((30, 40, 80), bg=(25, 25, 28)))
        self.assertTrue(low_light)
