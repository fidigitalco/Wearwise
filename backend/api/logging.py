"""
Server errors into the database, for the admin panel's Errors page.

Hooked onto `django.request` (every 500) and `api` (errors the code logs
itself) in settings.LOGGING. The same message on the same endpoint stays one
row with a count while it is open. It never raises: a failure to record an
error must not become a second error.
"""
import logging
import threading
import traceback as tb

from django.utils import timezone

_busy = threading.local()


class DatabaseErrorHandler(logging.Handler):
    def emit(self, record):
        if getattr(_busy, 'on', False):
            return  # an error while saving an error: stop here
        _busy.on = True
        try:
            self._save(record)
        except Exception:
            pass
        finally:
            _busy.on = False

    @staticmethod
    def _save(record):
        from django.db import transaction
        from .models import ServerError
        request = getattr(record, 'request', None)
        endpoint = method = ''
        user_id = None
        if request is not None:
            endpoint = (getattr(request, 'path', '') or '')[:300]
            method = (getattr(request, 'method', '') or '')[:8]
            user = getattr(request, 'user', None)
            if user is not None and getattr(user, 'is_authenticated', False):
                user_id = user.pk
        message = record.getMessage()
        if record.exc_info and record.exc_info[1] is not None:
            exc = record.exc_info[1]
            message = f'{type(exc).__name__}: {exc}'
            trace = ''.join(tb.format_exception(*record.exc_info))
        else:
            trace = ''
        message = message[:2000]
        with transaction.atomic():
            row = (ServerError.objects.select_for_update()
                   .filter(resolved=False, message=message, endpoint=endpoint).first())
            if row:
                row.count += 1
                row.last_seen_at = timezone.now()
                row.traceback = trace[-12000:] or row.traceback
                row.save(update_fields=['count', 'last_seen_at', 'traceback'])
            else:
                ServerError.objects.create(level=record.levelname[:10], message=message, traceback=trace[-12000:],
                                           endpoint=endpoint, method=method, user_id=user_id)
