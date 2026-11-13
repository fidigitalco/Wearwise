"""
Outbound email over HTTPS: Resend when RESEND_API_KEY is set, else SendGrid
(SENDGRID_API_KEY). Same approach as SaveDo: HTTPS, not SMTP, so it works on
hosts that block outbound mail ports.

The From address (EMAIL_FROM_ADDRESS) must be on a domain verified with the
provider. send_email() never raises; it returns False when nothing was sent.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RESEND_SEND_URL = 'https://api.resend.com/emails'
SENDGRID_SEND_URL = 'https://api.sendgrid.com/v3/mail/send'


def configured():
    return bool(settings.RESEND_API_KEY or settings.SENDGRID_API_KEY)


def send_email(to, subject, text, reply_to=None):
    """Send one plain-text email. True on success, False otherwise."""
    if settings.RESEND_API_KEY:
        url = RESEND_SEND_URL
        key = settings.RESEND_API_KEY
        payload = {
            'from': f'{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>',
            'to': [to], 'subject': subject, 'text': text,
        }
        if reply_to:
            payload['reply_to'] = reply_to
    elif settings.SENDGRID_API_KEY:
        url = SENDGRID_SEND_URL
        key = settings.SENDGRID_API_KEY
        payload = {
            'personalizations': [{'to': [{'email': to}]}],
            'from': {'email': settings.EMAIL_FROM_ADDRESS, 'name': settings.EMAIL_FROM_NAME},
            'subject': subject,
            'content': [{'type': 'text/plain', 'value': text}],
        }
        if reply_to:
            payload['reply_to'] = {'email': reply_to}
    else:
        logger.warning('No email provider configured; dropping %r to %s', subject, to)
        return False
    try:
        resp = requests.post(url, json=payload, headers={'Authorization': f'Bearer {key}'}, timeout=10)
    except requests.RequestException:
        logger.exception('Email send failed for %r to %s', subject, to)
        return False
    if resp.status_code >= 300:
        logger.error('Email send failed (%s): %s', resp.status_code, resp.text[:500])
        return False
    return True
