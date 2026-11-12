"""Smoke test for the studio server. It spends nothing: no render, no voice, no Shop download.

Start a second server so the one you are using is left alone, then run this against it:

    EMBER_PORT=4181 uv run server/ember.py          # in one terminal
    python3 server/tests/smoke.py                   # in another (add --model to also run two model checks)

Every check prints PASS or FAIL. The exit code is the number of failures.
The checks use the account "smoke@example.test" and make one project named "Smoke".
"""
import json
import sys
import urllib.error
import urllib.request

BASE = next((a for a in sys.argv[1:] if a.startswith("http")), "http://127.0.0.1:4181")
MODEL = "--model" in sys.argv
USER = "smoke@example.test"
fails = 0


def call(path, body=None, project=None, method=None, timeout=60):
    headers = {"X-Ember-User": USER}
    if project:
        headers["X-Ember-Project"] = project
    data = None
    if body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def events(text):
    return [json.loads(l[6:]) for l in text.split("\n") if l.startswith("data: ")]


def check(name, ok, detail=""):
    global fails
    fails += 0 if ok else 1
    print(("PASS  " if ok else "FAIL  ") + name + (("   " + str(detail)[:160]) if detail and not ok else ""))


code, body = call("/studio.html")
check("the studio page is served", code == 200 and "flow.js" in body, code)

code, body = call("/api/status")
status = json.loads(body) if code == 200 else {}
check("status answers and names a brain", code == 200 and "brain" in status, body)
check("status does not leak the render machine's address", "http" not in json.dumps(status.get("gpu") or {}), status.get("gpu"))

code, body = call("/api/projects", {"name": "Smoke"})
pid = (json.loads(body) if code == 200 else {}).get("id")
check("a project can be made", bool(pid), body)

code, body = call("/api/project", project=pid)
proj = json.loads(body) if code == 200 else {}
check("a new project is empty and has the three tracks", code == 200 and all(proj.get("tracks", {}).get(k) == [] for k in ("video", "audio", "captions")), body[:200])

code, body = call("/api/action", {"name": "not_a_thing", "args": {}}, pid)
check("an unknown action is refused (400)", code == 400, code)

code, body = call("/api/stop", {"what": "board"}, pid)
check("stop with nothing running is harmless", code == 200, code)

code, body = call("/api/approve", {"id": "ok_gone", "allow": True}, pid)
check("a stale approval is refused (404)", code == 404, code)

code, body = call("/api/action", {"name": "flow_film", "args": {"line": "", "shot": "A cup on a table, slow push in.", "seconds": 6, "approved": 0}}, pid, timeout=120)
ev = events(body)
check("filming without an approved price is refused, and nothing renders",
      code == 200 and any(e.get("type") == "error" for e in ev) and not any(e.get("type") == "flow_film" and e.get("rendered") for e in ev), body[-300:])

code, body = call("/api/action", {"name": "render", "args": {}}, pid, timeout=120)
fail = [e for e in events(body) if e.get("type") == "step" and e.get("state") == "fail"]
check("exporting an empty video fails with a plain reason", bool(fail) and "Error" not in str(fail[0].get("detail")) and "nothing" in str(fail[0].get("detail")).lower(), body[-300:])

code, body = call("/api/action", {"name": "flow_script", "args": {}}, pid, timeout=60)
check("the script step refuses to write about nothing", any(e.get("type") == "error" for e in events(body)) and not any(e.get("type") == "flow_script" for e in events(body)), body[-300:])

board = {"guided": True, "nodes": [{"id": "n1", "type": "subject", "x": 0, "y": 0, "d": {}}], "wires": [], "saved": 1}
code, body = call("/api/board", board, pid, method="PUT")
code2, body2 = call("/api/board", project=pid)
check("the board is saved beside the project and read back", code == 200 and code2 == 200 and json.loads(body2).get("nodes") == board["nodes"], body2[:160])
code, body = call("/api/board", {"nodes": "x"}, pid, method="PUT")
check("something that is not a board is refused (400)", code == 400, code)
code, body = call("/api/board", {"nodes": [], "wires": [], "pad": "x" * 450_000}, pid, method="PUT")
check("an oversized board is refused (413)", code == 413, code)

code, body = call("/api/chat", {"text": ""}, pid)
check("an empty chat message is refused (400)", code == 400, code)

code, body = call("/server/.env")
check("the key file is not served", code in (403, 404), code)
code, body = call("/server/data/users/")
check("user data is not served as files", code in (403, 404), code)

if MODEL:
    code, body = call("/api/action", {"name": "flow_script", "args": {"subject": {"kind": "idea", "text": "a paper plane gliding over a desk", "title": "a paper plane"},
                                                                     "creator": {"kind": "none"}, "make": "showcase", "seconds": 6}}, pid, timeout=180)
    ev = [e for e in events(body) if e.get("type") == "flow_script"]
    check("the script step writes a shot for an idea", bool(ev) and len(str(ev[0].get("shot") or "")) > 20, body[-300:])

    board = "Step 1, The subject: a paper plane (an idea, no product)\nStep 2, On camera: not answered yet\nFinal video: 0 clips\nWaiting on the person: step 2, on camera"
    code, body = call("/api/chat", {"text": "i want a video about a paper plane", "view": "editor", "board": board}, pid, timeout=240)
    ev = events(body)
    check("asked for a described video, Ember does not ask for money or render",
          code == 200 and not any(e.get("type") == "approval" for e in ev) and not any(e.get("type") == "step" and e.get("name") == "generate_clip" for e in ev), body[-300:])

print("\n" + ("All checks passed." if not fails else f"{fails} check(s) failed."))
sys.exit(fails)
