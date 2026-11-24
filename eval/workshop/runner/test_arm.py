#!/usr/bin/env python3
"""Free end-to-end smoke test: the live provider transport is never invoked."""
import hashlib
import json
from pathlib import Path
import socket
import struct
import tempfile

from arm import run_arm


def verify_capture(out, capture):
    data = (out / capture["file"]).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    assert hashlib.sha256(data).hexdigest() == capture["sha256"]
    assert len(data) == capture["bytes"] > 1000
    assert struct.unpack_from(">II", data, 16) == (capture["imageWidth"], capture["imageHeight"])


def main():
    with tempfile.TemporaryDirectory(prefix="arm-preflight-") as root, socket.socket() as sibling_server:
        root = Path(root)
        sibling_server.bind(("127.0.0.1", 0))
        sibling_server.listen()
        port = sibling_server.getsockname()[1]
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            client, _ = sibling_server.accept()
            client.close()
        sibling = root / "sibling"
        sibling.mkdir()
        secret = sibling / "secret.txt"
        secret.write_text("SIBLING_PREFLIGHT_SENTINEL")
        auth = root / "fake-auth.json"
        auth.write_text("FAKE_AUTH_PREFLIGHT_SENTINEL")
        fixture = root / "fixture"
        fixture.mkdir()
        (fixture / "index.html").write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8">
<title>First arm</title><style>body {{ background: #c12530; color: white }}</style>
<h1>Own preview</h1><button id="action">Test</button><img src="asset.svg" alt="Own SVG">
<script>
document.querySelector('#action').addEventListener('click', (e) => e.currentTarget.textContent = 'Activated');
fetch('http://127.0.0.1:{port}/sibling').catch(() => {{}});
</script></html>''')
        (fixture / "asset.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="cyan"/></svg>')
        prompt = root / "prompt.txt"
        prompt.write_text("Build and inspect a private evaluation site.")
        skill = root / "skill"
        skill.mkdir()
        skill_bytes = b"---\nname: test-skill\ndescription: Use for transport smoke tests.\n---\n\nUNCHANGED_TEST_SKILL_BODY\n"
        (skill / "SKILL.md").write_bytes(skill_bytes)
        out = root / "arm"
        code = run_arm(out, fixture, prompt, skill, preflight=True,
                       probe={"sibling": str(secret), "port": port, "auth": str(auth)})
        report = json.loads((out / "run.json").read_text())
        assert code == 0 and report["status"] == "completed", (report, (out / "transport.log").read_text())
        assert report["usableOutput"] and report["preflight"]
        assert report["settings"]["model"] == "gpt-6.2-sol" and report["settings"]["provider"] == "openai"
        assert report["settings"]["thinking"] == "medium"
        assert sorted(report["settings"]["tools"]) == ["list_site", "preview", "read", "write_site"]
        assert report["settings"]["extensions"] == report["settings"]["contextFiles"] == []
        assert report["usage"]["tokens"] == {"input": 39, "output": 21, "cacheRead": 6, "cacheWrite": 0, "total": 66}
        assert report["providerRequests"] == 3 and report["mockSawNativeImage"]
        assert report["isolation"] == {"siblingVisible": False, "siblingTcpReachable": False, "authVisible": False, "authEnv": False}
        assert report["mockReadDenied"] == 3
        system_prompt = (out / "system-prompt.txt").read_text()
        assert "Use for transport smoke tests." in system_prompt and "UNCHANGED_TEST_SKILL_BODY" not in system_prompt
        assert report["skillReads"][0]["sha256"] == hashlib.sha256(skill_bytes).hexdigest()
        first = report["captures"]["first"]
        final = report["captures"]["final"]
        assert first["state"]["heading"] == "Own preview" and first["state"]["focus"] == "Activated"
        assert first["actionResults"][0]["ok"] and first["blockedRequests"] == [f"http://127.0.0.1:{port}/sibling"]
        assert first["pageErrors"] == first["networkErrors"] == []
        assert all(capture["state"]["heading"] == "Final site with JS" for capture in final.values())
        assert first["revision"] != final["desktop"]["revision"] == final["mobile"]["revision"]
        assert report["output"]["sha256"] == final["mobile"]["revision"]
        assert first["sha256"] != final["mobile"]["sha256"]
        for capture in (first, *final.values()):
            verify_capture(out, capture)
        sibling_server.setblocking(False)
        try:
            connection, _ = sibling_server.accept()
        except BlockingIOError:
            pass
        else:
            connection.close()
            raise AssertionError("Preview reached the sibling listener")
        assert set(report["output"]["files"]) == {"index.html", "asset.svg", "style.css", "app.js"}
        assert (out / "prompt.txt").read_bytes() == prompt.read_bytes()
        print("PASS: isolated own preview and native PNG, sibling/auth file and TCP blocked, skill bytes, desktop/mobile provenance, usage and exact Pi settings (0 live requests)")


if __name__ == "__main__":
    main()
