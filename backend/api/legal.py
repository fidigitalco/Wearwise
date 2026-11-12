"""
Public pages the app stores require: the privacy policy and how to delete an
account. Plain HTML at /privacy/ and /delete-account/, no login.

SUPPORT_EMAIL is the address people write to about their data.
"""
import os

from django.shortcuts import render

UPDATED = '12 November 2026'


def _context():
    return {'email': os.environ.get('SUPPORT_EMAIL', '').strip(), 'updated': UPDATED}


def privacy(request):
    return render(request, 'legal/privacy.html', _context())


def delete_account(request):
    return render(request, 'legal/delete_account.html', _context())
