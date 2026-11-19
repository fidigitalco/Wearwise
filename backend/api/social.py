"""
Sign in with Apple and Google: verify the identity token the app got from the
provider and find or create the matching WearWise user.

The token's audience must be one of ours, configured per environment:
  APPLE_AUDIENCES   comma-separated iOS bundle ids (Expo Go uses host.exp.Exponent)
  GOOGLE_CLIENT_IDS comma-separated OAuth client ids (web, iOS and Android)
A provider with no audience configured is reported as not set up.

Android has no native Apple sign-in, so it uses Apple's web flow: the app opens
`apple_authorize_url` in a browser, Apple posts the result to our callback
(APPLE_REDIRECT_URI, which must be a public https URL registered for the
Services ID APPLE_SERVICES_ID), and the callback hands the identity token back
to the app through its deep link.

Apple also asks apps to revoke a user's Apple tokens when the account is deleted.
That needs a Sign in with Apple key: APPLE_TEAM_ID, APPLE_KEY_ID and the .p8 key
(APPLE_PRIVATE_KEY_PATH, or its text in APPLE_PRIVATE_KEY). With it, the
authorization code the app sends at sign-in is exchanged for a refresh token,
which `apple_revoke` revokes when the account goes. Without it, both are skipped.
"""
import json
import logging
import os
import time
from urllib.parse import urlencode, urlsplit

import jwt
import requests
from django.core import signing
from django.db import transaction

from .models import SocialAccount, TasteProfile, User

APPLE_ISSUER = 'https://appleid.apple.com'
APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'
APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'
APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke'
GOOGLE_ISSUERS = {'accounts.google.com', 'https://accounts.google.com'}

_apple_keys = None
log = logging.getLogger('api.social')


class NotConfigured(Exception):
    pass


class InvalidToken(Exception):
    pass


def _audiences(var):
    return [a.strip() for a in os.environ.get(var, '').split(',') if a.strip()]


def verify_apple(id_token):
    """The verified claims of an Apple identity token (native on iOS, or the web flow's Services ID)."""
    audiences = _audiences('APPLE_AUDIENCES') + _audiences('APPLE_SERVICES_ID')
    if not audiences:
        raise NotConfigured('apple')
    global _apple_keys
    if _apple_keys is None:
        _apple_keys = jwt.PyJWKClient(APPLE_KEYS_URL)
    try:
        key = _apple_keys.get_signing_key_from_jwt(id_token).key
        return jwt.decode(id_token, key, algorithms=['RS256'], audience=audiences, issuer=APPLE_ISSUER)
    except jwt.PyJWTError as e:
        raise InvalidToken(str(e)) from e


def verify_google(id_token):
    """The verified claims of a Google ID token."""
    audiences = _audiences('GOOGLE_CLIENT_IDS')
    if not audiences:
        raise NotConfigured('google')
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        claims = google_id_token.verify_oauth2_token(id_token, google_requests.Request())
    except ValueError as e:
        raise InvalidToken(str(e)) from e
    if claims.get('aud') not in audiences or claims.get('iss') not in GOOGLE_ISSUERS:
        raise InvalidToken('wrong audience or issuer')
    return claims


VERIFY = {'apple': verify_apple, 'google': verify_google}


def user_for(provider, claims, name='', guest=None):
    """
    The user behind verified provider claims: the linked account if there is one,
    else the user with that (verified) email, else a new user (made from `guest`,
    the caller's guest account, when there is one). Returns (user, created).
    """
    sub = claims['sub']
    link = SocialAccount.objects.filter(provider=provider, sub=sub).select_related('user').first()
    if link:
        return link.user, False
    email = (claims.get('email') or '').lower()
    # Apple sends email_verified as a string.
    if not email or str(claims.get('email_verified', 'true')).lower() != 'true':
        raise InvalidToken('the account has no verified email')
    with transaction.atomic():
        user = User.objects.filter(email=email).first()
        created = user is None
        display_name = (name or claims.get('name') or '')[:80]
        if created and guest is not None:
            user = claim_guest(guest, email, display_name)
        elif created:
            user = User.objects.create_user(email=email, password=None, display_name=display_name)
            TasteProfile.objects.create(user=user)
        SocialAccount.objects.create(user=user, provider=provider, sub=sub)
    return user, created


def claim_guest(guest, email, display_name, password=None):
    """Turn a guest account into a real one, keeping its closet and history."""
    guest.email = email.lower()
    guest.display_name = display_name or guest.display_name
    guest.is_guest = False
    if password:
        guest.set_password(password)
    guest.save()
    return guest


# ── Apple web flow (Android) ────────────────────────────────────────────────

APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize'
APP_SCHEMES = {'wearwise', 'exp', 'exps'}
_STATE_SALT = 'apple-web-signin'


def apple_authorize_url(return_url):
    """Apple's sign-in page for the web flow; `return_url` is the app deep link to come back to."""
    services_id = os.environ.get('APPLE_SERVICES_ID', '').strip()
    redirect_uri = os.environ.get('APPLE_REDIRECT_URI', '').strip()
    if not services_id or not redirect_uri:
        raise NotConfigured('apple_web')
    if urlsplit(return_url).scheme not in APP_SCHEMES:
        raise InvalidToken('return_url must be an app link')
    return APPLE_AUTHORIZE_URL + '?' + urlencode({
        'client_id': services_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code id_token',
        # Apple requires form_post when asking for the name or email.
        'response_mode': 'form_post',
        'scope': 'name email',
        'state': signing.dumps(return_url, salt=_STATE_SALT),
    })


def apple_callback_target(form):
    """The app deep link to send the browser to after Apple posts to our callback."""
    try:
        return_url = signing.loads(form.get('state', ''), salt=_STATE_SALT, max_age=600)
    except signing.BadSignature as e:
        raise InvalidToken('bad state') from e
    if urlsplit(return_url).scheme not in APP_SCHEMES:
        raise InvalidToken('bad return url')
    params = {}
    if form.get('id_token'):
        params['id_token'] = form['id_token']
        if form.get('code'):
            params['code'] = form['code']
        # Apple sends the name only on the first sign-in, as JSON in "user".
        try:
            name = json.loads(form.get('user') or '{}').get('name') or {}
            full = ' '.join(filter(None, [name.get('firstName'), name.get('lastName')]))
            if full:
                params['name'] = full
        except (ValueError, AttributeError):
            pass
    else:
        params['error'] = form.get('error') or 'cancelled'
    return return_url + ('&' if '?' in return_url else '?') + urlencode(params)


def _apple_signing_key():
    """(team id, key id, private key) for signing Apple client secrets, or None when not set up."""
    team = os.environ.get('APPLE_TEAM_ID', '').strip()
    kid = os.environ.get('APPLE_KEY_ID', '').strip()
    key = os.environ.get('APPLE_PRIVATE_KEY', '').strip().replace('\\n', '\n')
    path = os.environ.get('APPLE_PRIVATE_KEY_PATH', '').strip()
    if not key and path:
        try:
            with open(path) as f:
                key = f.read().strip()
        except OSError:
            log.warning('Apple private key not readable at %s', path)
            return None
    return (team, kid, key) if team and kid and key else None


def apple_client_secret(client_id):
    """The short-lived ES256 JWT Apple takes as client_secret for `client_id`, or None when not set up."""
    signing_key = _apple_signing_key()
    if not signing_key:
        return None
    team, kid, key = signing_key
    now = int(time.time())
    return jwt.encode({'iss': team, 'iat': now, 'exp': now + 300, 'aud': APPLE_ISSUER, 'sub': client_id},
                      key, algorithm='ES256', headers={'kid': kid})


def apple_keep_refresh_token(claims, code):
    """
    Exchange the sign-in's authorization code for a refresh token and keep it on the linked account,
    so deleting the account can revoke it. Best effort: sign-in never fails because of this.
    """
    client_id = claims.get('aud') or ''
    if isinstance(client_id, list):
        client_id = client_id[0] if client_id else ''
    secret = client_id and apple_client_secret(client_id)
    if not secret or not code:
        return False
    try:
        r = requests.post(APPLE_TOKEN_URL, timeout=10, data={
            'client_id': client_id, 'client_secret': secret, 'code': code, 'grant_type': 'authorization_code'})
        token = r.json().get('refresh_token') if r.ok else None
    except (requests.RequestException, ValueError):
        token = None
    if not token:
        log.warning('Apple code exchange failed for %s', client_id)
        return False
    SocialAccount.objects.filter(provider='apple', sub=claims['sub']).update(
        apple_refresh_token=token, apple_client_id=client_id)
    return True


def apple_revoke(user):
    """Revoke the user's Apple tokens (on account deletion). Best effort; returns how many were revoked."""
    revoked = 0
    for acc in user.social_accounts.filter(provider='apple').exclude(apple_refresh_token=''):
        secret = apple_client_secret(acc.apple_client_id)
        if not secret:
            break
        try:
            r = requests.post(APPLE_REVOKE_URL, timeout=10, data={
                'client_id': acc.apple_client_id, 'client_secret': secret,
                'token': acc.apple_refresh_token, 'token_type_hint': 'refresh_token'})
            revoked += r.ok
            if not r.ok:
                log.warning('Apple token revoke failed (%s) for user %s', r.status_code, user.pk)
        except requests.RequestException:
            log.warning('Apple token revoke failed for user %s', user.pk)
    return revoked
