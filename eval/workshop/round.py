"""Freeze a workshop experiment and run the assigned arms exactly once."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
BASELINE = HERE.parents[1] / 'skills' / 'ultimate-frontend'


def store(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def fingerprint(root):
    return {str(f.relative_to(root)): hashlib.sha256(f.read_bytes()).hexdigest()
            for f in sorted(root.rglob('*')) if f.is_file()}


def safe_source(tree):
    # Check before copying; dereferencing a link would erase evidence of its source.
    credential = os.getenv('PI_EVAL_AUTH')
    for item in (tree, *tree.rglob('*')):
        if item.is_symlink() or not (item.is_dir() or item.is_file() and item.stat().st_nlink == 1):
            raise ValueError(f'Unexpected linked or special input: {item.name}')
        if credential and Path(credential).exists() and item.samefile(credential):
            raise ValueError('Credential cannot be a frozen input')


def prepare(out, candidate, pilot):
    split = 'holdout' if candidate else 'dev'
    for source in ((candidate,pilot/'inputs') if candidate else (BASELINE,HERE/'fixtures')):
        safe_source(source)
    out.mkdir(mode=0o700)  # refuse existing output, including partial previous runs
    (out / 'arms').mkdir()
    (out / 'logs').mkdir()
    frozen = out / 'inputs'
    frozen.mkdir()
    if candidate:
        old = pilot / 'inputs'
        if fingerprint(old) != json.loads((pilot / 'digests.json').read_text()):
            raise ValueError('Pilot inputs changed')
        shutil.copytree(old / 'baseline', frozen / 'baseline')
        shutil.copytree(old / 'fixtures', frozen / 'fixtures')
        shutil.copytree(candidate, frozen / 'candidate')
    else:
        shutil.copytree(BASELINE, frozen / 'baseline')
        shutil.copytree(HERE / 'fixtures', frozen / 'fixtures')
    store(out / 'digests.json', fingerprint(frozen))
    groups = ['control','baseline','candidate'] if candidate else ['control','baseline']
    records = [dict(id=secrets.token_hex(6), brief=brief, group=group, repeat=repeat)
               for brief in ('open','material','operate') for repeat in range(1, 2 if candidate else 3) for group in groups]
    secrets.SystemRandom().shuffle(records)
    store(out / 'runs.json', records)
    store(out / 'protocol.json', {'split':split,'model':'openai/gpt-6.2-sol','thinking':'medium','workers':3})
    return records


def execute(out, run, split):
    name = run['id']; frozen = out / 'inputs'
    fixture = frozen / 'fixtures' / split / run['brief']
    cmd = [sys.executable,str(HERE/'runner/arm.py'),str(out/'arms'/name),str(fixture/'site'),str(fixture/'prompt.txt'),
           '-' if run['group']=='control' else str(frozen/run['group'])]
    start = time.time(); print('start',name,flush=True)
    with (out/'logs'/f'{name}.log').open('xb') as log:
        result = subprocess.run(cmd, stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT)
    store(out/'logs'/f'{name}.status.json',{'exit':result.returncode,'seconds':round(time.time()-start)})
    print('finish',name,result.returncode,flush=True)
    return result.returncode


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--candidate',type=Path);parser.add_argument('--pilot',type=Path)
    args=parser.parse_args()
    if bool(args.candidate)!=bool(args.pilot):parser.error('holdout requires both --pilot and --candidate')
    os.umask(0o077)
    subprocess.run([sys.executable, '-B', str(HERE/'runner/test_arm.py')], check=True)
    out=args.output.resolve(); runs=prepare(out,args.candidate,args.pilot)
    split='holdout' if args.candidate else 'dev'
    with ThreadPoolExecutor(max_workers=3) as pool:
        statuses=list(pool.map(lambda run:execute(out,run,split), runs))
    if fingerprint(out/'inputs')!=json.loads((out/'digests.json').read_text()): raise ValueError('Frozen inputs changed')
    sys.exit(int(any(statuses)))

if __name__=='__main__': main()
