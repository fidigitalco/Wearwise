"""
The password rule the app shows live on its forms, enforced again here so it
holds for every client: upper and lower case letters, a digit and a symbol.
Length, common passwords, all-digit passwords and passwords close to the
email or name are covered by Django's own validators (settings.py).
"""
import re

from django.core.exceptions import ValidationError

SYMBOL = re.compile(r'[^\w\s]|_')


class ComplexityValidator:
    def validate(self, password, user=None):
        missing = []
        if not (re.search(r'[a-z]', password) and re.search(r'[A-Z]', password)):
            missing.append('upper and lower case letters')
        if not re.search(r'\d', password):
            missing.append('a number')
        if not SYMBOL.search(password):
            missing.append('a symbol')
        if missing:
            raise ValidationError(f'The password needs {", ".join(missing)}.', code='password_too_simple')

    def get_help_text(self):
        return 'Your password must mix upper and lower case letters, a number and a symbol.'
