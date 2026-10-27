"""Day forecast from Open-Meteo (free, no key). Cached per rounded location and day."""
import json
import ssl
import urllib.parse
import urllib.request

import certifi
from django.core.cache import cache

URL = 'https://api.open-meteo.com/v1/forecast'
# certifi's bundle, so HTTPS works even on Pythons without system CAs (python.org macOS builds).
_SSL = ssl.create_default_context(cafile=certifi.where())


def forecast(lat, lon, day):
    """{"temp_c", "temp_min_c", "temp_max_c", "precip_prob"} for `day`, or None if unavailable."""
    key = f'wx:{round(lat, 1)}:{round(lon, 1)}:{day.isoformat()}'
    hit = cache.get(key)
    if hit:
        return hit
    q = urllib.parse.urlencode({
        'latitude': round(lat, 3),
        'longitude': round(lon, 3),
        'daily': 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        'timezone': 'auto',
        'start_date': day.isoformat(),
        'end_date': day.isoformat(),
    })
    try:
        with urllib.request.urlopen(f'{URL}?{q}', timeout=8, context=_SSL) as r:
            d = json.load(r)['daily']
        tmax, tmin = d['temperature_2m_max'][0], d['temperature_2m_min'][0]
        pp = d['precipitation_probability_max'][0]
    except Exception:
        return None
    out = {
        # Daytime feel: weighted towards the high, since that is when it is worn.
        'temp_c': round(0.65 * tmax + 0.35 * tmin, 1),
        'temp_min_c': tmin,
        'temp_max_c': tmax,
        'precip_prob': (pp or 0) / 100,
    }
    cache.set(key, out, 60 * 60)
    return out
