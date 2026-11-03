"""
Closet video → frames worth looking at (KB section 4, stage 1).

Samples about two frames a second, drops blurred frames and near-duplicates
(the camera lingering on the same shelf), then keeps an even spread of what is
left so the vision model sees the whole closet within one request.
"""
import io

import numpy as np
from PIL import Image

SAMPLE_FPS = 2
MAX_SAMPLED = 80      # ~40 s of video at 2 fps
MAX_FRAMES = 12       # sent to the model in one call
MAX_SIDE = 1600       # kept for cropping garments out
MIN_SHARPNESS = 25.0  # variance of the Laplacian; below this the frame is mush
DUPLICATE_DIFF = 6.0  # mean abs difference (0–255) of 32×32 thumbnails


def _sharpness(gray):
    import cv2
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def extract_frames(path):
    """Selected frames as RGB uint8 arrays, in video order."""
    import cv2

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return []
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, round(src_fps / SAMPLE_FPS))

    sampled = []
    i = 0
    while len(sampled) < MAX_SAMPLED:
        ok = cap.grab()
        if not ok:
            break
        if i % step == 0:
            ok, frame = cap.retrieve()
            if ok:
                h, w = frame.shape[:2]
                scale = min(1.0, MAX_SIDE / max(h, w))
                if scale < 1.0:
                    frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                sampled.append((frame, gray, _sharpness(gray)))
        i += 1
    cap.release()
    if not sampled:
        return []

    # Blur: relative to this video (lighting varies), with an absolute floor.
    median = float(np.median([s for _, _, s in sampled]))
    sharp = [(f, g) for f, g, s in sampled if s >= max(MIN_SHARPNESS, 0.5 * median)]
    if not sharp:  # a uniformly soft video is still better than nothing
        sharp = [(f, g) for f, g, _ in sorted(sampled, key=lambda x: -x[2])[:MAX_FRAMES]]

    kept, last = [], None
    for frame, gray in sharp:
        thumb = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
        if last is None or float(np.abs(thumb - last).mean()) > DUPLICATE_DIFF:
            kept.append(frame)
            last = thumb

    if len(kept) > MAX_FRAMES:
        idx = np.linspace(0, len(kept) - 1, MAX_FRAMES).round().astype(int)
        kept = [kept[j] for j in sorted(set(idx))]
    return [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in kept]


def crop(frame, box, pad=0.06):
    """JPEG bytes of `box` ({x, y, w, h} as 0–1 fractions) cut from an RGB frame, with a little margin."""
    h, w = frame.shape[:2]
    x0 = max(0.0, box['x'] - pad * box['w'])
    y0 = max(0.0, box['y'] - pad * box['h'])
    x1 = min(1.0, box['x'] + box['w'] * (1 + pad))
    y1 = min(1.0, box['y'] + box['h'] * (1 + pad))
    left, top, right, bottom = int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)
    if right - left < 16 or bottom - top < 16:
        left, top, right, bottom = 0, 0, w, h
    img = Image.fromarray(frame[top:bottom, left:right])
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=88)
    return buf.getvalue()


def to_jpeg(frame, max_side=1024):
    img = Image.fromarray(frame)
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=82)
    return buf.getvalue()
