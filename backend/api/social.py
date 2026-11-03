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
"""
import json
import os
from urllib.parse import urlencode, urlsplit

import jwt
from django.core import signing
from django.db import transaction

from .models import SocialAccount, TasteProfile, User

APPLE_ISSUER = 'https://appleid.apple.com'
APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'
GOOGLE_ISSUERS = {'accounts.google.com', 'https://accounts.google.com'}

_apple_keys = None


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
