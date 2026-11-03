"""
Closet video scans: frames → one vision call → a garment per distinct item.

Runs off the request thread because a scan takes tens of seconds; the app
polls GET /api/scans/{id}/. A plain thread is enough for one dev server; in
production run process_scan from a task queue (Celery, as in SaveDo) instead.
"""
import logging
import threading

from django.core.files.base import ContentFile
from django.db import close_old_connections, transaction
from django.utils import timezone

from .colors import extract_colors
from .models import Garment, VideoScan
from .video import crop, extract_frames, to_jpeg
from .vision import analyse_frames

log = logging.getLogger(__name__)


def process_scan(scan_id):
    scan = VideoScan.objects.select_related('user').get(pk=scan_id)
    try:
        frames = extract_frames(scan.video.path) if scan.video else []
        if not frames:
            return _finish(scan, 'failed', 'no_frames')
        scan.frames_used = len(frames)
        items = analyse_frames([to_jpeg(f) for f in frames], scan.lang)
        if items is None:
            return _finish(scan, 'failed', 'ai_failed')

        created = []
        for it in items:
            fields = {k: v for k, v in it.items() if k not in ('frame', 'box', 'is_garment')}
            g = Garment(user=scan.user, **fields)
            g.image.save(f'{g.id}.jpg', ContentFile(crop(frames[it['frame']], it['box'])), save=False)
            if not g.colors:
                g.image.open('rb')
                g.colors, _ = extract_colors(g.image)
            g.save()
            created.append(g)
        scan.garments.set(created)
        _finish(scan, 'done')
    except Exception:
        log.exception('video scan %s failed', scan_id)
        _finish(scan, 'failed', 'error')
    finally:
        # The video was only a means to the garments; don't keep the user's footage.
        if scan.video:
            scan.video.delete(save=False)
            VideoScan.objects.filter(pk=scan.pk).update(video=None)


def _finish(scan, status, error=''):
    scan.status, scan.error, scan.finished_at = status, error, timezone.now()
    scan.save(update_fields=['status', 'error', 'frames_used', 'finished_at'])


def _run(scan_id):
    close_old_connections()
    try:
        process_scan(scan_id)
    finally:
        close_old_connections()


def start_scan(scan):
    """Process after the upload's transaction commits, off the request thread."""
    transaction.on_commit(lambda: threading.Thread(target=_run, args=(scan.pk,), daemon=True).start())
