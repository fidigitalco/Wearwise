"""
Speech to text for the stylist's voice questions.

Runs a local Whisper model (faster-whisper), so no API key is needed. The model
is downloaded once on first use and kept in memory; WHISPER_MODEL picks its size
("small" by default: decent Azerbaijani, about 0.5 GB).
"""
import logging
import os
import tempfile
import threading

log = logging.getLogger(__name__)

_model = None
_lock = threading.Lock()


def _get_model():
    global _model
    with _lock:
        if _model is None:
            from faster_whisper import WhisperModel

            _model = WhisperModel(os.environ.get('WHISPER_MODEL', 'small'), device='cpu', compute_type='int8')
        return _model


def _decode(path):
    """16 kHz mono float32 samples. Done here because faster-whisper's own decoder breaks on PyAV 15+."""
    import av
    import numpy as np

    resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
    chunks = []
    with av.open(path) as container:
        for frame in container.decode(audio=0):
            chunks.extend(f.to_ndarray().ravel() for f in resampler.resample(frame))
        chunks.extend(f.to_ndarray().ravel() for f in resampler.resample(None))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def transcribe(audio_file, lang='en'):
    """The spoken text in an uploaded audio file, or None if speech recognition is unavailable or failed."""
    try:
        model = _get_model()
    except ImportError:
        log.warning('voice: faster-whisper is not installed')
        return None
    except Exception as e:  # model download or load failure
        log.warning('voice: cannot load the speech model: %s', e)
        return None
    suffix = os.path.splitext(audio_file.name or '')[1] or '.m4a'
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        for chunk in audio_file.chunks():
            tmp.write(chunk)
        tmp.flush()
        try:
            segments, _ = model.transcribe(_decode(tmp.name), language='az' if lang == 'az' else 'en',
                                           beam_size=1, vad_filter=True)
            return ' '.join(seg.text.strip() for seg in segments).strip()
        except Exception as e:  # unreadable or corrupt audio
            log.warning('voice: transcription failed: %s', e)
            return None
