"""Import products from every active store connection (api/stores/). The server runs this daily."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Sync products from every active store connection.'

    def handle(self, *args, **options):
        from api.stores import sync_all
        for name, result in sync_all().items():
            self.stdout.write(f'{name}: {result}')
