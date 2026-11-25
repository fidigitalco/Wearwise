"""
App Store subscriptions (StoreKit 2).

The app buys `app.wearwise.premium.monthly` and sends us the transaction's JWS
(signed by Apple). We check the signature chain up to Apple Root CA - G3, that it
is for our bundle and product, and then set the user's Premium until the paid
period ends. Apple's App Store Server Notifications V2 (POST to
/api/billing/apple/notifications/) keep it in step: renewals extend it, expiry,
refunds and revocations end it.

Premium granted in the admin panel has no App Store subscription and never expires here.
"""
import base64
import logging
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

import jwt
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding
from django.utils import timezone

from .models import User

log = logging.getLogger('api.billing')

BUNDLE_ID = 'app.wearwise'
PRODUCTS = {'app.wearwise.premium.monthly'}
ROOT_CERT = x509.load_der_x509_certificate((Path(__file__).parent / 'certs' / 'AppleRootCA-G3.cer').read_bytes())
# Apple's marker extensions: the signing (leaf) certificate and the WWDR intermediate.
LEAF_OID = x509.ObjectIdentifier('1.2.840.113635.100.6.11.1')
INTERMEDIATE_OID = x509.ObjectIdentifier('1.2.840.113635.100.6.2.1')


class InvalidPurchase(Exception):
    pass


def _has_ext(cert, oid):
    try:
        cert.extensions.get_extension_for_oid(oid)
        return True
    except x509.ExtensionNotFound:
        return False


def verify_jws(token, root=None):
    """The payload of an Apple-signed JWS, after checking its x5c chain ends at Apple's root."""
    root = root or ROOT_CERT
    try:
        header = jwt.get_unverified_header(token)
        chain = [x509.load_der_x509_certificate(base64.b64decode(c)) for c in header.get('x5c') or []]
    except (jwt.PyJWTError, ValueError, TypeError) as e:
        raise InvalidPurchase('unreadable JWS') from e
    if header.get('alg') != 'ES256' or len(chain) != 3:
        raise InvalidPurchase('unexpected JWS header')
    leaf, intermediate, top = chain
    if top.public_bytes(Encoding.DER) != root.public_bytes(Encoding.DER):
        raise InvalidPurchase('not signed by Apple')
    if root is ROOT_CERT and not (_has_ext(leaf, LEAF_OID) and _has_ext(intermediate, INTERMEDIATE_OID)):
        raise InvalidPurchase('not an App Store signing certificate')
    now = datetime.now(dt_timezone.utc)
    for cert, issuer in ((leaf, intermediate), (intermediate, top)):
        try:
            issuer.public_key().verify(cert.signature, cert.tbs_certificate_bytes, ec.ECDSA(cert.signature_hash_algorithm))
        except (InvalidSignature, TypeError, AttributeError) as e:
            raise InvalidPurchase('broken certificate chain') from e
        if not (cert.not_valid_before_utc <= now <= cert.not_valid_after_utc):
            raise InvalidPurchase('certificate out of date')
    try:
        return jwt.decode(token, leaf.public_key(), algorithms=['ES256'], options={'verify_aud': False})
    except jwt.PyJWTError as e:
        raise InvalidPurchase('bad signature') from e


def _ms(value):
    return datetime.fromtimestamp(int(value) / 1000, tz=dt_timezone.utc) if value else None


def apply_transaction(user, tx):
    """Set the user's Premium from a verified transaction payload. Returns the user."""
    if tx.get('bundleId') != BUNDLE_ID or tx.get('productId') not in PRODUCTS:
        raise InvalidPurchase('not a WearWise subscription')
    until = None if tx.get('revocationDate') else _ms(tx.get('expiresDate'))
    original = str(tx.get('originalTransactionId') or '')
    # A subscription belongs to one WearWise account: buying or restoring it here moves it here.
    if original:
        User.objects.filter(apple_original_transaction_id=original).exclude(pk=user.pk).update(
            apple_original_transaction_id='', premium_until=None, plan='free')
        user.apple_original_transaction_id = original
    # Only move the end date forward: an older transaction replayed later must not shorten it.
    if until is None or not user.premium_until or until > user.premium_until or tx.get('revocationDate'):
        user.premium_until = until
    user.plan = 'premium' if user.premium_until and user.premium_until > timezone.now() else 'free'
    user.save(update_fields=['plan', 'premium_until', 'apple_original_transaction_id'])
    return user


def expire_if_due(user):
    """Drop an App Store Premium whose paid period is over (a missed expiry notification)."""
    if user.plan == 'premium' and user.apple_original_transaction_id and user.premium_until \
            and user.premium_until < timezone.now():
        user.plan = 'free'
        user.save(update_fields=['plan'])
    return user


def handle_notification(signed_payload):
    """An App Store Server Notification V2. Returns what it did, for the log."""
    note = verify_jws(signed_payload)
    data = note.get('data') or {}
    if data.get('bundleId') != BUNDLE_ID:
        raise InvalidPurchase('other app')
    kind = note.get('notificationType', '')
    signed_tx = data.get('signedTransactionInfo')
    if not signed_tx:
        return f'{kind}: no transaction'
    tx = verify_jws(signed_tx)
    original = str(tx.get('originalTransactionId') or '')
    user = User.objects.filter(apple_original_transaction_id=original).first() if original else None
    if user is None:
        return f'{kind}: no account for {original}'
    if kind in ('EXPIRED', 'REFUND', 'REVOKE', 'GRACE_PERIOD_EXPIRED'):
        user.plan = 'free'
        if kind != 'EXPIRED':
            user.premium_until = None
        user.save(update_fields=['plan', 'premium_until'])
    else:
        apply_transaction(user, tx)
    return f'{kind}: user {user.pk} {user.plan}'
