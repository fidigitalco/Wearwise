#!/usr/bin/env python3
"""Rebuild api/data/ip_countries.bin.gz from the RIRs' own delegation files.

    python scripts/build_ip_countries.py              # fetch, then build
    python scripts/build_ip_countries.py /path/to/files  # build from a snapshot

Where the data comes from: each regional internet registry publishes, daily and
without a key, the list of address ranges it has handed out and the country of
the organisation it handed each to. That is a statement by the people who
allocated the addresses, which is why it is used here rather than a commercial
geolocation service — no account, no licence, no per-request call, and nobody's
address leaves this server to find out where it is.

What it is not: a street-level lookup. A range's country is the registrant's,
so a VPN, a satellite link or an international carrier can read as somewhere
the person is not. The panel labels it "IP country" for exactly that reason and
keeps it apart from the account's own.

Rerun it when the table starts looking stale — allocations move slowly, and a
year-old table is wrong about a fraction of a percent of addresses.
"""
import array
import glob
import gzip
import ipaddress
import os
import struct
import sys
import tempfile
import urllib.request

SOURCES = [
    'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-extended-latest',
    'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest',
    'https://ftp.apnic.net/stats/apnic/delegated-apnic-extended-latest',
    'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-extended-latest',
    'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest',
]

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', 'api', 'data', 'ip_countries.bin.gz')
MAGIC = b'SDIP1\n'


def fetch(into):
    for url in SOURCES:
        name = os.path.join(into, url.rsplit('/', 1)[1])
        print(f'… {url}')
        urllib.request.urlretrieve(url, name)
    return glob.glob(os.path.join(into, 'delegated-*'))


def parse(files):
    """(start, size, country) per allocated range, one list per IP version.

    IPv6 is indexed by the top 64 bits: no allocation is finer than a /64 and
    every /64 belongs to one network, so that is the whole address as far as
    this question goes and it fits in an integer half the size.
    """
    v4, v6 = [], []
    for path in files:
        with open(path, encoding='utf-8', errors='ignore') as fh:
            for line in fh:
                if line.startswith('#') or '|' not in line:
                    continue
                parts = line.split('|')
                if len(parts) < 7:
                    continue
                cc, kind, start, value, status = (parts[1], parts[2], parts[3],
                                                  parts[4], parts[6])
                # 'reserved' and 'available' ranges belong to nobody yet, and
                # the summary lines at the top of each file have no country.
                if len(cc) != 2 or status not in ('allocated', 'assigned'):
                    continue
                try:
                    if kind == 'ipv4':
                        v4.append((int(ipaddress.IPv4Address(start)), int(value), cc))
                    elif kind == 'ipv6':
                        net = ipaddress.IPv6Network(f'{start}/{value}', strict=False)
                        v6.append((int(net.network_address) >> 64,
                                   1 << max(0, 64 - int(value)), cc))
                except ValueError:
                    continue
    return merge(v4), merge(v6)


def merge(rows):
    """Sorted, with neighbours of the same country folded into one range."""
    rows.sort()
    out = []
    for start, size, cc in rows:
        if out and out[-1][2] == cc and out[-1][0] + out[-1][1] == start:
            out[-1][1] += size
        else:
            out.append([start, size, cc])
    return out


def pack(rows, code):
    starts = array.array(code, [r[0] for r in rows])
    sizes = array.array(code, [r[1] for r in rows])
    if sys.byteorder == 'big':          # the file is little-endian
        starts.byteswap()
        sizes.byteswap()
    ccs = b''.join(r[2].encode('ascii') for r in rows)
    return starts.tobytes() + sizes.tobytes() + ccs


def main():
    # A directory of already-downloaded delegated-* files, for a machine whose
    # Python cannot verify the RIRs' certificates (or has no network at all).
    given = sys.argv[1] if len(sys.argv) > 1 else ''
    if given:
        files = glob.glob(os.path.join(given, 'delegated-*'))
        if not files:
            raise SystemExit(f'no delegated-* files in {given}')
        v4, v6 = parse(files)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            v4, v6 = parse(fetch(tmp))
    print(f'{len(v4)} IPv4 ranges, {len(v6)} IPv6 ranges, '
          f'{len({r[2] for r in v4} | {r[2] for r in v6})} countries')
    blob = (MAGIC + struct.pack('<II', len(v4), len(v6))
            + pack(v4, 'I') + pack(v6, 'Q'))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with gzip.open(OUT, 'wb', compresslevel=9) as fh:
        fh.write(blob)
    print(f'{OUT} — {os.path.getsize(OUT) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
