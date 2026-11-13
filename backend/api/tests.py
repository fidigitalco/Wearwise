import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .colors import extract_colors
from .engine.harmony import PairTable
from .engine.recommend import NotEnoughGarments, build_candidates, recommend
from .engine.scoring import score_weather
from .models import Feedback, Garment, Outfit, TasteProfile, User


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
        r = self.client.post('/api/auth/register/', {'email': 'Me@Example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
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
        r = self.client.post('/api/auth/login/', {'email': 'me@example.com', 'password': 'Wardrobe-123'}, format='json')
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
        r = self.client.post('/api/auth/register/', {'email': 'b@example.com', 'password': 'Wardrobe-456', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.assertEqual(self.client.get(f"/api/garments/{g['id']}/").status_code, 404)
        r = self.client.post('/api/check-outfit/', {'garment_ids': [g['id']], 'occasion': 'work'}, format='json')
        self.assertEqual(r.status_code, 400)


class LowLightTests(APITestCase):
    def test_dark_frame_is_flagged(self):
        _, low_light = extract_colors(png((30, 40, 80), bg=(25, 25, 28)))
        self.assertTrue(low_light)


AI_RESULT = {
    'is_garment': True, 'category': 'outerwear', 'subcategory': 'rain_jacket', 'name': 'Yellow rain jacket',
    'colors': [{'name': 'yellow', 'rgb': [217, 169, 51], 'share': 0.9}], 'pattern': 'solid',
    'material': {'value': 'nylon', 'source': 'visual_estimate', 'confidence': 0.6},
    'surface': 'smooth', 'sheen': 'low', 'fit': 'regular', 'formality': 2, 'warmth': 2, 'rain_ok': True,
    'season': ['spring', 'autumn'],
    'attribute_confidence': {'category': 0.95, 'color': 0.9, 'pattern': 0.9, 'material': 0.6},
}


class AiTaggingTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'ai@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def upload(self, **fields):
        data = {'image': SimpleUploadedFile('g.png', png((217, 169, 51)).read(), 'image/png'), **fields}
        return self.client.post('/api/garments/', data, format='multipart')

    def test_photo_only_is_filled_in_by_ai(self):
        from unittest import mock
        with mock.patch('api.views.analyse_garment', return_value=dict(AI_RESULT)):
            r = self.upload()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['category'], 'outerwear')
        self.assertEqual(r.data['name'], 'Yellow rain jacket')
        self.assertTrue(r.data['rain_ok'])
        self.assertEqual(r.data['material']['source'], 'visual_estimate')
        self.assertEqual(r.data['attribute_confidence']['material'], 0.6)

    def test_what_the_user_sent_wins_over_ai(self):
        from unittest import mock
        with mock.patch('api.views.analyse_garment', return_value=dict(AI_RESULT)):
            r = self.upload(name='My jacket', rain_ok='false')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['name'], 'My jacket')
        self.assertFalse(r.data['rain_ok'])

    def test_no_ai_and_no_type_asks_for_type(self):
        from unittest import mock
        with mock.patch('api.views.analyse_garment', return_value=None):
            r = self.upload()
        self.assertEqual(r.status_code, 400)
        self.assertIn('category', r.data)
        self.assertEqual(Garment.objects.count(), 0)

    def test_no_ai_with_type_still_detects_colours(self):
        from unittest import mock
        with mock.patch('api.views.analyse_garment', return_value=None):
            r = self.upload(category='top')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['primary_color'], 'yellow')

    def test_photo_without_clothing_is_rejected(self):
        from unittest import mock
        with mock.patch('api.views.analyse_garment', return_value={**AI_RESULT, 'is_garment': False}):
            r = self.upload()
        self.assertEqual(r.status_code, 400)
        self.assertIn('image', r.data)


class VisionCleanTests(APITestCase):
    def test_clamps_and_drops_bad_values(self):
        from .vision import _clean
        out = _clean({
            'is_garment': True, 'category': 'top', 'subcategory': 'jeans', 'name': ' Blue tee ',
            'colors': [{'name': 'blue', 'share': 1.4}, {'name': 'blue', 'share': 0.1}],
            'pattern': 'solid', 'material': '', 'surface': 'smooth', 'sheen': 'low', 'fit': 'regular',
            'formality': 9, 'warmth': -2, 'rain_ok': False, 'season': ['winter', 'summer'],
            'confidence': {'category': 0.9, 'color': 1.2, 'pattern': 0.8, 'material': 0.1},
        })
        self.assertEqual(out['subcategory'], '')  # jeans is not a kind of top
        self.assertLessEqual(out['attribute_confidence']['category'], 0.6)
        self.assertEqual([c['name'] for c in out['colors']], ['blue'])
        self.assertEqual(out['colors'][0]['share'], 1.0)
        self.assertEqual((out['formality'], out['warmth']), (5, 0))
        self.assertEqual(out['season'], ['summer', 'winter'])
        self.assertEqual(out['material'], {})
        self.assertEqual(out['name'], 'Blue tee')

    def test_without_key_returns_none(self):
        import os
        from unittest import mock
        from .vision import analyse_garment
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''}):
            self.assertIsNone(analyse_garment(png((1, 2, 3))))


class LanguageAndStyleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('ls@example.com', 'pw-12345678')
        self.taste = TasteProfile.objects.create(user=self.user)

    def test_explanation_in_azerbaijani(self):
        from .engine.recommend import explain
        u = self.user
        outfit = {
            'top': garment(u, 'top', 'navy', subcategory='sweater'),
            'bottom': garment(u, 'bottom', 'beige', subcategory='chinos'),
            'outerwear': garment(u, 'outerwear', 'yellow', subcategory='rain_jacket', rain_ok=True),
        }
        scores = {'color': 90, 'weather': 95, 'occasion': 80, 'rotation': 50}
        az = explain(outfit, scores, ctx(lang='az'))
        self.assertIn('yağış gödəkçəsi', az)
        self.assertIn('70% yağış', az)
        en = explain(outfit, scores, ctx(lang='en'))
        self.assertIn('rain chance', en)

    def test_neutral_base_names_the_accent(self):
        from .engine.recommend import explain
        u = self.user
        outfit = {'top': garment(u, 'top', 'white', subcategory='shirt'), 'bottom': garment(u, 'bottom', 'red', subcategory='skirt')}
        text = explain(outfit, {'color': 99, 'weather': 10, 'occasion': 10, 'rotation': 0}, ctx(lang='en', temp_c=None))
        self.assertIn('lets the red do the talking', text)

    def test_style_nudges_formality(self):
        from .engine.scoring import style_bonus
        u = self.user
        smart = {'top': garment(u, 'top', 'white', formality=4), 'bottom': garment(u, 'bottom', 'navy', formality=4)}
        loose = {'top': garment(u, 'top', 'grey', formality=1), 'bottom': garment(u, 'bottom', 'blue', formality=2)}
        self.assertGreater(style_bonus(smart, 'business'), style_bonus(loose, 'business'))
        self.assertGreater(style_bonus(loose, 'casual'), style_bonus(smart, 'casual'))
        self.assertEqual(style_bonus(smart, None), 0)

    def test_api_answers_in_the_requested_language(self):
        r = self.client.post('/api/auth/register/', {'email': 'lang@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}", HTTP_ACCEPT_LANGUAGE='az')
        for cat, color in [('top', 'navy'), ('bottom', 'beige'), ('shoes', 'brown')]:
            self.client.post('/api/garments/', {'category': cat, 'colors': [{'name': color, 'share': 1}], 'formality': 3}, format='json')
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 10, 'precip_prob': 0}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        text = r.data['outfits'][0]['explanation']
        self.assertTrue(any(w in text for w in ('üçün', 'və', 'rəng')), text)
        self.assertNotIn('lang', r.data['context'])


class SwapAndOnboardingTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'swap@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.assertFalse(r.data['user']['onboarded'])
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def add(self, category, color, formality=3):
        r = self.client.post('/api/garments/', {'category': category, 'colors': [{'name': color, 'share': 1}], 'formality': formality}, format='json')
        return r.data['id']

    def test_onboarding_answers_are_saved(self):
        r = self.client.patch('/api/auth/me/', {
            'wardrobe_style': 'menswear', 'style_direction': 'business', 'main_occasion': 'work', 'onboarded': True,
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['main_occasion'], r.data['onboarded']), ('work', True))

    def test_alternatives_and_swap(self):
        self.add('top', 'white')
        self.add('top', 'navy')
        self.add('top', 'grey')
        self.add('bottom', 'beige')
        self.add('shoes', 'brown')
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 18, 'precip_prob': 0}, format='json')
        outfit = r.data['outfits'][0]
        top = next(i['garment']['id'] for i in outfit['items'] if i['slot'] == 'top')

        r = self.client.get(f"/api/outfits/{outfit['id']}/alternatives/?slot=top")
        self.assertEqual(r.status_code, 200, r.data)
        ids = [o['garment']['id'] for o in r.data['options']]
        self.assertEqual(len(ids), 2)
        self.assertNotIn(top, ids)
        totals = [o['total'] for o in r.data['options']]
        self.assertEqual(totals, sorted(totals, reverse=True))

        r = self.client.post(f"/api/outfits/{outfit['id']}/swap/", {'slot': 'top', 'garment_id': ids[1]}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        new_top = next(i['garment']['id'] for i in r.data['items'] if i['slot'] == 'top')
        self.assertEqual(new_top, ids[1])
        self.assertTrue(r.data['explanation'])
        fb = Feedback.objects.filter(outfit_id=outfit['id']).latest('created_at')
        self.assertEqual(fb.replaced, [{'from': top, 'to': ids[1]}])
        w = TasteProfile.objects.get(user__email='swap@example.com').weights
        self.assertGreater(w[f'g:{ids[1]}'], 0)
        self.assertLess(w[f'g:{top}'], 0)

    def test_swap_rejects_wrong_kind(self):
        self.add('top', 'white')
        shoes = self.add('shoes', 'brown')
        self.add('bottom', 'beige')
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 18}, format='json')
        oid = r.data['outfits'][0]['id']
        r = self.client.post(f'/api/outfits/{oid}/swap/', {'slot': 'top', 'garment_id': shoes}, format='json')
        self.assertEqual(r.status_code, 400)


class VideoScanTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'video@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}", HTTP_ACCEPT_LANGUAGE='az')

    def video(self):
        return SimpleUploadedFile('closet.mp4', b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 64, 'video/mp4')

    def test_needs_ai(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''}):
            r = self.client.post('/api/scans/', {'video': self.video()}, format='multipart')
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.data['code'], 'ai_unavailable')

    def run_scan(self, items):
        import os
        import numpy as np
        from unittest import mock
        from .scans import process_scan
        frames = [np.full((200, 300, 3), c, np.uint8) for c in ((30, 40, 80), (217, 169, 51))]
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'test'}), \
                mock.patch('api.views.start_scan', side_effect=lambda scan: process_scan(scan.pk)), \
                mock.patch('api.scans.extract_frames', return_value=frames), \
                mock.patch('api.scans.analyse_frames', return_value=items) as af:
            r = self.client.post('/api/scans/', {'video': self.video()}, format='multipart')
        self.assertEqual(r.status_code, 202, r.data)
        return self.client.get(f"/api/scans/{r.data['id']}/"), af

    def test_scan_creates_a_garment_per_item(self):
        items = [
            {**AI_RESULT, 'name': 'Sarı yağış gödəkçəsi', 'frame': 1, 'box': {'x': 0.2, 'y': 0.1, 'w': 0.5, 'h': 0.8}},
            {**AI_RESULT, 'category': 'top', 'subcategory': 'sweater', 'name': 'Tünd göy sviter', 'rain_ok': False,
             'colors': [{'name': 'navy', 'rgb': [30, 40, 80], 'share': 1.0}], 'frame': 0,
             'box': {'x': 0, 'y': 0, 'w': 1, 'h': 1}},
        ]
        r, af = self.run_scan(items)
        self.assertEqual(r.data['status'], 'done', r.data)
        self.assertEqual(r.data['frames_used'], 2)
        self.assertEqual(af.call_args.args[1], 'az')
        names = sorted(g['name'] for g in r.data['garments'])
        self.assertEqual(names, ['Sarı yağış gödəkçəsi', 'Tünd göy sviter'])
        self.assertTrue(all(g['image'] for g in r.data['garments']))
        from .models import VideoScan
        self.assertFalse(VideoScan.objects.get(pk=r.data['id']).video)  # footage is not kept

    def test_ai_failure_marks_scan_failed(self):
        r, _ = self.run_scan(None)
        self.assertEqual((r.data['status'], r.data['error']), ('failed', 'ai_failed'))
        self.assertEqual(r.data['garments'], [])

    def test_crop_handles_edges(self):
        import io
        import numpy as np
        from .video import crop
        frame = np.zeros((100, 200, 3), np.uint8)
        img = Image.open(io.BytesIO(crop(frame, {'x': 0.9, 'y': 0.9, 'w': 0.5, 'h': 0.5})))
        self.assertLessEqual(img.size[0], 200)
        img = Image.open(io.BytesIO(crop(frame, {'x': 0.5, 'y': 0.5, 'w': 0.0, 'h': 0.0})))
        self.assertEqual(img.size, (200, 100))  # degenerate box falls back to the whole frame


class PreferencesTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'prefs@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_defaults(self):
        r = self.client.get('/api/auth/me/')
        self.assertEqual(r.data['preferred_styles'], [])
        self.assertEqual(r.data['sizes'], {})
        self.assertEqual((r.data['units'], r.data['notifications_enabled']), ('metric', True))

    def test_preferences_save_and_mirror_style(self):
        r = self.client.patch('/api/auth/me/', {
            'preferred_styles': ['classic', 'minimal', 'classic'], 'favorite_colors': ['navy', 'camel'],
            'sizes': {'top': 'M', 'shoes': '43'}, 'typical_occasions': ['work', 'date'], 'units': 'imperial',
            'notifications_enabled': False,
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['preferred_styles'], ['classic', 'minimal'])
        self.assertEqual(r.data['style_direction'], 'classic')
        self.assertEqual(r.data['sizes'], {'top': 'M', 'shoes': '43'})
        self.assertEqual(r.data['units'], 'imperial')
        self.assertFalse(r.data['notifications_enabled'])

    def test_empty_styles_keep_style_direction(self):
        self.client.patch('/api/auth/me/', {'style_direction': 'business'}, format='json')
        r = self.client.patch('/api/auth/me/', {'preferred_styles': []}, format='json')
        self.assertEqual(r.data['style_direction'], 'business')

    def test_rejects_unknown_values(self):
        for body in (
            {'preferred_styles': ['goth']}, {'favorite_colors': ['magenta']}, {'typical_occasions': ['picnic']},
            {'sizes': {'hat': 'L'}}, {'sizes': {'top': 'x' * 13}}, {'units': 'stones'}, {'preferred_styles': 'casual'},
        ):
            r = self.client.patch('/api/auth/me/', body, format='json')
            self.assertEqual(r.status_code, 400, body)
            self.assertIn(next(iter(body)), r.data)

    def test_meta_lists_new_styles(self):
        styles = self.client.get('/api/meta/').data['style_directions']
        self.assertIn('classic', styles)
        self.assertIn('bohemian', styles)

    def test_favorite_colors_nudge_score(self):
        from .engine.scoring import FAVORITE_CAP, score_color
        u = User.objects.get(email='prefs@example.com')
        taste = TasteProfile.objects.get(user=u)
        outfit = {'top': garment(u, 'top', 'navy'), 'bottom': garment(u, 'bottom', 'beige'),
                  'shoes': garment(u, 'shoes', 'camel')}
        plain = score_color(outfit, PairTable(), taste)
        fav = score_color(outfit, PairTable(), taste, favorites=['navy', 'beige', 'camel'])
        self.assertEqual(round(fav - plain), FAVORITE_CAP)  # capped, not 3 × bonus


class GarmentFavoriteAndSampleTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'sample@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_favorite_flag_and_filter(self):
        a = self.client.post('/api/garments/', {'category': 'top', 'colors': [{'name': 'navy'}]}, format='json').data
        self.client.post('/api/garments/', {'category': 'top', 'colors': [{'name': 'grey'}]}, format='json')
        self.assertFalse(a['favorite'])
        r = self.client.patch(f"/api/garments/{a['id']}/", {'favorite': True, 'is_sample': True}, format='json')
        self.assertTrue(r.data['favorite'])
        self.assertFalse(r.data['is_sample'])  # read-only
        r = self.client.get('/api/garments/?favorite=true')
        self.assertEqual([g['id'] for g in r.data['results']], [a['id']])

    def test_load_and_delete_sample(self):
        r = self.client.post('/api/garments/sample/')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertGreaterEqual(len(r.data), 15)
        self.assertTrue(all(g['is_sample'] and g['colors'][0]['rgb'] for g in r.data))
        self.assertIn('White shirt', [g['name'] for g in r.data])
        self.assertTrue(all(g['image'] for g in r.data))  # every sample piece has its photo
        self.assertEqual(self.client.post('/api/garments/sample/').data['code'], 'already_loaded')
        self.assertEqual(self.client.post('/api/garments/sample/').status_code, 409)
        mine = self.client.post('/api/garments/', {'category': 'top', 'colors': [{'name': 'red'}]}, format='json').data
        r = self.client.delete('/api/garments/sample/')
        self.assertEqual(r.status_code, 204)
        self.assertEqual([g['id'] for g in self.client.get('/api/garments/').data['results']], [mine['id']])

    def test_sample_names_in_azerbaijani_and_usable(self):
        self.client.credentials(HTTP_AUTHORIZATION=self.client._credentials['HTTP_AUTHORIZATION'], HTTP_ACCEPT_LANGUAGE='az')
        r = self.client.post('/api/garments/sample/')
        self.assertIn('Ağ köynək', [g['name'] for g in r.data])
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 9, 'precip_prob': 0.8}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(r.data['outfits']), 3)

    def test_sample_photos_restored_and_outdated_pieces_swapped(self):
        self.client.post('/api/garments/sample/')
        user = User.objects.get(email='sample@example.com')
        shirt = Garment.objects.get(user=user, subcategory='shirt', is_sample=True)
        shirt.image.delete(save=True)  # photo lost
        Garment.objects.filter(user=user, subcategory='jeans', colors__0__name='black').delete()
        old = garment(user, 'outerwear', 'camel', subcategory='coat', is_sample=True)  # from an older list
        r = self.client.get('/api/garments/')
        names = [g['name'] for g in r.data['results']]
        self.assertTrue(all(g['image'] for g in r.data['results']))
        self.assertIn('Black jeans', names)
        self.assertFalse(Garment.objects.filter(id=old.id).exists())
        self.assertEqual(len(names), 16)


class TitleAndReasonTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('title@example.com', 'pw-12345678')
        u = self.user
        self.top = garment(u, 'top', 'navy', subcategory='sweater', formality=3, warmth=2)
        self.bottom = garment(u, 'bottom', 'beige', subcategory='chinos', formality=3, warmth=2)
        self.shoes = garment(u, 'shoes', 'brown', subcategory='loafers', formality=3, warmth=0)
        self.rain = garment(u, 'outerwear', 'yellow', subcategory='rain_jacket', formality=2, warmth=2, rain_ok=True)

    def outfit(self, **extra):
        return {'top': self.top, 'bottom': self.bottom, 'shoes': self.shoes, **extra}

    def test_titles_follow_context(self):
        from .engine.describe import title_for
        self.assertEqual(title_for(self.outfit(), ctx(precip_prob=0.1, lang='en')), 'Effortless Smart Casual')
        self.assertEqual(title_for(self.outfit(), ctx(precip_prob=0.1, lang='az')), 'Rahat smart casual')
        self.assertEqual(title_for(self.outfit(outerwear=self.rain), ctx(lang='en')), 'Rainy Day Layers')
        self.assertEqual(title_for(self.outfit(outerwear=self.rain), ctx(lang='az')), 'Yağışlı gün üçün')
        self.assertEqual(title_for(self.outfit(), ctx(occasion='date', precip_prob=0, lang='en')), 'Evening Out')
        self.assertEqual(title_for(self.outfit(), ctx(occasion='sport', precip_prob=0, lang='az')), 'Aktiv gün')

    def test_titles_in_a_set_are_distinct(self):
        from .engine.describe import titles_for
        other = {'top': garment(self.user, 'top', 'white', formality=3), 'bottom': self.bottom}
        en = titles_for([self.outfit(), other, self.outfit()], ctx(precip_prob=0, lang='en'))
        self.assertEqual(en[:2], ['Effortless Smart Casual', 'White Smart Casual'])
        self.assertEqual(len(set(en)), 3)
        az = titles_for([self.outfit(), self.outfit()], ctx(precip_prob=0, lang='az'))
        self.assertEqual(az, ['Rahat smart casual', 'Tünd göy smart casual'])

    def test_reasons_are_grounded(self):
        from .engine.describe import reasons_for
        scores = {'color': 90, 'occasion': 95, 'weather': 90, 'silhouette': 80, 'rotation': 100}
        en = reasons_for(self.outfit(outerwear=self.rain), scores, ctx(lang='en', style='smart_casual'))
        self.assertTrue(2 <= len(en) <= 4)
        self.assertIn('Navy and beige create a balanced, versatile palette.', en)
        self.assertTrue(any('70% chance of rain' in r for r in en))
        self.assertTrue(any('Smart Casual preference' in r for r in en))
        az = reasons_for(self.outfit(outerwear=self.rain), scores, ctx(lang='az', style='smart_casual'))
        self.assertIn('Tünd göy və bej balanslı, universal palitra yaradır.', az)
        self.assertTrue(any('yağış' in r for r in az))

    def test_no_weather_claims_without_weather(self):
        from .engine.describe import reasons_for
        scores = {'color': 90, 'occasion': 95, 'weather': 100, 'silhouette': 80, 'rotation': 100}
        for lang in ('en', 'az'):
            out = reasons_for(self.outfit(), scores, ctx(lang=lang, temp_c=None, precip_prob=None, style='sporty'))
            self.assertGreaterEqual(len(out), 2)
            self.assertFalse(any('°C' in r or 'rain' in r or 'yağış' in r for r in out), out)
            self.assertFalse(any('preference' in r or 'üslub' in r for r in out), out)  # no style bonus for sporty

    def test_api_outfits_carry_title_and_reasons(self):
        r = self.client.post('/api/auth/register/', {'email': 't2@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.client.post('/api/garments/sample/')
        r = self.client.post('/api/recommendations/', {'occasion': 'casual', 'temp_c': 16, 'precip_prob': 0}, format='json')
        titles = [o['title'] for o in r.data['outfits']]
        self.assertTrue(all(titles))
        self.assertEqual(len(set(titles)), len(titles))
        self.assertTrue(all(2 <= len(o['reasons']) <= 4 for o in r.data['outfits']), r.data['outfits'])
        ids = [g['id'] for g in self.client.get('/api/garments/?category=top').data['results'][:1]]
        ids += [g['id'] for g in self.client.get('/api/garments/?category=bottom').data['results'][:1]]
        r = self.client.post('/api/check-outfit/', {'garment_ids': ids, 'occasion': 'work', 'save': True}, format='json')
        self.assertTrue(r.data['title'])
        self.assertEqual(r.data['outfit']['title'], r.data['title'])
        self.assertTrue(r.data['outfit']['reasons'])


class VarietyTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'variety@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def add(self, category, color):
        return self.client.post('/api/garments/', {'category': category, 'colors': [{'name': color}], 'formality': 3},
                                format='json').data['id']

    def combos(self, r):
        return {frozenset(i['garment']['id'] for i in o['items']) for o in r.data['outfits']}

    def test_another_look_skips_earlier_combinations(self):
        for c in ('white', 'navy', 'grey'):
            self.add('top', c)
        for c in ('beige', 'charcoal'):
            self.add('bottom', c)
        self.add('shoes', 'brown')  # 3 × 2 = 6 possible looks
        body = {'occasion': 'work', 'temp_c': 18, 'precip_prob': 0}
        first = self.combos(self.client.post('/api/recommendations/', body, format='json'))
        second = self.combos(self.client.post('/api/recommendations/', body, format='json'))
        self.assertEqual(len(first), 3)
        self.assertEqual(len(second), 3)
        self.assertFalse(first & second)
        # Every look has been shown: repeats come back rather than nothing.
        third = self.client.post('/api/recommendations/', body, format='json')
        self.assertEqual(third.status_code, 201)
        self.assertEqual(len(third.data['outfits']), 3)
        # A different occasion starts fresh.
        other = self.combos(self.client.post('/api/recommendations/', {**body, 'occasion': 'casual'}, format='json'))
        self.assertTrue(other & (first | second))

    def test_latest(self):
        self.assertEqual(self.client.get('/api/recommendations/latest/?occasion=work').status_code, 404)
        self.add('top', 'white')
        self.add('bottom', 'beige')
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 18}, format='json')
        latest = self.client.get('/api/recommendations/latest/?occasion=work')
        self.assertEqual(latest.status_code, 200)
        self.assertEqual(latest.data['id'], r.data['id'])
        self.assertEqual(latest.data['outfits'][0]['id'], r.data['outfits'][0]['id'])
        self.assertEqual(self.client.get('/api/recommendations/latest/?occasion=date').status_code, 404)
        self.assertEqual(self.client.get('/api/recommendations/latest/?occasion=nope').status_code, 400)

    def test_fixed_garment(self):
        u = User.objects.get(email='variety@example.com')
        for c in ('white', 'navy'):
            self.add('top', c)
        jeans = self.add('bottom', 'blue')
        self.add('bottom', 'beige')
        self.add('dress', 'red')
        garments = list(Garment.objects.filter(user=u))
        res = recommend(garments, ctx(precip_prob=0, temp_c=18), PairTable(), TasteProfile.objects.get(user=u),
                        fixed_garment_id=jeans)
        self.assertEqual(len(res), 2)  # two tops, each with the jeans
        self.assertTrue(all(r['outfit']['bottom'].id == jeans for r in res))


class StatsTests(APITestCase):
    def test_extended_keys(self):
        r = self.client.post('/api/auth/register/', {'email': 'stats@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.client.patch('/api/auth/me/', {'preferred_styles': ['bohemian']}, format='json')
        self.client.post('/api/garments/sample/')
        g = self.client.get('/api/garments/').data['results'][0]
        self.client.patch(f"/api/garments/{g['id']}/", {'favorite': True}, format='json')
        r = self.client.post('/api/recommendations/', {'occasion': 'work', 'temp_c': 15}, format='json')
        self.client.post(f"/api/outfits/{r.data['outfits'][0]['id']}/wear/")
        s = self.client.get('/api/stats/').data
        for key in ('total', 'by_category', 'rotation_pct', 'most_worn', 'outfits_saved'):
            self.assertIn(key, s)
        self.assertEqual(s['worn_outfits'], 1)
        self.assertEqual(s['favorite_style'], 'bohemian')
        self.assertEqual(s['favorites'], 1)
        self.assertEqual(len(s['recently_added']), 5)
        self.assertEqual(len(s['weekly_activity']), 7)
        self.assertEqual(s['weekly_activity'][-1]['count'], 1)
        self.assertLess(s['weekly_activity'][0]['date'], s['weekly_activity'][-1]['date'])
        self.assertTrue(1 <= len(s['most_worn_categories']) <= 3)
        self.assertTrue(all(c['count'] > 0 for c in s['most_worn_categories']))


class AssistantTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'chat@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.token = r.data['token']
        self.lang('en')

    def lang(self, lang):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token}', HTTP_ACCEPT_LANGUAGE=lang)

    def ask(self, message):
        r = self.client.post('/api/assistant/', {'message': message}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(3 <= len(r.data['suggestions']) <= 4, r.data['suggestions'])
        return r.data

    def test_intents(self):
        from .assistant import _norm, detect_intent, detect_occasion
        cases = {
            'What should I wear tomorrow?': 'tomorrow', 'Sabah nə geyinim?': 'tomorrow', 'sabah ne geyinim': 'tomorrow',
            'Outfits for a dinner date': 'occasion', 'şam yeməyi üçün': 'occasion', 'Style these trousers in three ways': 'style_piece',
            'bu şalvarı 3 cür kombinlə': 'style_piece', 'bu salvari 3 cur': 'style_piece',
            'Which colors go with this jacket?': 'colors', 'bu gödəkçəyə hansı rənglər yaraşır': 'colors',
            'bu godekceye hansi rengler yarasir': 'colors', 'hello': 'unknown', 'nə geyinim': 'today',
        }
        for text, intent in cases.items():
            self.assertEqual(detect_intent(*_norm(text)), intent, text)
        self.assertEqual(detect_occasion(*_norm('what is good for the gym')), 'sport')
        self.assertEqual(detect_occasion(*_norm('İşə nə geyinim')), 'work')
        self.assertIsNone(detect_occasion(*_norm('this is it')))  # "is" is not "iş"

    def test_empty_closet(self):
        d = self.ask('What should I wear tomorrow?')
        self.assertEqual(d['outfits'], [])
        self.assertIn('closet is empty', d['reply'])
        self.lang('az')
        d = self.ask('sabah ne geyinim')
        self.assertIn('boşdur', d['reply'])

    def test_too_small_closet_names_what_to_add(self):
        self.client.post('/api/garments/', {'category': 'top', 'colors': [{'name': 'navy'}]}, format='json')
        d = self.ask('Outfits for work')
        self.assertIn('a bottom (or a dress)', d['reply'])
        self.assertIn('shoes', d['reply'])

    def test_tomorrow_without_location_never_mentions_weather(self):
        from unittest import mock
        self.client.post('/api/garments/sample/')
        with mock.patch('api.services.forecast') as fc:
            d = self.ask('What should I wear tomorrow?')
        fc.assert_not_called()
        self.assertEqual(len(d['outfits']), 3)
        self.assertIn('tomorrow', d['reply'])
        self.assertNotIn('°C', d['reply'])
        tomorrow = (__import__('django.utils.timezone', fromlist=['x']).localdate()
                    + __import__('datetime').timedelta(days=1)).isoformat()
        self.assertEqual(d['outfits'][0]['context']['date'], tomorrow)
        self.assertTrue(d['outfits'][0]['title'])

    def test_tomorrow_with_forecast_mentions_temperature(self):
        from unittest import mock
        self.client.patch('/api/auth/me/', {'latitude': 40.4, 'longitude': 49.9}, format='json')
        self.client.post('/api/garments/sample/')
        self.lang('az')
        wx = {'temp_c': 12.4, 'temp_min_c': 8, 'temp_max_c': 15, 'precip_prob': 0.6}
        with mock.patch('api.services.forecast', return_value=wx):
            d = self.ask('Sabah nə geyinim?')
        self.assertIn('12°C', d['reply'])
        self.assertIn('Sabah', d['reply'])
        self.assertIn('yağış ehtimalı 60%', d['reply'])
        with mock.patch('api.services.forecast', return_value=None):
            d = self.ask('sabah ne geyinim')
        self.assertNotIn('°C', d['reply'])

    def test_occasion_looks(self):
        self.client.post('/api/garments/sample/')
        d = self.ask('I have a dinner date tonight')
        self.assertEqual(len(d['outfits']), 3)
        self.assertTrue(all(o['context']['occasion'] == 'date' for o in d['outfits']))
        self.assertIn('for a date', d['reply'])
        self.lang('az')
        d = self.ask('ofis üçün nə geyinim')
        self.assertTrue(all(o['context']['occasion'] == 'work' for o in d['outfits']))
        self.assertIn('İş üçün', d['reply'])
        # Assistant sets do not replace the Today screen's latest set.
        self.assertEqual(self.client.get('/api/recommendations/latest/?occasion=work').status_code, 404)

    def test_style_a_piece_three_ways(self):
        self.client.post('/api/garments/sample/')
        chinos = Garment.objects.get(user__email='chat@example.com', subcategory='chinos')
        d = self.ask('Style my beige chinos in three ways')
        self.assertEqual(len(d['outfits']), 3)
        for o in d['outfits']:
            self.assertIn(chinos.id, [i['garment']['id'] for i in o['items']])
        self.assertIn('beige chinos', d['reply'])
        self.lang('az')
        jeans = set(Garment.objects.filter(user__email='chat@example.com', subcategory='jeans').values_list('id', flat=True))
        d = self.ask('bu cinsi 3 cür kombinlə')
        self.assertTrue(d['outfits'])
        for o in d['outfits']:
            self.assertTrue(jeans & {i['garment']['id'] for i in o['items']})
        self.assertIn('kombin', d['reply'])

    def test_style_missing_piece(self):
        self.client.post('/api/garments/sample/')
        d = self.ask('Style my skirt in three ways')
        self.assertEqual(d['outfits'], [])
        self.assertIn("couldn't find", d['reply'])
        self.lang('az')
        self.assertIn('tapa bilmədim', self.ask('ətəyi 3 cür kombinlə')['reply'])

    def test_colors_for_a_piece(self):
        self.client.post('/api/garments/sample/')
        d = self.ask('Which colors go with my black blazer?')
        self.assertEqual(d['outfits'], [])
        self.assertIn('black blazer (black)', d['reply'])
        self.assertIn('white', d['reply'])
        self.assertIn('You already own', d['reply'])
        self.lang('az')
        d = self.ask('bu pencəyə hansı rənglər yaraşır')
        self.assertIn('qara', d['reply'])
        self.assertIn('ağ', d['reply'])
        self.assertIn('Bunlardan səndə artıq', d['reply'])

    def test_colors_for_a_named_colour_without_closet(self):
        d = self.ask('What colours go with navy?')
        self.assertIn('beige', d['reply'])
        self.assertIn("You don't own any of these yet.", d['reply'])

    def test_unknown_lists_capabilities(self):
        self.client.post('/api/garments/sample/')
        d = self.ask('hello there')
        self.assertIn('I can pick what to wear tomorrow', d['reply'])
        self.assertEqual(d['outfits'], [])
        self.lang('az')
        d = self.ask('')
        self.assertIn('Sabah nə geyinəcəyini', d['reply'])
        self.assertTrue(all(any(ch in s for ch in 'əğışçöü') or s for s in d['suggestions']))

    def test_suggestions_are_understood(self):
        from .assistant import _norm, detect_intent, suggestions
        self.client.post('/api/garments/sample/')
        garments = list(Garment.objects.filter(user__email='chat@example.com'))
        for lang in ('en', 'az'):
            for s in suggestions(garments, lang, 'unknown'):
                self.assertNotEqual(detect_intent(*_norm(s)), 'unknown', s)


    def test_photo_question_names_colour_and_matching_pieces(self):
        self.client.post('/api/garments/sample/')
        photo = SimpleUploadedFile('q.png', png((20, 30, 70)).read(), content_type='image/png')
        r = self.client.post('/api/assistant/', {'message': '', 'image': photo}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('navy', r.data['reply'])
        self.assertTrue(r.data['garments'])
        self.assertTrue(all(g['image'] for g in r.data['garments']))
        self.assertIsNone(r.data['piece'])  # no AI tagging in tests, so the kind is unknown

    def test_photo_must_be_an_image(self):
        bad = SimpleUploadedFile('q.png', b'not an image', content_type='image/png')
        r = self.client.post('/api/assistant/', {'image': bad}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_voice_question_is_transcribed_and_answered(self):
        from unittest import mock
        audio = SimpleUploadedFile('q.m4a', b'fake audio', content_type='audio/m4a')
        with mock.patch('api.views.transcribe', return_value=('What should I wear tomorrow?', 'en')):
            r = self.client.post('/api/assistant/', {'audio': audio}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['heard'], 'What should I wear tomorrow?')
        with mock.patch('api.views.transcribe', return_value=None):
            audio.seek(0)
            r = self.client.post('/api/assistant/', {'audio': audio}, format='multipart')
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.data['code'], 'voice_unavailable')

    def test_russian_voice_question_is_understood(self):
        from unittest import mock
        audio = SimpleUploadedFile('q.m4a', b'fake audio', content_type='audio/m4a')
        with mock.patch('api.views.transcribe', return_value=('Что мне надеть завтра на встречу с клиентом?', 'ru')):
            r = self.client.post('/api/assistant/', {'audio': audio}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['heard'], r.data['heard_lang']), ('Что мне надеть завтра на встречу с клиентом?', 'ru'))
        from .assistant import _norm, detect_intent, detect_occasion
        raw, folded = _norm('Что мне надеть завтра на встречу с клиентом?')
        self.assertEqual((detect_intent(raw, folded), detect_occasion(raw, folded)), ('tomorrow', 'client_meeting'))

    def test_language_is_heard_not_taken_from_the_app(self):
        from .speech import pick_language
        self.assertEqual(pick_language([('ru', 0.9), ('en', 0.05)], 'az'), 'ru')
        self.assertEqual(pick_language([('tr', 0.6), ('az', 0.3)], 'az'), 'az')  # too close to tell: the app decides
        self.assertEqual(pick_language([('az', 0.6), ('tr', 0.3)], 'tr'), 'tr')
        self.assertEqual(pick_language([('es', 0.9)], 'az'), 'es')
        self.assertEqual(pick_language([('zh', 0.6), ('en', 0.3)], 'az'), 'en')  # unsupported: the nearest we speak
        self.assertEqual(pick_language([('uk', 0.5), ('ru', 0.3)], 'en'), 'ru')
        self.assertEqual(pick_language([('en', 0.48), ('az', 0.47)], 'az'), 'az')  # a tie goes to the app's language

    def test_cloud_transcription_rewrites_turkish_as_azerbaijani(self):
        from unittest import mock
        from . import speech
        calls = []

        def fake(provider, path, language=None):
            calls.append(language)
            return ('Sabah ne giyeyim', 'tr') if language is None else ('Sabah nə geyinim', language)
        audio = SimpleUploadedFile('q.m4a', b'fake audio')
        with mock.patch.dict('os.environ', {'GROQ_API_KEY': 'k'}), mock.patch.object(speech, '_cloud_call', fake):
            self.assertEqual(speech.transcribe(audio, 'az'), ('Sabah nə geyinim', 'az'))
        self.assertEqual(calls, [None, 'az'])

class StyleFilterTests(APITestCase):
    def test_style_override_is_used_and_stored(self):
        r = self.client.post('/api/auth/register/', {'email': 'stylef@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        for cat, color in [('top', 'navy'), ('bottom', 'beige'), ('shoes', 'brown')]:
            self.client.post('/api/garments/', {'category': cat, 'colors': [{'name': color, 'share': 1}]}, format='json')
        r = self.client.post('/api/recommendations/', {'occasion': 'casual', 'temp_c': 20, 'style': 'minimal'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['outfits'][0]['context']['style'], 'minimal')
        r = self.client.post('/api/recommendations/', {'occasion': 'casual', 'style': 'nope'}, format='json')
        self.assertEqual(r.status_code, 400)


class SocialLoginTests(APITestCase):
    def post(self, provider='google', token='tok', **extra):
        return self.client.post('/api/auth/social/', {'provider': provider, 'id_token': token, **extra}, format='json')

    def test_new_user_then_same_user_again(self):
        from unittest import mock
        claims = {'sub': 'g-123', 'email': 'New@Example.com', 'email_verified': True, 'name': 'Aysel'}
        with mock.patch.dict('api.social.VERIFY', {'google': lambda t: claims}):
            r = self.post()
            self.assertEqual(r.status_code, 201, r.data)
            self.assertTrue(r.data['created'])
            self.assertEqual(r.data['user']['email'], 'new@example.com')
            self.assertEqual(r.data['user']['display_name'], 'Aysel')
            again = self.post()
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['user']['id'], r.data['user']['id'])
        self.assertFalse(User.objects.get(email='new@example.com').has_usable_password())

    def test_links_existing_email_account_and_finds_it_without_email_later(self):
        from unittest import mock
        existing = User.objects.create_user('me@example.com', 'pw-12345678')
        first = {'sub': 'a-1', 'email': 'me@example.com', 'email_verified': 'true'}
        with mock.patch.dict('api.social.VERIFY', {'apple': lambda t: first}):
            self.assertEqual(self.post('apple').data['user']['id'], existing.id)
        # Apple omits the email on later sign-ins; the linked sub still finds the user.
        with mock.patch.dict('api.social.VERIFY', {'apple': lambda t: {'sub': 'a-1'}}):
            self.assertEqual(self.post('apple').data['user']['id'], existing.id)

    def test_errors(self):
        from unittest import mock
        from . import social

        self.assertEqual(self.post('facebook').status_code, 400)
        with mock.patch.dict('os.environ', {'GOOGLE_CLIENT_IDS': ''}):
            r = self.post('google')
        self.assertEqual((r.status_code, r.data['code']), (503, 'not_configured'))

        def bad(token):
            raise social.InvalidToken('nope')
        with mock.patch.dict('api.social.VERIFY', {'google': bad}):
            self.assertEqual(self.post().data['code'], 'invalid_token')
        with mock.patch.dict('api.social.VERIFY', {'google': lambda t: {'sub': 'x', 'email': 'u@x.com', 'email_verified': False}}):
            self.assertEqual(self.post().status_code, 400)


class ShoppingTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'shop@example.com', 'password': 'Wardrobe-123', 'display_name': 'Test'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}", HTTP_ACCEPT_LANGUAGE='az')
        self.user = User.objects.get(email='shop@example.com')

    def test_missing_essentials_come_first_with_store_links(self):
        garment(self.user, 'top', 'navy', subcategory='sweater')
        r = self.client.get('/api/shopping/')
        items = r.data['suggestions']
        self.assertTrue(1 <= len(items) <= 4)
        self.assertEqual(items[0]['subcategory'], 'sneakers')  # no shoes yet
        self.assertEqual(items[0]['title'], 'Ağ krossovka')
        self.assertTrue(all(i['links'] and i['links'][0]['url'].startswith('https://') for i in items))
        trendyol = items[0]['links'][0]['url']
        self.assertIn('q=beyaz+sneaker', trendyol)  # Trendyol is searched in Turkish
        self.assertIn('utm_medium=affiliate', trendyol)
        self.assertNotIn(str(self.user.pk) + '&', trendyol.split('sub_id=')[1] + '&')  # the sub-id is anonymous
        self.assertEqual([l['store'] for l in items[0]['links']], ['Trendyol', 'AliExpress', 'Amazon'])

    def test_never_suggests_what_is_owned_and_stylist_answers(self):
        self.client.post('/api/garments/sample/')
        items = self.client.get('/api/shopping/').data['suggestions']
        owned = {(g.subcategory, g.primary_color) for g in Garment.objects.filter(user=self.user)}
        self.assertFalse({(i['subcategory'], i['color']) for i in items} & owned)
        r = self.client.post('/api/assistant/', {'message': 'Qarderobuma nə almalıyam?'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['shopping']), len(items))
        self.assertTrue(all(isinstance(i['unlocks'], int) for i in items))

    def test_will_it_fit_verdicts_and_clicks(self):
        self.client.post('/api/garments/sample/')
        self.assertEqual(self.client.post('/api/shopping/check/', {'subcategory': 'nope', 'color': 'navy'}, format='json').status_code, 400)
        good = self.client.post('/api/shopping/check/', {'subcategory': 'chinos', 'color': 'beige'}, format='json').data
        self.assertIn(good['verdict'], ('great', 'works'))
        self.assertGreaterEqual(good['unlocks'], 3)
        self.assertGreater(good['matches'], 0)
        bad = self.client.post('/api/shopping/check/', {'subcategory': 'evening_dress', 'color': 'orange'}, format='json').data
        self.assertEqual(bad['verdict'], 'skip')
        r = self.client.post('/api/shopping/click/', {'store': 'Trendyol', 'subcategory': 'chinos', 'color': 'beige', 'source': 'check'}, format='json')
        self.assertEqual(r.status_code, 201)
        from .models import AffiliateClick
        self.assertEqual(AffiliateClick.objects.get().source, 'check')

    def test_plan_text_reads_occasion(self):
        r = self.client.post('/api/plan/read/', {'text': 'Client meeting downtown, dinner after'}, format='json')
        self.assertEqual((r.data['occasion'], r.data['level']), ('client_meeting', 'formal'))
        r = self.client.post('/api/plan/read/', {'text': 'Axşam restoranda şam yeməyi'}, format='json')
        self.assertEqual(r.data['level'], 'smart')
        self.assertIsNone(self.client.post('/api/plan/read/', {'text': 'hm'}, format='json').data['occasion'])

    def test_garment_weather_fit(self):
        g = self.client.get('/api/garments/').data
        self.assertEqual(g if isinstance(g, list) else g.get('results', g), [])
        self.client.post('/api/garments/sample/')
        items = self.client.get('/api/garments/').data
        items = items if isinstance(items, list) else items['results']
        coat = max((i for i in items if i['category'] == 'outerwear'), key=lambda i: i['warmth'])
        shoes = next(i for i in items if i['category'] == 'shoes')
        self.assertLess(coat['weather_fit']['max_temp_c'], 20)
        self.assertIsNone(shoes['weather_fit']['min_temp_c'])


class AppleWebFlowTests(APITestCase):
    def test_start_needs_config_then_builds_url_and_callback_returns_to_app(self):
        from unittest import mock
        from urllib.parse import parse_qs, urlsplit

        self.assertEqual(self.client.get('/api/auth/apple/start/?return=exp://x/--/auth').data['code'], 'not_configured')
        env = {'APPLE_SERVICES_ID': 'app.wearwise.web', 'APPLE_REDIRECT_URI': 'https://api.example.com/api/auth/apple/callback/'}
        with mock.patch.dict('os.environ', env):
            self.assertEqual(self.client.get('/api/auth/apple/start/?return=https://evil.example').status_code, 400)
            url = self.client.get('/api/auth/apple/start/?return=exp://x/--/auth').data['url']
        q = parse_qs(urlsplit(url).query)
        self.assertEqual(q['client_id'], ['app.wearwise.web'])
        self.assertEqual(q['response_mode'], ['form_post'])
        r = self.client.post('/api/auth/apple/callback/', {
            'state': q['state'][0], 'id_token': 'tok', 'user': '{"name": {"firstName": "Aysel", "lastName": "M"}}',
        })
        self.assertEqual(r.status_code, 302)
        back = urlsplit(r['Location'])
        self.assertEqual(back.scheme, 'exp')
        self.assertEqual(parse_qs(back.query), {'id_token': ['tok'], 'name': ['Aysel M']})
        self.assertEqual(self.client.post('/api/auth/apple/callback/', {'state': 'forged', 'id_token': 't'}).status_code, 400)

    def test_register_requires_a_name(self):
        r = self.client.post('/api/auth/register/', {'email': 'n@example.com', 'password': 'Wardrobe-123', 'display_name': '  '}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('display_name', r.data)
        r = self.client.post('/api/auth/register/', {'email': 'n@example.com', 'password': 'Wardrobe-123', 'display_name': 'Nər'}, format='json')
        self.assertEqual((r.status_code, r.data['user']['plan']), (201, 'free'))


class GuestTests(APITestCase):
    def test_guest_looks_around_then_signs_up_keeping_everything(self):
        r = self.client.post('/api/auth/guest/', HTTP_ACCEPT_LANGUAGE='az')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['user']['is_guest'])
        self.assertTrue(r.data['user']['onboarded'])
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        closet = self.client.get('/api/garments/').data['results']
        self.assertEqual(len(closet), 16)
        self.assertEqual(self.client.post('/api/recommendations/', {'occasion': 'casual'}, format='json').status_code, 201)

        bad = self.client.post('/api/auth/claim/', {'email': 'g@example.com', 'password': 'Wardrobe-123'}, format='json')
        self.assertIn('display_name', bad.data)
        ok = self.client.post('/api/auth/claim/', {'email': 'G@example.com', 'password': 'Wardrobe-123', 'display_name': 'Leyla'}, format='json')
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertFalse(ok.data['user']['is_guest'])
        self.assertEqual(ok.data['user']['email'], 'g@example.com')
        self.assertEqual(len(self.client.get('/api/garments/').data['results']), 16)
        self.assertEqual(self.client.post('/api/auth/claim/', {}, format='json').status_code, 400)  # already claimed
        self.client.credentials()
        login = self.client.post('/api/auth/login/', {'email': 'g@example.com', 'password': 'Wardrobe-123'}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_social_sign_in_from_a_guest_claims_it(self):
        from unittest import mock
        token = self.client.post('/api/auth/guest/').data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        claims = {'sub': 'g-9', 'email': 'soc@example.com', 'email_verified': True, 'name': 'Soc'}
        with mock.patch.dict('api.social.VERIFY', {'google': lambda t: claims}):
            r = self.client.post('/api/auth/social/', {'provider': 'google', 'id_token': 't'}, format='json')
        self.assertEqual(r.data['token'], token)
        self.assertFalse(r.data['user']['is_guest'])
        self.assertEqual(Garment.objects.filter(user__email='soc@example.com').count(), 16)


class CalendarTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'cal@example.com', 'password': 'Wardrobe-123', 'display_name': 'Cal'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.client.post('/api/garments/sample/')

    def test_worn_outfit_shows_on_its_day_and_month(self):
        from django.utils import timezone
        outfit = self.client.post('/api/recommendations/', {'occasion': 'casual'}, format='json').data['outfits'][0]
        self.client.post(f"/api/outfits/{outfit['id']}/wear/")
        today = timezone.localdate()
        month = self.client.get(f'/api/calendar/?month={today:%Y-%m}').data['days']
        self.assertEqual(month, {today.isoformat(): 1})
        day = self.client.get(f'/api/calendar/day/?date={today.isoformat()}').data
        self.assertEqual([o['id'] for o in day['worn']], [outfit['id']])
        self.assertEqual(self.client.get('/api/calendar/?month=bad').status_code, 400)

    def test_weather_only_for_the_forecast_window(self):
        from datetime import timedelta
        from unittest import mock
        from django.utils import timezone
        today = timezone.localdate()
        wx = {'temp_c': 12.0, 'temp_min_c': 9.0, 'temp_max_c': 14.0, 'precip_prob': 0.2}
        with mock.patch('api.views.forecast', return_value=wx) as f:
            soon = self.client.get(f'/api/calendar/day/?date={today + timedelta(days=3)}&lat=40.4&lon=49.9').data
            far = self.client.get(f'/api/calendar/day/?date={today + timedelta(days=40)}&lat=40.4&lon=49.9').data
            past = self.client.get(f'/api/calendar/day/?date={today - timedelta(days=2)}&lat=40.4&lon=49.9').data
        self.assertEqual(soon['weather'], wx)
        self.assertIsNone(far['weather'])
        self.assertIsNone(past['weather'])
        self.assertEqual(f.call_count, 1)

    def test_plan_tomorrow_then_change_and_drop_it(self):
        from datetime import timedelta
        from django.utils import timezone
        tomorrow = timezone.localdate() + timedelta(days=1)
        looks = self.client.post('/api/recommendations/', {'occasion': 'casual', 'date': tomorrow.isoformat()}, format='json').data['outfits']
        r = self.client.post('/api/calendar/plan/', {'date': tomorrow.isoformat(), 'outfit': looks[0]['id']}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['plan']['saved'])
        self.client.post('/api/calendar/plan/', {'date': tomorrow.isoformat(), 'outfit': looks[1]['id']}, format='json')
        day = self.client.get(f'/api/calendar/day/?date={tomorrow}').data
        self.assertEqual(day['plan']['id'], looks[1]['id'])
        month = self.client.get(f'/api/calendar/?month={tomorrow:%Y-%m}').data
        self.assertEqual(month['planned'], [tomorrow.isoformat()])
        self.assertEqual(self.client.delete(f'/api/calendar/plan/?date={tomorrow}').status_code, 204)
        self.assertIsNone(self.client.get(f'/api/calendar/day/?date={tomorrow}').data['plan'])

    def test_cannot_plan_a_past_day_or_someone_elses_outfit(self):
        from datetime import timedelta
        from django.utils import timezone
        outfit = self.client.post('/api/recommendations/', {'occasion': 'casual'}, format='json').data['outfits'][0]
        yesterday = timezone.localdate() - timedelta(days=1)
        self.assertEqual(self.client.post('/api/calendar/plan/', {'date': yesterday.isoformat(), 'outfit': outfit['id']}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/calendar/plan/', {'date': timezone.localdate().isoformat(), 'outfit': 'o_nope'}, format='json').status_code, 400)


class AdminPanelTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='boss@example.com', password='admin-pass-1', is_staff=True)
        r = self.client.post('/api/auth/register/', {'email': 'member@example.com', 'password': 'Wardrobe-123', 'display_name': 'Mem'}, format='json')
        self.member_token = r.data['token']
        self.member_id = r.data['user']['id']

    def login(self):
        r = self.client.post('/api/admin/login/', {'email': 'boss@example.com', 'password': 'admin-pass-1'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_only_staff_get_in(self):
        r = self.client.post('/api/admin/login/', {'email': 'member@example.com', 'password': 'Wardrobe-123'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.member_token}')
        self.assertEqual(self.client.get('/api/admin/stats/').status_code, 403)

    def test_feedback_reaches_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.member_token}')
        self.assertEqual(self.client.post('/api/app-feedback/', {'message': '  '}, format='json').status_code, 400)
        r = self.client.post('/api/app-feedback/', {'kind': 'idea', 'message': 'Dark mode please', 'platform': 'ios'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.get('/api/admin/feedback/').status_code, 403)
        self.login()
        data = self.client.get('/api/admin/feedback/?status=open').data
        self.assertEqual((data['count'], data['open']), (1, 1))
        row = data['results'][0]
        self.assertEqual((row['kind'], row['message'], row['user']['email']), ('idea', 'Dark mode please', 'member@example.com'))
        self.assertTrue(self.client.patch(f"/api/admin/feedback/{row['id']}/", {'resolved': True}, format='json').data['resolved'])
        self.assertEqual(self.client.get('/api/admin/stats/').data['open_feedback'], 0)

    def test_stats_users_and_actions(self):
        self.login()
        self.assertEqual(self.client.get('/api/admin/stats/').data['total_users'], 1)
        self.assertEqual(self.client.get('/api/admin/analytics/').status_code, 200)
        users = self.client.get('/api/admin/users/?q=member').data
        self.assertEqual([u['id'] for u in users['results']], [self.member_id])
        r = self.client.patch(f'/api/admin/users/{self.member_id}/', {'plan': 'premium', 'is_active': False}, format='json')
        self.assertEqual((r.data['plan'], r.data['is_active']), ('premium', False))
        self.assertEqual(self.client.get('/api/admin/premium/').data['premium'], 1)
        detail = self.client.get(f'/api/admin/users/{self.member_id}/').data
        self.assertFalse({'garments', 'outfits', 'wear_log', 'plans', 'categories'} & set(detail))
        self.assertEqual(self.client.get('/api/admin/garments/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/admin/users/{self.member_id}/').status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.member_id).exists())


    def test_real_products_with_their_own_link(self):
        from django.core.management import call_command
        from .models import Product
        call_command('load_catalog', stdout=open('/dev/null', 'w'))
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.member_token}')
        self.assertEqual(self.client.get('/api/admin/products/').status_code, 403)
        self.login()
        url = 'https://www.trendyol.com/nike/court-vision-beyaz-sneaker-p-123456'
        guess = self.client.post('/api/admin/products/guess/', {'url': url}, format='json').data
        self.assertEqual((guess['store'], guess['color'], guess['search']), ('Trendyol', 'white', False))
        form = {'url': 'https://www.trendyol.com/sr?q=beyaz+sneaker', 'name': 'Court Vision', 'price': '2499.90',
                'currency': 'TRY', 'subcategory': 'sneakers', 'color': 'white', 'gender': 'unisex'}
        r = self.client.post('/api/admin/products/', form, format='json')
        self.assertEqual((r.status_code, r.data['fields']), (400, {'url': 'search'}))  # a search page lists many pieces
        r = self.client.post('/api/admin/products/', {**form, 'url': url}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.data['store'], r.data['category'], r.data['is_demo']), ('Trendyol', 'shoes', False))
        pid = r.data['id']
        self.assertEqual(self.client.get('/api/admin/products/', {'kind': 'real'}).data['count'], 1)

        # The member's "complete your wardrobe" pick for white sneakers now names that one piece.
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.member_token}')
        pick = next(i for i in self.client.get('/api/shopping/').data['suggestions'] if i['subcategory'] == 'sneakers')
        self.assertEqual([p['id'] for p in pick['products']], [pid])
        shop = self.client.post(f'/api/products/{pid}/action/', {'action': 'shop'}, format='json').data
        self.assertTrue(shop['url'].startswith(url + '?utm_source=wearwise'))
        boots = self.client.post('/api/shopping/check/', {'subcategory': 'boots', 'color': 'black'}, format='json').data
        self.assertEqual(boots['products'], [])  # none added: the app falls back to the store searches
        self.assertTrue(boots['links'])

        # A deploy reloads the demo rows and leaves the real piece alone; demo rows are switched off, not deleted.
        call_command('load_catalog', stdout=open('/dev/null', 'w'))
        self.assertEqual(Product.objects.get(pk=pid).url, url)
        self.login()
        demo = Product.objects.filter(is_demo=True).first()
        self.assertEqual(self.client.delete(f'/api/admin/products/{demo.pk}/').status_code, 400)
        r = self.client.patch(f'/api/admin/products/{demo.pk}/', {'active': False, 'url': url}, format='json')
        self.assertEqual((r.data['active'], r.data['url'] == url), (False, False))
        r = self.client.patch(f'/api/admin/products/{pid}/', {'price': '1999'}, format='json')
        self.assertEqual(r.data['price'], 1999.0)
        self.assertEqual(self.client.delete(f'/api/admin/products/{pid}/').status_code, 204)


class ClientContextTests(APITestCase):
    """Platform, version, countries and last-seen from the app's headers; crashes, server errors and the install source."""

    def setUp(self):
        self.admin = User.objects.create_user(email='boss2@example.com', password='admin-pass-1', is_staff=True)
        r = self.client.post('/api/auth/register/', {'email': 'phone@example.com', 'password': 'Wardrobe-123', 'display_name': 'Phone'}, format='json')
        self.token = r.data['token']
        self.user = User.objects.get(email='phone@example.com')

    def as_member(self, **headers):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token}', **headers)

    def as_admin(self):
        r = self.client.post('/api/admin/login/', {'email': 'boss2@example.com', 'password': 'admin-pass-1'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_headers_are_stored_validated_and_never_blanked(self):
        self.as_member(HTTP_X_PLATFORM='android', HTTP_X_APP_VERSION='1.2.0', HTTP_X_COUNTRY='az-AZ',
                       HTTP_X_FORWARDED_FOR='1.2.3.4, 8.8.8.8')
        self.client.get('/api/auth/me/')
        self.user.refresh_from_db()
        self.assertEqual((self.user.platform, self.user.app_version, self.user.device_country), ('android', '1.2.0', 'AZ'))
        self.assertIsNotNone(self.user.last_seen_at)
        # Junk is dropped and a missing header keeps what was known.
        self.as_member(HTTP_X_PLATFORM='toaster', HTTP_X_APP_VERSION='<script>', HTTP_X_COUNTRY='Mars')
        User.objects.filter(pk=self.user.pk).update(last_seen_at=None)
        self.client.get('/api/auth/me/')
        self.user.refresh_from_db()
        self.assertEqual((self.user.platform, self.user.app_version, self.user.device_country), ('android', '1.2.0', 'AZ'))
        self.assertIsNotNone(self.user.last_seen_at)

    def test_install_source_first_answer_stays(self):
        self.as_member()
        self.assertEqual(self.client.post('/api/me/install/', {}, format='json').status_code, 400)
        r = self.client.post('/api/me/install/', {'utm_source': 'Instagram', 'utm_medium': 'cpc', 'utm_campaign': 'nov'}, format='json')
        self.assertEqual(r.data['install_source'], 'instagram')
        self.client.post('/api/me/install/', {'utm_source': 'google-play'}, format='json')
        self.user.refresh_from_db()
        self.assertEqual((self.user.install_source, self.user.install_medium), ('instagram', 'cpc'))

    def test_crashes_and_server_errors_reach_admin(self):
        from unittest import mock
        from .models import CrashReport, ServerError
        self.client.credentials(HTTP_X_PLATFORM='ios', HTTP_X_APP_VERSION='1.0.3')  # signed out still reports
        self.assertEqual(self.client.post('/api/crash/', {'message': ''}, format='json').status_code, 400)
        r = self.client.post('/api/crash/', {'message': 'TypeError: x is undefined', 'stack': 'at Closet', 'fatal': True}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual((CrashReport.objects.get().platform, CrashReport.objects.get().app_version), ('ios', '1.0.3'))

        # A 500 is recorded once, then counted.
        self.as_member()
        self.client.raise_request_exception = False
        with mock.patch('api.views.read_plan', side_effect=RuntimeError('boom')):
            for _ in range(2):
                self.assertEqual(self.client.post('/api/plan/read/', {'text': 'x'}, format='json').status_code, 500)
        e = ServerError.objects.get()
        self.assertEqual((e.message, e.endpoint, e.count), ('RuntimeError: boom', '/api/plan/read/', 2))
        self.assertIn('RuntimeError', e.traceback)

        self.as_member()
        self.assertEqual(self.client.get('/api/admin/errors/').status_code, 403)
        self.as_admin()
        data = self.client.get('/api/admin/errors/', {'kind': 'server'}).data
        self.assertEqual((data['open'], data['count']), ({'crash': 1, 'server': 1}, 1))
        r = self.client.patch(f'/api/admin/errors/server/{e.pk}/', {'resolved': True}, format='json')
        self.assertTrue(r.data['resolved'])
        self.assertEqual(self.client.get('/api/admin/errors/', {'kind': 'server'}).data['count'], 0)
        self.assertEqual(self.client.get('/api/admin/stats/').data['open_errors'], 1)

    def test_admin_sees_and_filters_client_info(self):
        self.as_member(HTTP_X_PLATFORM='android', HTTP_X_APP_VERSION='1.2.0', HTTP_X_COUNTRY='TR')
        self.client.get('/api/auth/me/')
        self.client.post('/api/me/install/', {'utm_source': 'tiktok'}, format='json')
        self.as_admin()
        row = self.client.get('/api/admin/users/', {'platform': 'android'}).data['results'][0]
        self.assertEqual((row['platform'], row['app_version'], row['device_country'], row['install_source']),
                         ('android', '1.2.0', 'TR', 'tiktok'))
        self.assertEqual(self.client.get('/api/admin/users/', {'platform': 'ios'}).data['count'], 0)
        self.assertEqual(self.client.get('/api/admin/users/', {'country': 'TR'}).data['count'], 1)
        self.assertEqual(self.client.get('/api/admin/users/', {'sort': '-last_seen_at'}).status_code, 200)
        detail = self.client.get(f'/api/admin/users/{self.user.pk}/').data
        self.assertEqual(detail['install_source'], 'tiktok')
        a = self.client.get('/api/admin/analytics/').data
        self.assertIn({'name': 'android', 'value': 1}, a['platforms'])
        self.assertIn({'name': 'tiktok', 'value': 1}, a['install_sources'])


class LocaleTests(APITestCase):
    def test_every_language_has_every_sentence_with_its_placeholders(self):
        import json
        import re
        from pathlib import Path
        from .locale import LANGS
        base = Path(__file__).parent / 'locales'
        src = json.loads((base / '_source.json').read_text(encoding='utf-8'))
        holes = lambda t: set(re.findall(r'\{(\w+)\}', t))
        for lang in LANGS:
            if lang in ('az', 'en'):
                continue
            cat = json.loads((base / f'{lang}.json').read_text(encoding='utf-8'))
            for en in src['text']:
                self.assertIn(en, cat['text'], f'{lang}: {en}')
                self.assertLessEqual(holes(cat['text'][en]), holes(en), f'{lang}: {en}')
            for kind, keys in src['names'].items():
                self.assertLessEqual(set(keys), set(cat['names'][kind]), f'{lang} names.{kind}')

    def test_header_picks_language_and_replies_follow_it(self):
        from .locale import lang_from_header
        self.assertEqual(lang_from_header('ru-RU,ru;q=0.9,en;q=0.8'), 'ru')
        self.assertEqual(lang_from_header('fr-FR,es;q=0.5'), 'es')
        self.assertEqual(lang_from_header('zh-CN'), 'en')  # not offered for now
        self.assertEqual(lang_from_header('de'), 'en')
        r = self.client.post('/api/auth/register/', {'email': 'l@example.com', 'password': 'Wardrobe-123', 'display_name': 'L'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.client.post('/api/garments/sample/')
        for lang, probe in [('ru', 'Что мне надеть завтра?'), ('tr', 'Yarın ne giysem?'), ('es', '¿Qué me pongo mañana?')]:
            r = self.client.post('/api/assistant/', {'message': probe}, format='json', HTTP_ACCEPT_LANGUAGE=lang)
            self.assertEqual(r.status_code, 200, (lang, r.data))
            self.assertTrue(r.data['outfits'], lang)
            self.assertNotIn('Here are', r.data['reply'], lang)  # answered in the language, not English
            self.assertNotIn('{', r.data['reply'], lang)
            titles = [o['title'] for o in r.data['outfits']]
            self.assertTrue(all(t and '{' not in t for t in titles), (lang, titles))


class AboutYouTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'me2@example.com', 'password': 'Wardrobe-123', 'display_name': 'Me'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_profile_saves_and_validates(self):
        r = self.client.patch('/api/auth/me/', {
            'gender': 'female', 'birth_year': 1995, 'height_cm': 168, 'weight_kg': 60, 'body_shape': 'hourglass',
            'fit_preference': 'relaxed', 'budget': 'mid', 'avoid_colors': ['orange'], 'sizes': {'top': 'M', 'bottom': 'S', 'shoes': '38'},
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['height_cm'], r.data['avoid_colors'], r.data['sizes']['top']), (168, ['orange'], 'M'))
        self.assertEqual(self.client.patch('/api/auth/me/', {'height_cm': 20}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/me/', {'birth_year': 1800}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/me/', {'gender': 'robot'}, format='json').status_code, 400)
        r = self.client.patch('/api/auth/me/', {'favorite_colors': ['orange', 'navy'], 'avoid_colors': ['orange']}, format='json')
        self.assertEqual(r.data['favorite_colors'], ['navy'])  # cannot both love and avoid a colour

    def test_avoided_colour_and_fit_move_scores(self):
        from types import SimpleNamespace
        from .engine.harmony import PairTable
        from .engine.scoring import fit_bonus, score_color
        g = lambda c, fit='regular': SimpleNamespace(primary_color=c, pattern='solid', fit=fit)
        taste = SimpleNamespace(liked_colors=[], disliked_colors=[])
        look = {'top': g('orange'), 'bottom': g('navy')}
        self.assertLess(score_color(look, PairTable(), taste, avoid=['orange']), score_color(look, PairTable(), taste))
        loose = {'top': g('white', 'oversized'), 'bottom': g('navy', 'relaxed')}
        self.assertGreater(fit_bonus(loose, 'relaxed'), fit_bonus(loose, 'slim'))

    def test_admin_never_sees_body_details(self):
        self.client.patch('/api/auth/me/', {'height_cm': 170, 'weight_kg': 70, 'sizes': {'top': 'L'}}, format='json')
        me = self.client.get('/api/auth/me/').data['id']
        User.objects.create_user(email='boss2@example.com', password='admin-pass-1', is_staff=True)
        t = self.client.post('/api/admin/login/', {'email': 'boss2@example.com', 'password': 'admin-pass-1'}, format='json').data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {t}')
        d = self.client.get(f'/api/admin/users/{me}/').data
        for k in ('height_cm', 'weight_kg', 'sizes', 'body_shape', 'birth_year', 'gender'):
            self.assertNotIn(k, d)


class CatalogTests(APITestCase):
    """MVP v2: Discovery, the wishlist with price watch, Home and dates."""

    def setUp(self):
        from django.core.management import call_command
        call_command('load_catalog', verbosity=0)
        r = self.client.post('/api/auth/register/', {'email': 'shopper@example.com', 'password': 'Wardrobe-123', 'display_name': 'S'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.client.patch('/api/auth/me/', {
            'gender': 'female', 'age_range': '25-34', 'country': 'TR', 'preferred_styles': ['minimal', 'old_money'],
            'favorite_colors': ['beige', 'cream'], 'avoid_colors': ['orange'], 'budget_ranges': ['30-60', '60-120'],
            'stores': ['Mango', 'COS'], 'onboarded': True,
        }, format='json')

    def test_profile_v2_validates(self):
        self.assertEqual(self.client.patch('/api/auth/me/', {'budget_ranges': ['cheap']}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/me/', {'stores': ['Nowhere']}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/me/', {'preferred_styles': ['quiet_luxury', 'y2k']}, format='json').status_code, 200)

    def test_discovery_drop_is_stable_learns_and_explains(self):
        d = self.client.get('/api/discover/').data
        self.assertEqual(len(d['products']), 10)  # the first drop is ten pieces
        self.assertTrue(all(p['why'] for p in d['products']))
        self.assertTrue(all(55 <= p['match'] <= 98 for p in d['products']))
        self.assertGreaterEqual(d['products'][0]['match'], d['products'][-1]['match'])
        self.assertFalse([p for p in d['products'] if p['color'] == 'orange'])
        self.assertEqual([p['id'] for p in self.client.get('/api/discover/').data['products']], [p['id'] for p in d['products']])
        first = d['products'][0]
        r = self.client.post(f"/api/products/{first['id']}/action/", {'action': 'like'}, format='json')
        self.assertGreater(r.data['learned'], d['learned'])
        self.assertNotIn(first['id'], [p['id'] for p in self.client.get('/api/discover/').data['products']])
        self.assertEqual(self.client.post(f"/api/products/{first['id']}/action/", {'action': 'love'}, format='json').status_code, 400)

    def test_save_shop_and_price_watch(self):
        from .models import AffiliateClick, Product
        coat = Product.objects.get(name='Wool blend coat')
        r = self.client.post(f'/api/products/{coat.id}/action/', {'action': 'save'}, format='json')
        self.assertTrue(r.data['saved'])
        r = self.client.post(f'/api/products/{coat.id}/action/', {'action': 'shop'}, format='json')
        self.assertIn('sub_id=ww_', r.data['url'])
        self.assertEqual(AffiliateClick.objects.count(), 1)
        self.assertEqual(self.client.patch(f'/api/saved/{coat.id}/', {'tracking': True}, format='json').data['tracking'], True)
        coat.price = 79
        coat.save()
        items = self.client.get('/api/saved/').data['items']
        self.assertEqual(items[0]['drop'], [98.0, 79.0])
        self.assertEqual(self.client.get('/api/home/').data['price_drops'][0]['drop'], [98.0, 79.0])
        self.assertTrue(self.client.get('/api/discover/').data['products'][0]['saved'] in (True, False))
        self.assertEqual(self.client.delete(f'/api/saved/{coat.id}/').status_code, 204)
        self.assertEqual(self.client.get('/api/saved/').data['items'], [])

    def test_free_plan_watches_five(self):
        from .models import Product
        ids = list(Product.objects.values_list('id', flat=True)[:6])
        for i in ids:
            self.client.post('/api/saved/', {'product': i}, format='json')
        for i in ids[:5]:
            self.assertEqual(self.client.patch(f'/api/saved/{i}/', {'tracking': True}, format='json').status_code, 200)
        r = self.client.patch(f'/api/saved/{ids[5]}/', {'tracking': True}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (402, 'tracking_limit'))

    def test_home_and_occasions(self):
        from datetime import timedelta
        from django.utils import timezone
        h = self.client.get('/api/home/').data
        self.assertTrue(h['look']['items'])
        self.assertEqual(len(h['picks']), 4)
        soon = (timezone.localdate() + timedelta(days=10)).isoformat()
        later = (timezone.localdate() + timedelta(days=40)).isoformat()
        r = self.client.post('/api/occasions/', {'title': 'Leyla’s wedding', 'date': soon, 'kind': 'wedding'}, format='json')
        self.assertEqual((r.status_code, r.data['ready'], r.data['remind']), (201, True, False))
        self.client.post('/api/occasions/', {'title': 'New Year', 'date': later, 'kind': 'holiday'}, format='json')
        self.assertEqual(self.client.get('/api/home/').data['occasion']['title'], 'Leyla’s wedding')
        looks = self.client.get(f"/api/occasions/{r.data['id']}/").data['looks']
        self.assertEqual(len(looks), 3)
        self.assertTrue(all(len(l['items']) >= 2 for l in looks))
        for person in ('Anar', 'Mum'):
            self.assertEqual(self.client.post('/api/occasions/', {'title': f'{person} birthday', 'date': later, 'kind': 'birthday',
                                                                   'for_gift': True, 'person': person}, format='json').status_code, 201)
        r = self.client.post('/api/occasions/', {'title': 'Third', 'date': later, 'kind': 'birthday', 'for_gift': True, 'person': 'Sis'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (402, 'gift_limit'))


    def test_suits_me_reads_links_judges_and_limits(self):
        from .catalog import read_link
        self.assertEqual(read_link('https://www.asos.com/x/mustard-ribbed-jumper/prd/123'), ('sweater', 'mustard'))
        self.assertEqual(read_link('https://www.trendyol.com/lacivert-kazak-p-1'), ('sweater', 'navy'))
        r = self.client.post('/api/suits-me/', {'link': 'https://shop.example/beige-linen-shirt'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['color_fit'], r.data['style_ok']), ('love', True))
        self.assertIn(r.data['verdict'], ('great', 'good'))
        self.assertEqual(r.data['left'], 4)
        r = self.client.post('/api/suits-me/', {'link': 'https://shop.example/orange-shirt'}, format='json')
        self.assertEqual((r.data['verdict'], r.data['color_fit']), ('risky', 'avoid'))
        self.assertTrue(r.data['alternatives'])
        self.assertTrue(all(p['color'] != 'orange' for p in r.data['alternatives']))
        self.assertEqual(self.client.post('/api/suits-me/', {'link': 'https://x.example/abc'}, format='json').data['code'], 'link_unreadable')
        for _ in range(3):
            self.client.post('/api/suits-me/', {'link': 'https://shop.example/navy-jeans'}, format='json')
        r = self.client.post('/api/suits-me/', {'link': 'https://shop.example/navy-jeans'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (402, 'checks_used'))


    def test_shared_inspiration_teaches_taste(self):
        from .catalog import learned_taste
        from .models import User
        user = User.objects.get(email='shopper@example.com')
        before = learned_taste(user)
        r = self.client.post('/api/inspirations/', {'link': 'https://www.zara.com/az/en/burgundy-satin-skirt-p123.html', 'note': 'love this'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data['subcategory'], r.data['color']), ('skirt', 'burgundy'))
        after = learned_taste(user)
        self.assertGreater(after['c:burgundy'], before['c:burgundy'])
        self.assertGreater(after['t:skirt'], before['t:skirt'])
        photo = SimpleUploadedFile('look.png', png((30, 40, 80)).read(), 'image/png')
        r = self.client.post('/api/inspirations/', {'image': photo}, format='multipart')
        self.assertEqual((r.status_code, r.data['color']), (201, 'navy'))
        self.assertEqual(len(self.client.get('/api/inspirations/').data['items']), 2)
        self.assertEqual(self.client.post('/api/inspirations/', {'link': 'not a link'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(f"/api/inspirations/{r.data['id']}/").status_code, 204)
        self.assertEqual(len(self.client.get('/api/inspirations/').data['items']), 1)


class VoiceOffTests(APITestCase):
    def test_shared_server_never_loads_local_models(self):
        from unittest import mock
        from django.core.files.uploadedfile import SimpleUploadedFile
        from . import speech
        with mock.patch.dict('os.environ', {'WEARWISE_LOCAL_VOICE': '0', 'GROQ_API_KEY': '', 'OPENAI_API_KEY': ''}), \
                mock.patch.object(speech, '_get_model', side_effect=AssertionError('loaded')):
            self.assertIsNone(speech.transcribe(SimpleUploadedFile('q.m4a', b'x'), 'en'))
            speech.warm_up()  # returns without starting a load



class OccasionOutfitTests(APITestCase):
    def setUp(self):
        from django.core.management import call_command
        call_command('load_catalog', verbosity=0)
        r = self.client.post('/api/auth/register/', {'email': 'shopper@example.com', 'password': 'Wardrobe-123', 'display_name': 'S'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_date_can_wear_my_own_outfit(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import User
        user = User.objects.get(email='shopper@example.com')
        self.client.post('/api/garments/sample/')
        top = next(g.id for g in Garment.objects.filter(user=user, category='top'))
        bottom = next(g.id for g in Garment.objects.filter(user=user, category='bottom'))
        shoes = next(g.id for g in Garment.objects.filter(user=user, category='shoes'))
        built = self.client.post('/api/check-outfit/', {'garment_ids': [top, bottom, shoes], 'occasion': 'formal', 'save': True}, format='json').data['outfit']
        day = (timezone.localdate() + timedelta(days=20)).isoformat()
        o = self.client.post('/api/occasions/', {'title': 'Toy', 'date': day, 'kind': 'wedding'}, format='json').data
        r = self.client.patch(f"/api/occasions/{o['id']}/", {'outfit': built['id']}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['outfit']['id'], built['id'])
        self.assertEqual(len(r.data['looks']), 3)  # the store's ideas stay
        self.assertIsNone(self.client.patch(f"/api/occasions/{o['id']}/", {'outfit': None}, format='json').data['outfit'])
        self.assertEqual(self.client.patch(f"/api/occasions/{o['id']}/", {'outfit': 'o_nope'}, format='json').status_code, 404)


class FitAndSizeTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'fit@example.com', 'password': 'Wardrobe-123', 'display_name': 'F'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_several_fits_tailoring_sizes_and_new_stores(self):
        r = self.client.patch('/api/auth/me/', {
            'fit_preferences': ['slim', 'regular'], 'stores': ['Temu', 'eBay', 'Amazon'],
            'sizes': {'top': 'L', 'bottom': '32', 'length': '30', 'jacket': '50', 'drop': '4', 'shoes': '43'},
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['fit_preferences'], r.data['fit_preference']), (['slim', 'regular'], 'slim'))
        self.assertEqual((r.data['sizes']['jacket'], r.data['sizes']['drop'], r.data['sizes']['length']), ('50', '4', '30'))
        self.assertEqual(self.client.patch('/api/auth/me/', {'fit_preferences': ['baggy']}, format='json').status_code, 400)
        from types import SimpleNamespace
        from .engine.scoring import fit_bonus
        g = lambda fit: SimpleNamespace(fit=fit)
        slim_look = {'top': g('slim'), 'bottom': g('slim')}
        self.assertEqual(fit_bonus(slim_look, ['regular', 'slim']), fit_bonus(slim_look, 'slim'))


class TypeSwipeTests(APITestCase):
    def setUp(self):
        from django.core.management import call_command
        call_command('load_catalog', verbosity=0)
        r = self.client.post('/api/auth/register/', {'email': 'swipe@example.com', 'password': 'Wardrobe-123', 'display_name': 'S'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_swipes_steer_discovery(self):
        self.assertEqual(self.client.patch('/api/auth/me/', {'type_prefs': {'polo': 2}}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/me/', {'type_prefs': {'nope': 1}}, format='json').status_code, 400)
        r = self.client.patch('/api/auth/me/', {'gender': 'female', 'type_prefs': {'boots': 1, 'sneakers': -1}}, format='json')
        self.assertEqual(r.status_code, 200)
        picks = self.client.get('/api/discover/').data['products']
        kinds = [p['subcategory'] for p in picks]
        self.assertIn('boots', kinds[:3])
        self.assertNotIn('sneakers', kinds[:5])
        boot = next(p for p in picks if p['subcategory'] == 'boots')
        self.assertIn('yes', boot['why'].lower())


class LegalPagesTests(APITestCase):
    def test_privacy_and_delete_pages_are_public(self):
        for url, text in (('/privacy/', 'Privacy policy'), ('/delete-account/', 'Delete your WearWise AI account')):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 200)
            self.assertContains(r, text)

    def test_support_email_is_shown_when_set(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {'SUPPORT_EMAIL': 'help@example.com'}):
            self.assertContains(self.client.get('/delete-account/'), 'mailto:help@example.com')

    def test_deleting_account_removes_inspiration_photos(self):
        from django.core.files.base import ContentFile
        from .models import Inspiration
        r = self.client.post('/api/auth/register/', {'email': 'del@example.com', 'password': 'Wardrobe-123', 'display_name': 'Del'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        user = User.objects.get(email='del@example.com')
        insp = Inspiration(user=user)
        insp.image.save('i.png', ContentFile(png((200, 50, 50)).read()), save=True)
        storage, name = insp.image.storage, insp.image.name
        self.assertTrue(storage.exists(name))
        self.assertEqual(self.client.delete('/api/auth/me/').status_code, 204)
        self.assertFalse(storage.exists(name))


class PasswordSecurityTests(APITestCase):
    def signup(self, email='pw@example.com', password='Wardrobe-123'):
        return self.client.post('/api/auth/register/', {'email': email, 'password': password, 'display_name': 'Pat'}, format='json')

    def test_weak_passwords_are_refused(self):
        for weak in ('wardrobe-123', 'WARDROBE-123', 'Wardrobe-abc', 'Wardrobe123', 'Ab1!', '12345678', 'pw@Example1'):
            r = self.signup(password=weak)
            self.assertEqual(r.status_code, 400, weak)
            self.assertIn('password', r.data, weak)
        self.assertEqual(self.signup().status_code, 201)

    def test_has_password_flag(self):
        r = self.signup()
        self.assertTrue(r.data['user']['has_password'])

    def test_forgot_and_reset_password(self):
        from unittest import mock
        from .models import PasswordResetCode
        self.signup()
        old_token = Token.objects.get(user__email='pw@example.com').key
        with mock.patch('api.emails.send_email', return_value=True) as send:
            self.assertEqual(self.client.post('/api/auth/forgot-password/', {'email': 'PW@example.com'}, format='json').status_code, 200)
            # Unknown addresses get the same answer and no mail.
            self.assertEqual(self.client.post('/api/auth/forgot-password/', {'email': 'nobody@example.com'}, format='json').status_code, 200)
        self.assertEqual(send.call_count, 1)
        code = PasswordResetCode.objects.get(user__email='pw@example.com', used=False).code
        self.assertIn(code, send.call_args.args[2])
        wrong = '000000' if code != '000000' else '111111'
        r = self.client.post('/api/auth/reset-password/', {'email': 'pw@example.com', 'code': wrong, 'password': 'Newpass-456'}, format='json')
        self.assertEqual(r.data['code'], 'invalid_code')
        r = self.client.post('/api/auth/reset-password/', {'email': 'pw@example.com', 'code': code, 'password': 'weakpass'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/auth/reset-password/', {'email': 'pw@example.com', 'code': code, 'password': 'Newpass-456'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertNotEqual(r.data['token'], old_token)
        self.assertFalse(Token.objects.filter(key=old_token).exists())
        # Single use.
        r = self.client.post('/api/auth/reset-password/', {'email': 'pw@example.com', 'code': code, 'password': 'Other-pass-789'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login/', {'email': 'pw@example.com', 'password': 'Newpass-456'}, format='json').status_code, 200)

    def test_reset_code_is_burnt_after_five_wrong_guesses(self):
        from unittest import mock
        from .models import PasswordResetCode
        self.signup()
        with mock.patch('api.emails.send_email', return_value=True):
            self.client.post('/api/auth/forgot-password/', {'email': 'pw@example.com'}, format='json')
        code = PasswordResetCode.objects.get(used=False).code
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(5):
            self.client.post('/api/auth/reset-password/', {'email': 'pw@example.com', 'code': wrong, 'password': 'Newpass-456'}, format='json')
        r = self.client.post('/api/auth/reset-password/', {'email': 'pw@example.com', 'code': code, 'password': 'Newpass-456'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_forgot_password_reports_mail_failure(self):
        from unittest import mock
        self.signup()
        with mock.patch('api.emails.send_email', return_value=False):
            r = self.client.post('/api/auth/forgot-password/', {'email': 'pw@example.com'}, format='json')
        self.assertEqual(r.status_code, 502)
        self.assertEqual(r.data['code'], 'mail_failed')

    def test_change_password(self):
        r = self.signup()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        bad = self.client.post('/api/auth/change-password/', {'current_password': 'nope', 'new_password': 'Newpass-456'}, format='json')
        self.assertEqual(bad.data['code'], 'wrong_password')
        weak = self.client.post('/api/auth/change-password/', {'current_password': 'Wardrobe-123', 'new_password': 'newpass'}, format='json')
        self.assertEqual(weak.status_code, 400)
        ok = self.client.post('/api/auth/change-password/', {'current_password': 'Wardrobe-123', 'new_password': 'Newpass-456'}, format='json')
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertNotEqual(ok.data['token'], r.data['token'])
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)  # the old token is gone
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {ok.data['token']}")
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)

    def test_social_account_sets_first_password_without_current(self):
        user = User.objects.create_user(email='social@example.com', password=None, display_name='Sam')
        self.client.force_authenticate(user)
        self.assertFalse(self.client.get('/api/auth/me/').data['has_password'])
        r = self.client.post('/api/auth/change-password/', {'new_password': 'Newpass-456'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('Newpass-456'))


class FeedbackDeletionAndTermsTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'fb@example.com', 'password': 'Wardrobe-123', 'display_name': 'Fay'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")

    def test_account_deletion_removes_feedback_screenshots(self):
        from .models import AppFeedback, AppFeedbackShot
        self.client.post('/api/app-feedback/', {'kind': 'problem', 'message': 'x', 'screenshots': [SimpleUploadedFile('a.png', png((1, 2, 3)).read(), 'image/png')]}, format='multipart')
        shot = AppFeedbackShot.objects.get()
        storage, name = shot.image.storage, shot.image.name
        self.assertEqual(self.client.delete('/api/auth/me/').status_code, 204)
        self.assertFalse(storage.exists(name))
        self.assertFalse(AppFeedbackShot.objects.exists())
        self.assertEqual(AppFeedback.objects.get().message, 'x')

    def test_terms_page(self):
        r = self.client.get('/terms/')
        self.assertContains(r, 'Terms of use')
