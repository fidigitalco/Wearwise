"""
Speech to text for the stylist's voice questions, in any of the app's languages
(Azerbaijani, English, Russian, Turkish, Spanish).

The language is heard from the recording itself, not taken from the app's
language, so a Russian question in the Azerbaijani app comes out in Russian.

Two ways to run it:
- With GROQ_API_KEY or OPENAI_API_KEY set: Whisper in the cloud, a second or two.
- Otherwise a local Whisper (faster-whisper), no key needed: the small model
  picks the language and WHISPER_MODEL ("large-v3-turbo" by default, about
  1.6 GB; the small models garble Azerbaijani) writes it down. Both are
  downloaded once and kept in memory; `warm_up()` loads them when the server starts.
"""
import logging
import os
import tempfile
import threading

import requests

from .locale import LANGS

log = logging.getLogger(__name__)

_model = None
_detector = None
_lock = threading.Lock()

# Whisper hears some languages as a close neighbour: Russian as Ukrainian or
# Belarusian, Spanish now and then as Portuguese. The neighbour's
# probability counts towards the language we support.
_KIN = {
    'az': {'az': 1.0}, 'tr': {'tr': 1.0}, 'ru': {'ru': 1.0, 'uk': 0.7, 'be': 0.7}, 'en': {'en': 1.0},
    'es': {'es': 1.0, 'pt': 0.3},
}
# Azerbaijani and Turkish are too close for a short clip to tell apart: when
# the two lead, the app's language decides (Azerbaijani unless the app is Turkish).
_TWINS = ('az', 'tr')
# A slight lean towards the app's language when the recording is ambiguous.
_APP_PRIOR = 0.05

# A sentence in the language's own words primes Whisper's spelling of the
# words people actually say to a stylist.
_PROMPTS = {
    'az': 'Sabah nə geyinim? Kombin, köynək, şalvar, cins, don, gödəkçə, palto, ayaqqabı, krossovka, rəng, hava.',
    'ru': 'Что мне надеть завтра? Образ, рубашка, брюки, джинсы, платье, куртка, пальто, обувь, кроссовки, цвет, погода.',
    'en': 'What should I wear tomorrow? Outfit, shirt, trousers, jeans, dress, jacket, coat, shoes, sneakers, colour, weather.',
    'tr': 'Yarın ne giysem? Kombin, gömlek, pantolon, kot, elbise, ceket, mont, ayakkabı, spor ayakkabı, renk, hava.',
    'es': '¿Qué me pongo mañana? Conjunto, camisa, pantalón, vaqueros, vestido, chaqueta, abrigo, zapatos, zapatillas, color, tiempo.',
}


def _get_model():
    global _model
    with _lock:
        if _model is None:
            from faster_whisper import WhisperModel

            _model = WhisperModel(os.environ.get('WHISPER_MODEL', 'large-v3-turbo'), device='cpu', compute_type='int8',
                                  cpu_threads=os.cpu_count() or 4)
        return _model


def _get_detector():
    """A small model just for telling the language: a pass of the big one costs as much as the transcript."""
    global _detector
    with _lock:
        if _detector is None:
            from faster_whisper import WhisperModel

            _detector = WhisperModel(os.environ.get('WHISPER_DETECT_MODEL', 'small'), device='cpu', compute_type='int8',
                                     cpu_threads=os.cpu_count() or 4)
        return _detector


def local_voice():
    """False on a shared server (WEARWISE_LOCAL_VOICE=0): the local models never load, voice needs a cloud key."""
    return os.environ.get('WEARWISE_LOCAL_VOICE', '1') != '0'


def warm_up():
    """Loads the local models in the background so the first voice question does not wait for them."""
    if _cloud() or not local_voice():
        return

    def load():
        try:
            _get_detector()
            _get_model()
        except Exception as e:
            log.warning('voice: warm-up failed: %s', e)
    threading.Thread(target=load, daemon=True).start()


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


def pick_language(probs, app_lang='en'):
    """One of the app's languages from Whisper's [(language, probability)] list."""
    p = dict(probs)
    scores = {lang: sum(w * p.get(k, 0.0) for k, w in _KIN[lang].items()) for lang in LANGS}
    if app_lang in scores:
        scores[app_lang] += _APP_PRIOR
    best = max(scores, key=scores.get)
    if best in _TWINS:
        return 'tr' if app_lang == 'tr' else 'az'
    return best


# Cloud Whisper names the language in English words.
_NAMES = {
    'azerbaijani': 'az', 'turkish': 'tr', 'russian': 'ru', 'ukrainian': 'uk', 'belarusian': 'be', 'english': 'en',
    'spanish': 'es', 'portuguese': 'pt',
}
_CLOUD = {
    'GROQ_API_KEY': ('https://api.groq.com/openai/v1/audio/transcriptions', 'whisper-large-v3-turbo'),
    'OPENAI_API_KEY': ('https://api.openai.com/v1/audio/transcriptions', 'whisper-1'),
}


def _cloud():
    """(url, model, key) of the first cloud provider with a key set, else None."""
    for env, (url, model) in _CLOUD.items():
        if os.environ.get(env):
            return url, model, os.environ[env]
    return None


def _cloud_call(provider, path, language=None):
    url, model, key = provider
    data = {'model': model, 'response_format': 'verbose_json', 'temperature': '0'}
    if language:
        data.update(language=language, prompt=_PROMPTS[language])
    with open(path, 'rb') as f:
        r = requests.post(url, headers={'Authorization': f'Bearer {key}'}, data=data,
                          files={'file': (os.path.basename(path), f)}, timeout=30)
    r.raise_for_status()
    body = r.json()
    lang = str(body.get('language', '')).lower()
    return body.get('text', '').strip(), _NAMES.get(lang, lang)


def _transcribe_cloud(provider, path, app_lang):
    text, heard = _cloud_call(provider, path)
    if heard in _TWINS and app_lang in _TWINS and heard != app_lang:
        return _cloud_call(provider, path, app_lang)[0], app_lang
    if heard in LANGS:
        return text, heard
    # Heard as a neighbour (Turkish for Azerbaijani) or something else: write it again in the language we support.
    lang = next((l for l in LANGS if heard in _KIN[l]), app_lang if app_lang in LANGS else 'en')
    return _cloud_call(provider, path, lang)[0], lang


def _transcribe_local(path, app_lang):
    audio = _decode(path)
    _, _, probs = _get_detector().detect_language(audio, vad_filter=True)
    heard = pick_language(probs, app_lang)
    segments, _ = _get_model().transcribe(audio, language=heard, initial_prompt=_PROMPTS[heard],
                                          beam_size=2, vad_filter=True, condition_on_previous_text=False)
    return ' '.join(seg.text.strip() for seg in segments).strip(), heard


def transcribe(audio_file, lang='en'):
    """
    (text, language) for an uploaded recording, language one of locale.LANGS; None if
    speech recognition is unavailable or failed. `lang` is the app's language,
    used only to break a tie.
    """
    provider = _cloud()
    if not provider and not local_voice():
        log.warning('voice: no cloud key and local voice is off')
        return None
    if not provider:
        try:
            _get_detector()
            _get_model()
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
            return _transcribe_cloud(provider, tmp.name, lang) if provider else _transcribe_local(tmp.name, lang)
        except Exception as e:  # unreadable audio, or the cloud service failed
            log.warning('voice: transcription failed: %s', e)
            return None
