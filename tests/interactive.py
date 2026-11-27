"""Exercise the installer as a terminal user without external dependencies."""
import os
from pathlib import Path
import pty
import re
import select
import subprocess
import tempfile
import time

CLI = Path(__file__).resolve().parents[1] / 'bin/ultimate-frontend.mjs'


def expect(fd, marker):
    end = time.monotonic() + 8
    output = b''
    while marker not in output:
        timeout = end - time.monotonic()
        assert timeout > 0 and select.select([fd], [], [], timeout)[0], output
        output += os.read(fd, 4096)
    return output


def exercise(cancel):
    with tempfile.TemporaryDirectory() as project:
        master, slave = pty.openpty()
        try:
            with subprocess.Popen(['node', CLI, 'install'], cwd=project, stdin=slave,
                                  stdout=slave, stderr=slave) as child:
                try:
                    menu = expect(master, b'Enter to cancel')
                    if not cancel:
                        number = re.search(rb'(\d+)\. claude\s', menu).group(1)
                        os.write(master, b'999\n')
                        expect(master, b'Unknown selection')
                    os.write(master, b'\n' if cancel else number + b',pi,' + number + b'\n')
                    assert child.wait(timeout=8) == 0
                finally:
                    if child.poll() is None:
                        child.kill()
            root = Path(project)
            assert {p.name for p in root.iterdir()} == (set() if cancel else {'.claude', '.pi'})
            for p in root.iterdir():
                assert (p / 'skills/ultimate-frontend/SKILL.md').is_file()
        finally:
            os.close(master)
            os.close(slave)


if __name__ == '__main__':
    exercise(cancel=True)
    exercise(cancel=False)
    print('Interactive installation: retry, multi-select, deduplication and cancellation passed.')
