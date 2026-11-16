"""Re-run every active "Find me this" hunt and push new matches. The server runs this every 6 hours."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run every active hunt once and notify new matches.'

    def handle(self, *args, **options):
        from api.hunts import run_all
        found = run_all()
        self.stdout.write(f'{found} new hunt matches')
