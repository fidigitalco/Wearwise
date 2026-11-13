
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import AppFeedback, User

PNG = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
       b'\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82')


class FeedbackShotTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('u@example.com', 'pw-12345678')
        self.c = APIClient()
        self.c.force_authenticate(self.user)

    def shot(self, name='s.png', type_='image/png'):
        return SimpleUploadedFile(name, PNG, content_type=type_)

    def test_screenshots_are_kept_and_shown_to_staff(self):
        r = self.c.post('/api/app-feedback/', {'kind': 'problem', 'message': 'Look', 'platform': 'android',
                                               'screenshots': [self.shot(), self.shot('b.png')]}, format='multipart')
        self.assertEqual(r.status_code, 201)
        fb = AppFeedback.objects.get()
        self.assertEqual(fb.shots.count(), 2)
        staff = User.objects.create_user('s@example.com', 'pw-12345678', is_staff=True)
        a = APIClient(); a.force_authenticate(staff)
        row = a.get('/api/admin/feedback/').json()['results'][0]
        self.assertEqual(len(row['screenshots']), 2)
        self.assertTrue(row['screenshots'][0].startswith('http'))
        self.assertIn('/media/feedback/', row['screenshots'][0])

    def test_a_screenshot_alone_is_enough_and_non_images_are_dropped(self):
        r = self.c.post('/api/app-feedback/', {'kind': 'problem', 'message': '',
                                               'screenshots': [self.shot(), self.shot('x.txt', 'text/plain')]}, format='multipart')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(AppFeedback.objects.get().shots.count(), 1)

    def test_at_most_three(self):
        self.c.post('/api/app-feedback/', {'message': 'many', 'screenshots': [self.shot() for _ in range(5)]}, format='multipart')
        self.assertEqual(AppFeedback.objects.get().shots.count(), 3)
