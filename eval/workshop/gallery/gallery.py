#!/usr/bin/env python3
"""Serve a local blinded comparison gallery. See README.md for the input layout."""

import hashlib
import hmac
import itertools
import json
import os
import re
import secrets
import shutil
import stat
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


GROUPS = ('control', 'baseline', 'candidate')
VIEWPORTS = {'desktop': (1440, 960), 'mobile': (390, 844)}
CHOICES = ('A', 'B', 'tie', 'both-poor', 'not-observed')
GALLERY_FILES = {'/': ('index.html', 'text/html; charset=utf-8'),
                 '/gallery.js': ('gallery.js', 'text/javascript; charset=utf-8'),
                 '/gallery.css': ('gallery.css', 'text/css; charset=utf-8')}
ASSET_TYPES = {
    '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
}
PRIVATE_NAME = re.compile(r'(?:^|[._-])(?:logs?|credentials?|secrets?|passwords?|tokens?|keys?)(?:$|[._-])', re.I)
RUN_ID = re.compile(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*\Z')
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
GALLERY_DIR = Path(__file__).resolve().parent
STATE_DIR = '.pilot-gallery'


def open_directory(parent, parts):
    fd = os.dup(parent)
    try:
        for part in parts:
            child = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def open_regular(parent, parts):
    directory = open_directory(parent, parts[:-1])
    try:
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise OSError('not a regular file')
            return os.fdopen(fd, 'rb')
        except BaseException:
            os.close(fd)
            raise
    finally:
        os.close(directory)


def private_seed(root):
    try:
        os.mkdir(STATE_DIR, 0o700, dir_fd=root)
    except FileExistsError:
        pass
    directory = open_directory(root, [STATE_DIR])
    try:
        try:
            fd = os.open('seed', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=directory)
        except FileExistsError:
            pass
        else:
            with os.fdopen(fd, 'w', encoding='ascii') as seed_file:
                seed_file.write(secrets.token_hex(32))
        with open_regular(directory, ['seed']) as seed_file:
            seed = seed_file.read(65)
        if not re.fullmatch(rb'[a-f0-9]{64}', seed):
            raise ValueError('invalid private gallery seed')
        return seed
    finally:
        os.close(directory)


class Gallery:
    def __init__(self, root):
        self.root = root
        with open_regular(root, ['runs.json']) as source:
            runs = json.load(source)
        if not isinstance(runs, list) or not runs:
            raise ValueError('runs.json must be a nonempty array')
        buckets, controls, ids = {}, {}, set()
        for run in runs:
            if not isinstance(run, dict) or not {'id', 'brief', 'group', 'repeat'} <= run.keys():
                raise ValueError('every run needs id, brief, group and repeat')
            ident, brief, group, repeat = (run[name] for name in ('id', 'brief', 'group', 'repeat'))
            if (not isinstance(ident, str) or not RUN_ID.fullmatch(ident) or ident in ids
                    or not isinstance(brief, str) or not brief.strip() or group not in GROUPS
                    or not (type(repeat) is int or isinstance(repeat, str) and repeat.strip())):
                raise ValueError('invalid or duplicate run metadata')
            ids.add(ident)
            bucket = buckets.setdefault((brief, repeat), {})
            if group in bucket:
                raise ValueError('duplicate brief, repeat and group')
            bucket[group] = run
            if group == 'control':
                controls.setdefault(brief, []).append(run)

        self.seed = private_seed(root)
        self.capture_runs = [{'id': ident, 'token': self.token('capture', ident)} for ident in sorted(ids)]
        self.capture_tokens = {run['token']: run['id'] for run in self.capture_runs}
        self.slots, self.pairs, self.assignments = {}, [], {}
        for bucket in buckets.values():
            for first, second in itertools.combinations(bucket.values(), 2):
                self.add_pair(first, second)
        for runs in controls.values():
            for first, second in itertools.combinations(runs, 2):
                self.add_pair(first, second)
        self.pairs.sort(key=lambda pair: pair['id'])

    def token(self, kind, *parts):
        message = json.dumps([kind, *parts], separators=(',', ':')).encode()
        return hmac.new(self.seed, message, hashlib.sha256).hexdigest()[:32]

    def add_pair(self, first, second):
        pair = self.token('pair', *sorted((first['id'], second['id'])))
        ordered = sorted((first, second), key=lambda run: self.token('side', pair, run['id']))
        slots = []
        for label, run in zip(('A', 'B'), ordered):
            slot = self.token('slot', pair, label)
            self.slots[slot] = run['id']
            slots.append(slot)
        self.pairs.append({'id': pair, 'brief': first['brief'], 'slots': slots})
        self.assignments[pair] = [{name: run[name] for name in ('id', 'group', 'repeat')} for run in ordered]

    def complete(self, votes):
        return (bool(self.assignments) and isinstance(votes, dict) and votes.keys() == self.assignments.keys()
                and all(isinstance(vote, dict) and vote.get('visual') in CHOICES and vote.get('task') in CHOICES
                        and isinstance(vote.get('reason'), str) and 0 < len(vote['reason'].strip()) <= 1000
                        for vote in votes.values()))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def respond(self, status, content_type, body, *, csp=None, cors=False, length=None):
        self.send_response_only(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body) if length is None else length))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
        self.send_header('Content-Security-Policy', csp or "default-src 'none'; frame-ancestors 'none'")
        if cors:
            self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        if self.command != 'HEAD':
            if length is None:
                self.wfile.write(body)
            else:
                shutil.copyfileobj(body, self.wfile)

    def missing(self):
        self.respond(404, 'text/plain; charset=utf-8', b'Not found\n')

    def send_json(self, data):
        self.respond(200, 'application/json; charset=utf-8', json.dumps(data).encode())

    def file_response(self, parts, content_type, **headers):
        try:
            stream = open_regular(self.server.gallery.root, parts)
        except OSError:
            self.missing()
            return
        with stream:
            self.respond(200, content_type, stream, length=os.fstat(stream.fileno()).st_size, **headers)

    def valid_host(self):
        return self.headers.get_all('Host') == [self.server.host]

    def do_POST(self):
        if (not self.valid_host() or self.path != '/reveal' or self.headers.get('Origin') != self.server.base
                or self.headers.get('Content-Type') != 'application/json'):
            return self.missing()
        gallery = self.server.gallery
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= max(1, len(gallery.pairs)) * 13000:
                return self.missing()
            votes = json.loads(self.rfile.read(length))
        except (ValueError, RecursionError):
            return self.missing()
        if not gallery.complete(votes):
            return self.missing()
        self.send_json(gallery.assignments)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.valid_host() or not self.path.startswith('/') or self.path.startswith('//'):
            return self.missing()
        try:
            path = unquote(urlsplit(self.path).path, errors='strict')
        except (UnicodeError, ValueError):
            return self.missing()
        gallery, base = self.server.gallery, self.server.base
        if path in GALLERY_FILES:
            name, content_type = GALLERY_FILES[path]
            policy = (f"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; "
                      f"frame-src {base}/p/; connect-src 'self'; base-uri 'none'; "
                      "form-action 'none'; frame-ancestors 'none'")
            self.respond(200, content_type, (GALLERY_DIR / name).read_bytes(), csp=policy)
            return
        if path == '/comparisons':
            return self.send_json(gallery.pairs)
        if path == '/_capture':
            authorization = self.headers.get('Authorization', '').encode('latin-1')
            if hmac.compare_digest(authorization, b'Bearer ' + gallery.seed):
                return self.send_json({'runs': gallery.capture_runs, 'assignments': gallery.assignments})
            return self.missing()

        parts = path.split('/')[1:]
        if len(parts) < 3:
            return self.missing()
        category, token, *tail = parts
        if category == 's' and token in gallery.slots and len(tail) == 1 and tail[0] in VIEWPORTS:
            capture = gallery.token('capture', gallery.slots[token])
            return self.file_response([STATE_DIR, 'captures', f'{capture}-{tail[0]}.png'], 'image/png')
        if category == 'p':
            ident = gallery.slots.get(token)
        elif category == 'c':
            ident = gallery.capture_tokens.get(token)
        else:
            ident = None
        is_index = tail == ['']
        if ident is None or (not is_index and any(
                not part or part.startswith('.') or '\\' in part
                or any(ord(char) < 32 or ord(char) == 127 for char in part)
                or PRIVATE_NAME.search(part) for part in tail)):
            return self.missing()
        if is_index:
            tail = ['index.html']
        content_type = 'text/html; charset=utf-8' if is_index else ASSET_TYPES.get(Path(tail[-1]).suffix.lower())
        if tail in (['pickup-windows.json'], ['clips.json']):
            content_type = 'application/json; charset=utf-8'
        if not content_type:
            return self.missing()
        subtree = f'{base}/{category}/{token}/'
        policy = (f"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' {subtree}; "
                  f"style-src 'unsafe-inline' {subtree}; img-src data: {subtree}; font-src {subtree}; "
                  f"media-src {subtree}; connect-src {subtree}; base-uri 'none'; form-action 'none'; "
                  f"frame-ancestors {base}")
        self.file_response(['arms', ident, 'site', *tail], content_type, csp=policy, cors=not is_index)


class Server(ThreadingHTTPServer):
    def handle_error(self, _request, _address):
        # Requests and candidate filenames must not land in server logs.
        pass


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python3 gallery.py ROOT PORT')
    port = int(sys.argv[2])
    root_path = Path(os.path.abspath(sys.argv[1]))
    system_root = os.open('/', DIR_FLAGS)
    try:
        root = open_directory(system_root, root_path.parts[1:])
    finally:
        os.close(system_root)
    try:
        with Server(('127.0.0.1', port), Handler) as server:
            server.gallery = Gallery(root)
            server.host = f'127.0.0.1:{server.server_port}'
            server.base = 'http://' + server.host
            print(f'Gallery: {server.base}', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        os.close(root)


if __name__ == '__main__':
    main()
