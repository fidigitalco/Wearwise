"""
Writes api/locales/_source.json: every English template the server can say and
every vocabulary key, for translators to turn into api/locales/<lang>.json.
Run it after adding a sentence; untranslated sentences show in English.
"""
import ast
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from api import taxonomy as tx
from api.engine import describe, recommend
from api.samples import SAMPLE_WARDROBE
from api.shopping import REASONS

API = Path(__file__).resolve().parents[2]


def say_templates():
    found = []
    for path in sorted(API.rglob('*.py')):
        if 'migrations' in path.parts or 'tests' in path.name:
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == 'say' and len(node.args) >= 2:
                arg = node.args[1]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    found.append(arg.value)
    return found


class Command(BaseCommand):
    help = 'Collect translatable server text into api/locales/_source.json'

    def handle(self, *args, **opts):
        text = say_templates()
        for table in (describe._COLOR_REASONS, describe._TEXT, recommend._COLOR_PHRASES):
            text += list(table['en'].values())
        for entry in describe._TITLES.values():
            text += list(entry['en'])
        text += [en for en, _ in REASONS.values()]
        text += [row[1] for row in SAMPLE_WARDROBE]  # demo piece names
        names = {
            'colors': {k: k.replace('_', ' ') for k in tx.COLORS},
            'kinds': {k: k.replace('_', ' ') for k in [*tx.CATEGORIES, *tx.ALL_SUBCATEGORIES]},
            'occasions': dict(describe.OCCASION_EN),
            'styles': {k: k.replace('_', ' ') for k in tx.STYLE_DIRECTIONS},
        }
        out = {'text': sorted(set(text)), 'names': names}
        (API / 'locales' / '_source.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
        self.stdout.write(f"{len(out['text'])} sentences, {sum(len(v) for v in names.values())} words")
