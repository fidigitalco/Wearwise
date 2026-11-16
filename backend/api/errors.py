"""
Error responses the app can translate.

DRF answers a refused form with English messages per field. The app speaks five
languages, so every validation error also carries machine codes:
    {"email": ["Enter a valid email address."], "codes": {"email": ["invalid"]}}
and a throttled request says {"code": "throttled", "wait": seconds}. The app maps
the codes to its own strings (frontend src/lib/errors.ts); the English text stays
as the fallback.
"""
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework.views import exception_handler


def _codes(codes):
    if isinstance(codes, dict):
        return {k: _codes(v) for k, v in codes.items()}
    if isinstance(codes, (list, tuple)):
        flat = []
        for c in codes:
            flat.extend(_codes(c) if isinstance(c, (list, tuple)) else [c] if isinstance(c, str) else [])
        return flat
    return [codes] if isinstance(codes, str) else []


def handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ValidationError) and isinstance(response.data, dict):
        codes = exc.get_codes()
        if isinstance(codes, dict):
            response.data['codes'] = {k: _codes(v) for k, v in codes.items()}
    elif isinstance(exc, Throttled) and isinstance(response.data, dict):
        response.data['code'] = 'throttled'
        if exc.wait is not None:
            response.data['wait'] = int(exc.wait)
    return response


def password_errors(django_error):
    """A Django password ValidationError as DRF ErrorDetails, keeping each validator's code."""
    from rest_framework.exceptions import ErrorDetail
    out = []
    for e in django_error.error_list:
        msg = e.message % e.params if e.params else e.message
        out.append(ErrorDetail(str(msg), code=e.code or 'invalid'))
    return out
