"""Verify the two published sites against the recorded generation outputs."""
import hashlib
import json
import re
import struct
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(root=ROOT):
    if not __debug__:
        raise SystemExit('Verification requires assertions: run Python without -O or PYTHONOPTIMIZE.')
    prompt = digest(root / 'prompt.txt')
    records = []
    prompts = []
    for letter in ('a', 'b'):
        arm = root / letter
        record = json.loads((arm / 'run.json').read_text())
        assert not record['preflight'] and record['responses'][-1]['stopReason'] == 'stop'
        assert record['prompt']['sha256'] == prompt
        assert all(message.startswith(('Final desktop capture:', 'Final mobile capture:')) for message in record['failures'])
        assert record['status'] == ('failed' if record['failures'] else 'completed'), (letter, record['status'])
        site = arm / 'site'
        files = {p.relative_to(site).as_posix(): digest(p) for p in site.rglob('*') if p.is_file()}
        assert files == record['output']['files'], f'{letter}: generated site changed'
        manifest = json.dumps(record['output']['files'], ensure_ascii=False, separators=(',', ':'))
        assert hashlib.sha256(manifest.encode()).hexdigest() == record['output']['sha256']
        assert record['usage']['userMessages'] == 1
        if record['skills']:
            assert [s['name'] for s in record['skills']] == ['ultimate-frontend']
            reads = {r['path']: r['sha256'] for r in record['skillReads']}
            assert reads['/skill/SKILL.md'] == record['skills'][0]['sha256']
            with tarfile.open(root / 'revision/skill.tar.gz') as saved:
                for path, checksum in reads.items():
                    data = saved.extractfile('ultimate-frontend/' + path.removeprefix('/skill/')).read()
                    assert hashlib.sha256(data).hexdigest() == checksum, path
        else:
            assert not record['skillReads']
        captures = json.loads((arm / 'views.json').read_text())
        for name, size in [('desktop', (1440, 960)), ('mobile', (390, 844))]:
            image = arm / (name + '.png')
            info = captures[name]
            assert struct.unpack('>II', image.read_bytes()[16:24]) == size
            assert info['sha256'] == digest(image) and info['revision'] == record['output']['sha256']
            assert not (info['pageErrors'] or info['networkErrors'] or info['blockedRequests'])
            assert info['state']['scrollWidth'] == size[0] and info['state']['scrollY'] == 0
        records.append(record)
        prompts.append((arm / 'system-prompt.txt').read_text())
    left, right = records
    for key in ('settings', 'limits', 'requested'):
        assert left[key] == right[key], key
    assert left['usage']['sessionId'] != right['usage']['sessionId']
    assert not left['skills'] and right['skills'], 'published labels do not match the runs'
    assert re.sub(r'<skills>.*?</skills>\n\n', '', prompts[0], flags=re.S) == re.sub(r'<skills>.*?</skills>\n\n', '', prompts[1], flags=re.S)
    print('Two distinct live sessions, identical prompt/settings/limits, original output bytes, loaded skill and four viewport captures verified.')


if __name__ == '__main__':
    verify()
