"""Validate editable evidence/catalogue/panels and rebuild the static snapshot.
No network calls. Imported data must be reviewed before being included here.
"""
from pathlib import Path
import json, math, sys
ROOT = Path(__file__).resolve().parents[1]
def main() -> None:
    atlas = json.loads((ROOT/'data/atlas.json').read_text())
    for key, file in [('records','evidence.json'),('catalogue','catalogue.json'),('panels','panels.json')]:
        atlas[key] = json.loads((ROOT/'data'/file).read_text())
    records = {r['id']: r for r in atlas['records']}
    if len(records) != len(atlas['records']):
        raise ValueError('Duplicate record ids')
    for record in records.values():
        if record['status'] not in ['verified','historical','pending']:
            raise ValueError('Unrecognized evidence status')
        for key in ['count','prevalence']:
            value = record.get(key)
            if value is not None and (not math.isfinite(value) or value < 0 or (key == 'prevalence' and value > 1)):
                raise ValueError(f'Invalid {key}: {record["id"]}')
        if not record['source'].startswith(('https://','http://')):
            raise ValueError(f'Missing public source: {record["id"]}')
    for panel in atlas['panels']:
        for item in panel['items']:
            if item['recordId'] not in records or not 0 <= item['p'] <= 1:
                raise ValueError(f'Invalid model item: {item}')
    encoded = json.dumps(atlas, ensure_ascii=False, separators=(',',':')).replace('</','<\\/')
    (ROOT/'data.js').write_text('/* Evidence snapshot: coverage remains incomplete. */\nwindow.ATLAS='+encoded+';\n')
    (ROOT/'data/atlas.json').write_text(json.dumps(atlas,ensure_ascii=False,indent=2))
    print(f'Built {len(records)} records; {len(atlas["catalogue"])} catalogue items.')
if __name__ == '__main__':
    try: main()
    except (ValueError,KeyError,OSError) as exc:
        print(str(exc),file=sys.stderr);sys.exit(1)
