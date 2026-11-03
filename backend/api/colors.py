"""
Deterministic colour extraction (KB section 4, stage 6).

k-means in CIELAB over the garment's pixels, each centre mapped to the nearest
of the 22 named colours. Background pixels are dropped first: by alpha when the
image is a cutout, otherwise by distance from the border colour (good enough for
flat-lays on a plain surface; rembg cutouts do better when installed).
"""
import io
import os

import numpy as np
from PIL import Image, ImageOps

from .taxonomy import COLORS

MAX_SIDE = 160  # downsample: colour needs pixels, not detail
K = 4
MIN_SHARE = 0.08


def rgb_to_lab(rgb):
    """sRGB (0–255, shape (..., 3)) → CIELAB D65."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


_NAMES = list(COLORS)
_NAMED_LAB = rgb_to_lab(np.array([COLORS[n] for n in _NAMES]))


def nearest_color_name(lab):
    d = np.linalg.norm(_NAMED_LAB - np.asarray(lab), axis=1)
    return _NAMES[int(np.argmin(d))]


def _foreground_pixels(img):
    if img.mode in ('RGBA', 'LA') or 'transparency' in img.info:
        rgba = np.asarray(img.convert('RGBA'), dtype=np.uint8)
        mask = rgba[..., 3] > 128
        if mask.mean() < 0.98:  # a real cutout, not an opaque PNG
            return rgba[..., :3][mask]
    rgb = np.asarray(img.convert('RGB'), dtype=np.uint8)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg_lab = rgb_to_lab(np.median(border, axis=0))
    lab = rgb_to_lab(rgb)
    mask = np.linalg.norm(lab - bg_lab, axis=-1) > 12
    # If almost everything matches the border, the garment fills the frame.
    return rgb[mask] if mask.mean() > 0.05 else rgb.reshape(-1, 3)


def _kmeans(x, k, iters=12, seed=0):
    rng = np.random.default_rng(seed)
    k = min(k, len(x))
    centres = x[rng.choice(len(x), size=k, replace=False)]
    for _ in range(iters):
        labels = np.argmin(((x[:, None, :] - centres[None]) ** 2).sum(-1), axis=1)
        new = np.array([x[labels == i].mean(0) if np.any(labels == i) else centres[i] for i in range(k)])
        if np.allclose(new, centres, atol=0.5):
            break
        centres = new
    return centres, labels


def extract_colors(image_file):
    """
    Return the garment's colours, most dominant first, plus a quality flag.

    [{"name", "rgb", "lab", "share"}], low_light: bool
    """
    img = ImageOps.exif_transpose(Image.open(image_file))
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    # Poor light darkens the whole frame, backdrop included. Judged on every
    # pixel so a black garment shot in good light is not flagged.
    frame_l = rgb_to_lab(np.asarray(img.convert('RGB'), dtype=np.uint8))[..., 0]
    low_light = float(np.percentile(frame_l, 95)) < 35
    px = _foreground_pixels(img)
    if len(px) == 0:
        return [], True
    lab = rgb_to_lab(px)
    centres, labels = _kmeans(lab, K)
    shares = np.bincount(labels, minlength=len(centres)) / len(labels)

    merged = {}
    for centre, share in zip(centres, shares):
        name = nearest_color_name(centre)
        m = merged.setdefault(name, {'lab_sum': np.zeros(3), 'share': 0.0})
        m['lab_sum'] += centre * share
        m['share'] += share

    out = []
    for name, m in sorted(merged.items(), key=lambda kv: -kv[1]['share']):
        if m['share'] < MIN_SHARE:
            continue
        lab_c = m['lab_sum'] / m['share']
        out.append({
            'name': name,
            'rgb': list(COLORS[name]),
            'lab': [round(float(v), 1) for v in lab_c],
            'share': round(float(m['share']), 2),
        })
    return out, low_light


_session = None


def _rembg_session():
    """
    One rembg model, loaded once per process. isnet-general-use is about a
    tenth of rembg's default (bria, 1 GB) and seconds instead of minutes on a
    CPU, sharp enough for clothes; REMBG_MODEL picks another.
    """
    global _session
    if _session is None:
        try:
            from rembg import new_session  # optional, heavy (onnxruntime)
        except ImportError:
            return None
        _session = new_session(os.environ.get('REMBG_MODEL', 'isnet-general-use'))
    return _session


def remove_background(image_file):
    """
    PNG bytes of the piece on a transparent background, trimmed to the piece
    with a small margin so every cutout fills its tile alike; via rembg when it
    is installed, else None. Returns None too when the model found nothing.
    """
    session = _rembg_session()
    if session is None:
        return None
    from rembg import remove
    if isinstance(image_file, bytes):
        raw = image_file
    else:
        image_file.seek(0)
        raw = image_file.read()
    img = Image.open(io.BytesIO(remove(raw, session=session))).convert('RGBA')
    # Faint halo pixels would stop the trim at the photo's edge.
    box = img.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        return None
    margin = round(max(box[2] - box[0], box[3] - box[1]) * 0.04)
    img = img.crop((max(box[0] - margin, 0), max(box[1] - margin, 0),
                    min(box[2] + margin, img.width), min(box[3] + margin, img.height)))
    img.thumbnail((1200, 1200))
    out = io.BytesIO()
    img.save(out, 'PNG', optimize=True)
    return out.getvalue()
