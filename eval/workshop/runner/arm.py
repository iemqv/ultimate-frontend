#!/usr/bin/env python3
"""Run one Pi evaluation arm; dispatch workspace tools inside bubblewrap."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
PYTHON = "/usr/bin/python3"
PATH = "/usr/bin:/bin"
PLAYWRIGHT = Path("/opt/postman/app/resources/app/node_modules/playwright-core")
CHROMIUM = Path.home() / ".cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64"
MAX_FILES = 256
MAX_TREE = 32 * 1024 * 1024
MAX_FILE = 3 * 1024 * 1024
MAX_READ = 80 * 1024
MAX_PNG = 5 * 1024 * 1024
ARM_SECONDS = 720


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(root):
    files = {}
    for directory, dirs, names in os.walk(root):
        if len(files) + len(dirs) + len(names) > MAX_FILES:
            raise ValueError("Workspace file limit exceeded")
        for name in sorted(dirs + names):
            path = Path(directory) / name
            mode = path.lstat().st_mode
            if stat.S_ISDIR(mode):
                continue
            if not stat.S_ISREG(mode) or path.stat().st_size > MAX_FILE:
                raise ValueError("Only bounded regular files are allowed")
            files[path.relative_to(root).as_posix()] = path.stat().st_size
    if sum(files.values()) > MAX_TREE:
        raise ValueError("Workspace byte limit exceeded")
    return dict(sorted(files.items()))


def copy_tree(source, target):
    if not source.is_dir():
        raise ValueError("Fixture and skill inputs must be directories")
    files = tree(source)
    target.mkdir()
    for name in files:
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, dest)


def workspace_path(raw, writable=False):
    if not isinstance(raw, str) or not 1 <= len(raw) <= 300 or any(ord(c) < 32 for c in raw) or "\\" in raw:
        raise ValueError("Use a site/ or skill/ path")
    if raw.startswith("/"):
        raw = raw[1:]
    if not raw.startswith(("site/", "skill/")):
        raw = "site/" + raw
    parts = raw.split("/")
    if any(not p or p in (".", "..") for p in parts) or (writable and parts[0] != "site"):
        raise ValueError("Path must stay in its permitted workspace")
    path = Path("/", *parts)
    if path.resolve() != path:
        raise ValueError("Symbolic links are not allowed")
    return path


def sandbox_tool(request):
    op = request["op"]
    args = request.get("args", {})
    if op == "list":
        return {"files": tree(Path("/site"))}
    if op == "read":
        path = workspace_path(args["path"])
        if not path.is_file():
            raise ValueError("File does not exist in the workspace")
        if path.stat().st_size > MAX_READ:
            raise ValueError("Text read exceeds the 80 KiB limit; assets can be inspected with preview")
        data = path.read_bytes()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError("Not a UTF-8 text file") from error
        return {"path": str(path), "bytes": len(data), "sha256": sha(data), "text": text}
    if op == "write":
        path = workspace_path(args["path"], writable=True)
        if len(path.parts) > 12:
            raise ValueError("Too many path components")
        content = args["content"]
        if not isinstance(content, str):
            raise ValueError("Content must be a string")
        encoding = args.get("encoding", "utf8")
        if encoding not in ("base64", "utf8"):
            raise ValueError("Encoding must be utf8 or base64")
        data = base64.b64decode(content, validate=True) if encoding == "base64" else content.encode("utf-8")
        files = tree(Path("/site"))
        rel = path.relative_to("/site").as_posix()
        if len(data) > MAX_FILE or sum(files.values()) - files.get(rel, 0) + len(data) > MAX_TREE or (rel not in files and len(files) >= MAX_FILES):
            raise ValueError("Write exceeds workspace limits")
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
            temp.write(data)
        os.replace(temp.name, path)
        return {"path": str(path), "bytes": len(data), "sha256": sha(data)}
    if op == "probe":  # Harness-only; not a model tool.
        import socket
        visible = Path(args["sibling"]).exists()
        try:
            with socket.create_connection(("127.0.0.1", args["port"]), timeout=1):
                connected = True
        except OSError:
            connected = False
        return {"siblingVisible": visible, "siblingTcpReachable": connected,
                "authVisible": Path(args["auth"]).exists(), "authEnv": "PI_EVAL_AUTH" in os.environ}
    raise ValueError("Unknown workspace operation")


def dispatch(site, skill, chromium, request):
    browser = request["op"] == "preview"
    bwrap = ["/usr/bin/bwrap", "--unshare-all", "--unshare-user", "--disable-userns", "--die-with-parent", "--new-session",
             "--clearenv", "--setenv", "PATH", PATH, "--setenv", "HOME", "/home/arm",
             "--setenv", "LANG", "C.UTF-8", "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib",
             "--symlink", "usr/lib", "/lib64", "--proc", "/proc", "--dev", "/dev",
             "--size", "134217728", "--tmpfs", "/tmp", "--dir", "/home/arm",
             "--bind" if request["op"] == "write" else "--ro-bind", site, "/site", "--chdir", "/site"]
    if skill and not browser:
        bwrap += ["--ro-bind", skill, "/skill"]
    if browser:
        bwrap += ["--ro-bind", PLAYWRIGHT, "/playwright", "--ro-bind", chromium, "/chromium",
                  "--ro-bind", "/etc/fonts", "/etc/fonts", "--ro-bind", "/etc/ld.so.cache", "/etc/ld.so.cache",
                  "--ro-bind", HERE / "browser.cjs", "/browser.cjs", "--", "/usr/bin/node", "/browser.cjs"]
    else:
        bwrap += ["--ro-bind", HERE / "arm.py", "/arm.py", "--", PYTHON, "/arm.py", "--sandbox-tool"]
    # The child namespaces are destroyed on timeout or if the trusted transport dies.
    command = ["/usr/bin/prlimit", "--cpu=25:26", "--fsize=8388608:8388608", "--core=0:0", "--", *bwrap]
    result = subprocess.run(command, input=json.dumps(request).encode(), stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=30, check=False, env={"PATH": PATH}, cwd="/")
    if result.returncode:
        error = result.stderr[:1000].decode(errors="replace").strip()
        raise ValueError(f"Sandbox execution failed: {error or result.returncode}")
    return json.loads(result.stdout)


def auth_file():
    value = os.environ.get("PI_EVAL_AUTH")
    if not value:
        raise ValueError("Set PI_EVAL_AUTH to the dedicated Pi OpenAI OAuth auth.json path")
    path = Path(value).resolve(strict=True)
    daily_paths = [Path.home() / ".pi/agent/auth.json"]
    if os.environ.get("PI_CODING_AGENT_DIR"):
        daily_paths.append(Path(os.environ["PI_CODING_AGENT_DIR"]) / "auth.json")
    if any(daily.exists() and path.samefile(daily) for daily in daily_paths):
        raise ValueError("Refusing to use daily Pi auth.json")
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("Dedicated auth.json must be a regular file owned by you with mode 0600 or 0400")
    return path


def run_arm(out, fixture, prompt, skill_source, *, preflight=False, probe=None):
    pi = shutil.which("pi")
    node = shutil.which("node")
    if not pi or not node:
        raise ValueError("Pi and Node.js must be on PATH")
    pi_root = Path(pi).resolve().parents[2]
    if not (pi_root / "dist/index.js").is_file():
        raise ValueError("Expected the npm Pi SDK installation exposing dist/index.js")
    credential = None if preflight else auth_file()
    if credential:
        # Never copy a credential into a model-browsable input or Chromium runtime mount.
        for source in (fixture, skill_source, Path("/usr"), PLAYWRIGHT, CHROMIUM, Path("/etc/fonts")):
            if source and (credential.is_relative_to(source) or source == credential):
                raise ValueError("Credential must be outside all fixture, skill and sandbox runtime trees")
        if prompt == credential or prompt.samefile(credential):
            raise ValueError("Credential cannot be the user prompt")
    if not 0 < prompt.stat().st_size <= MAX_READ:
        raise ValueError("Prompt must contain 1–81920 bytes")
    text = prompt.read_bytes()
    text.decode("utf-8")
    if fixture == out or out.is_relative_to(fixture) or (skill_source and out.is_relative_to(skill_source)):
        raise ValueError("Output must not be nested in the fixture or skill input")
    out.mkdir(mode=0o700, parents=True)
    (out / "prompt.txt").write_bytes(text)
    (out / "captures").mkdir()
    with tempfile.TemporaryDirectory(prefix="pi-eval-") as directory:
        private = Path(directory)
        agent_dir = private / "agent"
        agent_dir.mkdir()
        skill = None
        if skill_source:
            skill = private / "skill"
            copy_tree(skill_source, skill)
        site = out / "site"
        copy_tree(fixture, site)
        config = {"out": str(out), "site": str(site), "skill": str(skill) if skill else None,
                  "agentDir": str(agent_dir), "auth": str(credential or agent_dir / "empty-auth.json"),
                  "sdk": str(pi_root), "python": PYTHON, "chromium": str(CHROMIUM.resolve(strict=True)), "seconds": ARM_SECONDS,
                  "preflight": preflight, "probe": probe}
        launch = private / "launch.json"
        launch.write_text(json.dumps(config), encoding="utf-8")
        env = {"HOME": str(private), "PI_CODING_AGENT_DIR": str(agent_dir), "PI_TELEMETRY": "0",
               "XDG_CACHE_HOME": str(private / "cache"), "XDG_CONFIG_HOME": str(private / "config"),
               "XDG_DATA_HOME": str(private / "data"), "XDG_STATE_HOME": str(private / "state"),
               "PATH": PATH, "LANG": "C.UTF-8"}
        with (out / "transport.log").open("wb") as log:
            result = subprocess.run([node, "--max-old-space-size=512", HERE / "transport.mjs", launch],
                                    stdout=log, stderr=log, cwd=site, env=env,
                                    timeout=ARM_SECONDS + 75, check=False)
    return result.returncode


def main():
    args = sys.argv[1:]
    if args == ["--sandbox-tool"]:
        try:
            print(json.dumps({"ok": True, **sandbox_tool(json.load(sys.stdin))}))
        except (ValueError, OSError, KeyError, TypeError) as error:
            print(json.dumps({"ok": False, "error": str(error)[:600]}))
        return 0
    if len(args) == 4 and args[0] == "--dispatch":
        try:
            print(json.dumps(dispatch(args[1], None if args[2] == "-" else args[2], args[3], json.load(sys.stdin))))
        except (ValueError, OSError, subprocess.TimeoutExpired) as error:
            detail = "Sandbox exceeded 30 seconds" if isinstance(error, subprocess.TimeoutExpired) else str(error)
            print(json.dumps({"ok": False, "error": detail[:600]}))
        return 0
    if len(args) != 4:
        print("Usage: python3 arm.py OUTDIR FIXTUREDIR PROMPTFILE SKILLDIR_OR_DASH", file=sys.stderr)
        return 2
    out, fixture, prompt = (Path(arg).resolve() for arg in args[:3])
    skill = None if args[3] == "-" else Path(args[3]).resolve()
    try:
        return run_arm(out, fixture, prompt, skill)
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(f"arm: {error}", file=sys.stderr)
        if out.is_dir() and not (out / "run.json").exists() and (out / "captures").exists():
            (out / "run.json").write_text(json.dumps({"status": "failed", "error": str(error)[:600], "time": time.time()}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
