from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import User

URL = '/api/admin/login/'
SAVEDO = 'https://api.save-do.com/api/admin/login/'


def savedo_says(status, email='admin@savedo.app'):
    r = mock.Mock(status_code=status)
    r.json.return_value = {'token': 'x', 'username': 'admin', 'email': email}
    return r


@override_settings(SAVEDO_ADMIN_LOGIN_URL=SAVEDO)
class SaveDoAdminLoginTests(TestCase):
    def setUp(self):
        self.c = APIClient()

    @mock.patch('api.admin_views.requests.post', return_value=savedo_says(200))
    def test_the_savedo_admin_gets_in_and_a_staff_account_is_made(self, post):
        r = self.c.post(URL, {'email': 'Admin@savedo.app', 'password': 'pw'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        post.assert_called_once()
        u = User.objects.get(email='admin@savedo.app')
        self.assertTrue(u.is_staff)
        self.assertFalse(u.has_usable_password())
        # Again: the same account, no second one.
        self.assertEqual(self.c.post(URL, {'email': 'admin@savedo.app', 'password': 'pw'}, format='json').status_code, 200)
        self.assertEqual(User.objects.filter(email='admin@savedo.app').count(), 1)

    @mock.patch('api.admin_views.requests.post', return_value=savedo_says(401))
    def test_a_wrong_password_at_savedo_is_refused(self, _):
        r = self.c.post(URL, {'email': 'admin@savedo.app', 'password': 'no'}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertFalse(User.objects.filter(email='admin@savedo.app').exists())

    @mock.patch('api.admin_views.requests.post', return_value=savedo_says(200))
    def test_a_wearwise_member_is_never_made_staff(self, _):
        User.objects.create_user(email='admin@savedo.app', password='own')
        r = self.c.post(URL, {'email': 'admin@savedo.app', 'password': 'pw'}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertFalse(User.objects.get(email='admin@savedo.app').is_staff)

    @mock.patch('api.admin_views.requests.post', return_value=savedo_says(200, email='other@savedo.app'))
    def test_savedo_confirming_another_address_does_not_count(self, _):
        r = self.c.post(URL, {'email': 'admin@savedo.app', 'password': 'pw'}, format='json')
        self.assertEqual(r.status_code, 401)

    @mock.patch('api.admin_views.requests.post')
    def test_a_local_staff_password_still_works_without_asking_savedo(self, post):
        User.objects.create_user(email='ww@x.az', password='pw', is_staff=True)
        r = self.c.post(URL, {'email': 'ww@x.az', 'password': 'pw'}, format='json')
        self.assertEqual(r.status_code, 200)
        post.assert_not_called()

    @override_settings(SAVEDO_ADMIN_LOGIN_URL='')
    @mock.patch('api.admin_views.requests.post')
    def test_unset_means_wearwise_accounts_only(self, post):
        r = self.c.post(URL, {'email': 'admin@savedo.app', 'password': 'pw'}, format='json')
        self.assertEqual(r.status_code, 401)
        post.assert_not_called()
