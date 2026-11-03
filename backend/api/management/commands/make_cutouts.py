"""
Give every piece that has a photo but no cutout one: demo pieces from the
bundled cutouts, the user's own by removing the background (needs rembg).

    python manage.py make_cutouts
"""
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from api.colors import remove_background
from api.models import Garment, User
from api.samples import restore_sample_photos


class Command(BaseCommand):
    help = 'Create missing cutouts for demo and uploaded pieces.'

    def handle(self, *args, **opts):
        demo = sum(restore_sample_photos(u) for u in User.objects.filter(garments__is_sample=True).distinct())
        made = failed = 0
        for g in Garment.objects.filter(is_sample=False).exclude(image='').filter(cutout=''):
            try:
                g.image.open('rb')
                png = remove_background(g.image)
            except (OSError, ValueError):
                png = None
            if png:
                g.cutout.save(f'{g.id}_cutout.png', ContentFile(png), save=False)
                g.save(update_fields=['cutout'])
                made += 1
            else:
                failed += 1
        self.stdout.write(f'demo pieces repaired: {demo}, cutouts made: {made}, without: {failed}')
