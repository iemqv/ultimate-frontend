"""Verify the completed round's pairings and each arm's delivered user prompt."""
import json
from pathlib import Path
import sys
from round import fingerprint


def verify(root):
    def load(name): return json.loads((root/name).read_text())
    split = load('protocol.json')['split']
    if split not in ('dev','holdout'):
        raise ValueError('Unknown split')
    groups = ('control','baseline') if split=='dev' else ('control','baseline','candidate')
    repeats = (1,2) if split=='dev' else (1,)
    expected = {(b,g,r) for b in ('open','material','operate') for g in groups for r in repeats}
    records=load('runs.json'); ids={r['id'] for r in records}
    if (len(ids)!=len(records) or len(records)!=len(expected) or
        {(r['brief'],r['group'],r['repeat']) for r in records}!=expected or
        not {p.name for p in (root/'arms').iterdir()}.issubset(ids)):
        raise ValueError('Assignment is incomplete or contains extra runs')
    if load('digests.json')!=fingerprint(root/'inputs'):
        raise ValueError('Frozen inputs changed')
    failures=[]
    for r in records:
        arm=root/'arms'/r['id']; fixture=root/'inputs/fixtures'/split/r['brief']
        statusfile=root/'logs'/f"{r['id']}.status.json"
        if not statusfile.exists() or not (arm/'prompt.txt').exists():
            failures.append(r['id']); continue
        if (arm/'prompt.txt').read_bytes()!=(fixture/'prompt.txt').read_bytes():
            raise ValueError(f"Prompt mismatch: {r['id']}")
        status=load(f"logs/{r['id']}.status.json")
        if status['exit']!=0 or not (arm/'site/index.html').is_file(): failures.append(r['id'])
    print(f'{len(records)} assignments checked; missing or unsuccessful deliveries are listed separately. {len(failures)} failed/missing pages: {failures}')
    return not failures

if __name__=='__main__': sys.exit(0 if verify(Path(sys.argv[1])) else 1)
