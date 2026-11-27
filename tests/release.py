"""Exercise automatic versions, release-only commits and retries against a local remote."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def exercise(work):
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=work, text=True).strip()

    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Release test')
    git('config', 'user.email', 'test@example.invalid')
    git('init', '--bare', '-q', str(work.parent / 'remote.git'))
    git('remote', 'add', 'origin', str(work.parent / 'remote.git'))
    (work / 'engine').mkdir()
    for name in ['package.json', 'engine/Cargo.toml', 'engine/Cargo.lock']:
        shutil.copy(ROOT / name, work / name)
    package = work / 'package.json'
    data = json.loads(package.read_text())
    data['version'] = '0.7.0'
    package.write_text(json.dumps(data, indent=2) + '\n')
    git('add', '.')
    git('commit', '-qm', 'Initial release')
    git('tag', 'v0.7.0')
    git('push', '-q', 'origin', 'main', 'v0.7.0')

    def publish(version, source):
        tag = 'v' + version
        envfile = work.parent / 'env'
        envfile.write_text('')
        subprocess.run(['python3', '-B', ROOT / '.github/scripts/prepare-release.py'], cwd=work,
                       env={**os.environ, 'GITHUB_SHA': source, 'GITHUB_ENV': str(envfile)}, check=True)
        assert envfile.read_text() == f'VERSION={version}\n'
        assert git('rev-parse', tag + '^{}') == git('rev-parse', 'HEAD')
        assert git('rev-parse', 'HEAD^') == source
        assert git('ls-remote', 'origin', 'refs/heads/main').split()[0] == source
        assert json.loads(package.read_text())['version'] == version
        assert f'version = "{version}"' in (work / 'engine/Cargo.toml').read_text()
        assert f'name = "ultimate-frontend-engine"\nversion = "{version}"' in (work / 'engine/Cargo.lock').read_text()
        return git('rev-parse', tag)

    for version, requested in [('0.7.1', None), ('0.8.0', '0.8.0'), ('0.8.1', None), ('1.0.0', '1.0.0')]:
        git('checkout', '-q', 'main')
        if requested:
            data['version'] = requested
            package.write_text(json.dumps(data, indent=2) + '\n')
            git('add', 'package.json')
        git('commit', '--allow-empty', '-qm', 'New push')
        git('push', '-q', 'origin', 'main')
        source = git('rev-parse', 'HEAD')
        first = publish(version, source)
        git('checkout', '-q', '--detach', source)
        assert git('ls-remote', 'origin', 'refs/tags/v' + version).split()[0] == first
        git('tag', '-d', 'v' + version)
        git('fetch', '--tags', 'origin')
        assert publish(version, source) == first

    git('checkout', '-q', '--detach', 'main~1')
    old = subprocess.run(['python3', '-B', ROOT / '.github/scripts/prepare-release.py'], cwd=work,
                         env={**os.environ, 'GITHUB_SHA': git('rev-parse', 'HEAD')}, capture_output=True, text=True)
    assert old.returncode != 0 and 'supersedes' in old.stderr


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as directory:
        work = Path(directory) / 'work'
        work.mkdir()
        exercise(work)
    print('Automatic patches, explicit minor/major versions and reruns passed; main unchanged.')
