"""Capture first viewports for a finished arm without altering its generated site."""
import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'eval/workshop/runner'))
from arm import CHROMIUM, dispatch


def capture(arm, destination):
    record = json.loads((arm / 'run.json').read_text())
    if not record['responses'] or record['responses'][-1]['stopReason'] != 'stop' or 'output' not in record:
        raise ValueError('Expected a finished generation with an output manifest')
    source = arm / 'site'
    files = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in source.rglob('*') if p.is_file()}
    if files != record['output']['files']:
        raise ValueError('Site no longer matches the recorded output')
    published = Path(__file__).resolve().parent
    protected = (source.resolve(), published / 'a/site', published / 'b/site')
    if any(destination.resolve().is_relative_to(path.resolve()) for path in protected):
        raise ValueError('Capture destination must be outside generated site trees')
    destination.mkdir(exist_ok=False, parents=True)
    views = {}
    for name, width, height in [('desktop', 1440, 960), ('mobile', 390, 844)]:
        result = dispatch(source, None, CHROMIUM, {'op': 'preview', 'args': {'width': width, 'height': height}})
        if not result['ok']:
            raise RuntimeError(result['error'])
        image = base64.b64decode(result['png'], validate=True)
        (destination / (name + '.png')).write_bytes(image)
        views[name] = {**result['metadata'], 'sha256': hashlib.sha256(image).hexdigest(),
                       'revision': record['output']['sha256']}
    (destination / 'views.json').write_text(json.dumps(views, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('arm', type=Path, help='Directory containing run.json and site/')
    parser.add_argument('destination', type=Path, help='Output directory for PNGs and views.json')
    args = parser.parse_args()
    capture(args.arm.resolve(), args.destination.resolve())
