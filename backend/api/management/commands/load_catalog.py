"""Loads the demo shopping catalogue (api/catalog.py, DEMO); safe to run again, it updates demo rows by name and store and never touches the real pieces added in the admin panel."""
from django.core.management.base import BaseCommand

from api.catalog import demo_rows
from api.models import Product


class Command(BaseCommand):
    help = 'Load or refresh the demo product catalogue'

    def handle(self, *args, **opts):
        made = 0
        for row in demo_rows():
            _, created = Product.objects.update_or_create(name=row['name'], store=row['store'], is_demo=True, defaults=row)
            made += created
        self.stdout.write(f'{made} new, {Product.objects.filter(is_demo=True).count()} demo products')
