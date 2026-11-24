"""Verify the reused control and the two follow-up views shown in the comparison."""
import json
import runpy
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent
shared = runpy.run_path(str(ROOT.parent / 'verify.py'))
shared['verify'](ROOT)
digest = shared['digest']
for name in ('run.json', 'system-prompt.txt', 'desktop.png', 'mobile.png'):
    assert digest(ROOT / 'a' / name) == digest(ROOT.parent / 'a' / name), name
for letter, name in [('a', 'middle'), ('b', 'next')]:
    arm = ROOT / letter
    record = json.loads((arm / 'run.json').read_text())
    views = json.loads((arm / 'views.json').read_text())
    view = views[name]
    image = arm / (name + '.png')
    assert view['revision'] == record['output']['sha256']
    assert view['sha256'] == digest(image), image
    assert view['sha256'] != views['desktop']['sha256'], f'{image}: unchanged opening view'
    assert struct.unpack('>II', image.read_bytes()[16:24]) == (view['imageWidth'], view['imageHeight']) == (1440, 960)
    assert not (view['pageErrors'] or view['networkErrors'] or view['blockedRequests'])
    if name == 'middle':
        y = view['state']['scrollY']
        assert abs(y - (views['desktop']['state']['scrollHeight'] - 960) / 2) <= 1
        assert view['actionResults'] == [{'type': 'scroll', 'y': y, 'ok': True}]
    else:
        assert view['actionResults'] == [{'type': 'click', 'selector': '#next', 'ok': True}]
print('Original control, A at mid-scroll, and B after selecting the next print verified.')
