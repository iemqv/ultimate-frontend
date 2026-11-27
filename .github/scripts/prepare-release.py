"""Reserve a stable release tag for one main push; never write back to main."""
import json
import os
import re
import subprocess
from pathlib import Path


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def stable(value):
    if not re.fullmatch(r'(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)', value, re.ASCII):
        raise ValueError(f'Expected a stable X.Y.Z version, got {value!r}')
    return tuple(map(int, value.split('.')))


def replace_one(file, pattern, replacement):
    path = Path(file)
    data, count = re.subn(pattern, replacement, path.read_text(), flags=re.M)
    if count != 1:
        raise ValueError(f'Expected one package version in {file}')
    path.write_text(data)


def prepare(source):
    if git('rev-parse', 'HEAD') != source or git('status', '--porcelain'):
        raise ValueError('Release preparation requires a clean checkout of the push')
    tags = git('tag', '-l', 'v*', '--format=%(refname:short)%09%(contents:subject)').splitlines()
    versions = {}
    reserved = None
    for row in tags:
        tag, _, subject = row.partition('\t')
        if not re.fullmatch(r'v\d+\.\d+\.\d+', tag):
            continue
        versions[stable(tag[1:])] = tag
        if subject == f'Release source: {source}':
            reserved = tag

    if versions:
        newest = versions[max(versions)]
        if reserved == newest:
            git('checkout', '--detach', reserved)
            return reserved[1:]
        subject = git('tag', '-l', newest, '--format=%(contents:subject)')
        previous = subject.removeprefix('Release source: ') if subject.startswith('Release source: ') else newest
        if reserved or subprocess.run(['git', 'merge-base', '--is-ancestor', previous, source]).returncode:
            raise ValueError('A newer release already supersedes this push; refusing to replace latest')

    requested = stable(json.loads(Path('package.json').read_text())['version'])
    latest = max(versions, default=(0, 0, 0))
    version = '.'.join(map(str, requested if requested > latest else (*latest[:2], latest[2] + 1)))
    # Keep published source archives and npm metadata aligned without a recursive bot push to main.
    subprocess.run(['npm', 'pkg', 'set', f'version={version}'], check=True)
    replace_one('engine/Cargo.toml', r'^version = "[^"]+"$', f'version = "{version}"')
    replace_one('engine/Cargo.lock', r'(^name = "ultimate-frontend-engine"\nversion = ")[^"]+"', rf'\g<1>{version}"')
    git('checkout', '--detach', source)
    git('add', 'package.json', 'engine/Cargo.toml', 'engine/Cargo.lock')
    git('commit', '--allow-empty', '-m', f'Release v{version}')
    git('tag', '-a', 'v' + version, '-m', f'Release source: {source}')
    git('push', 'origin', 'refs/tags/v' + version)
    return version


if __name__ == '__main__':
    version = prepare(os.environ['GITHUB_SHA'])
    with open(os.environ['GITHUB_ENV'], 'a') as output:
        print(f'VERSION={version}', file=output)
