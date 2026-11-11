"""IP address → ISO-3166 country, from the RIRs' own delegation files.

The five regional internet registries publish, daily and without a key, every
address range they have handed out and the country of the organisation they
handed it to. `data/ip_countries.bin.gz` is that, folded into two sorted tables
— one per IP version — by scripts/build_ip_countries.py, which is also how it
is refreshed.

Why this and not a geolocation service: no account, no licence, no per-request
call, and no user's address leaves this server to find out where it is. The
answer is a statement by the people who allocated the address rather than a
guess sold by a third party.

What it is NOT: a claim about where somebody is sitting. The country is the
registrant's, so a VPN, a satellite link or an international carrier reads as
somewhere the person is not — which is exactly why what comes out of here is
stored as `ip_country`, beside the account's own country and never instead of
it.

The table loads on first use (about half a megabyte, a tenth of a second) and
stays in memory. A lookup is two binary searches at worst.
"""
import array
import gzip
import os
import struct
import sys
import threading
from ipaddress import ip_address

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     'data', 'ip_countries.bin.gz')
_MAGIC = b'SDIP1\n'

# (starts, sizes, codes) per version, or None until the file has been read.
_TABLES = {}
_LOCK = threading.Lock()


def _read():
    """Both tables, or {} when the file is missing or not ours.

    Never raises: a country breakdown is worth less than the requests it would
    take down with it, and a missing table simply means nothing is placed.
    """
    try:
        with gzip.open(_PATH, 'rb') as fh:
            blob = fh.read()
    except Exception:
        return {}
    if not blob.startswith(_MAGIC):
        return {}
    at = len(_MAGIC)
    n4, n6 = struct.unpack_from('<II', blob, at)
    at += 8
    tables = {}
    for version, count, code in ((4, n4, 'I'), (6, n6, 'Q')):
        width = array.array(code).itemsize
        starts = array.array(code)
        starts.frombytes(blob[at:at + count * width])
        at += count * width
        sizes = array.array(code)
        sizes.frombytes(blob[at:at + count * width])
        at += count * width
        codes = blob[at:at + count * 2]
        at += count * 2
        if sys.byteorder == 'big':      # the file is little-endian
            starts.byteswap()
            sizes.byteswap()
        tables[version] = (starts, sizes, codes)
    return tables


def _tables():
    if not _TABLES:
        with _LOCK:
            if not _TABLES:
                _TABLES.update(_read() or {'loaded': True})
    return _TABLES


def _bisect(starts, key):
    """Index of the last start at or below `key`, or -1.

    array.array is not a list, and bisect on one is fine — but written out
    because the arrays hold a couple of hundred thousand entries and the loop
    below runs on ordinary requests.
    """
    lo, hi = 0, len(starts)
    while lo < hi:
        mid = (lo + hi) // 2
        if starts[mid] <= key:
            lo = mid + 1
        else:
            hi = mid
    return lo - 1


def country_for_ip(value):
    """The country an address was allocated to, or '' when nothing says.

    '' for a private or loopback address, for an address in no allocated range,
    and for anything that is not an address at all. Never a guess.
    """
    try:
        addr = ip_address((value or '').strip())
    except ValueError:
        return ''
    # A LAN address says where a proxy is, not where a person is.
    if addr.is_private or addr.is_loopback or addr.is_reserved or addr.is_multicast:
        return ''
    if addr.version == 6 and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    key = int(addr) if addr.version == 4 else int(addr) >> 64

    table = _tables().get(addr.version)
    if not table:
        return ''
    starts, sizes, codes = table
    i = _bisect(starts, key)
    if i < 0 or key >= starts[i] + sizes[i]:
        return ''
    return codes[i * 2:i * 2 + 2].decode('ascii')
