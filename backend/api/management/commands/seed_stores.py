"""Create the partner stores as switched-off connections (api/stores/targets.py). Safe to run again."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Add the target partner stores to the admin panel, switched off, so their keys can be filled in later.'

    def handle(self, *args, **options):
        from api.stores.targets import seed
        self.stdout.write(f'{seed()} store connections added')
