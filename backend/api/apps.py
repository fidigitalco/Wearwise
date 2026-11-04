from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import os
        import sys
        # Only the serving process (not runserver's file watcher, tests or other commands) loads the speech models.
        serving = ('runserver' in sys.argv and os.environ.get('RUN_MAIN') == 'true') or 'gunicorn' in sys.argv[0]
        if serving:
            from .speech import warm_up
            warm_up()
