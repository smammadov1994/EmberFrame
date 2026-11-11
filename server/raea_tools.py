"""
raea for Ember: motion graphics, word-synced captions, titles, end cards and whole ads, written as code.

raea (https://github.com/shinyobjectz/raea) renders React/TypeScript compositions on this machine's GPU.
This file gives Ember three tools so it can use the whole engine the way a person at a terminal would:

    raea_docs   read raea's own manual: the skill, the craft guides, the SDK and CLI references
    raea_files  the user's raea project folder: bring library media in, write and read source files
    raea        run a raea command in that folder (cut, check, render, media, song, world ...) and
                bring what it made back into the library and onto the timeline

ember.py loads it with one line, `raea_tools.install(globals())`, placed after TOOLS and SYSTEM exist.
If raea is not installed the line does nothing and the studio runs as before.

Walls, same as the rest of the studio: every path stays inside the user's own folder; commands that open
windows, install software, run other programs or spend money outside the studio are refused (the owner can
lift that on their own machine with EMBER_RAEA_ALLOW=all); anything built from another creator's reference
stays a reference and cannot be exported.
"""
from __future__ import annotations

import json, os, shutil, subprocess, time
from pathlib import Path
from typing import Any

HOME = Path.home()
RAEA = shutil.which("raea") or str(HOME / ".local/bin/raea")
SHARE = HOME / ".raea/share/raea/skills/raea"
ENV_PATH = f"{HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

TEXT = {".tsx", ".ts", ".json", ".css", ".md", ".txt", ".srt", ".html", ".svg", ".glsl", ".wgsl"}
MEDIA = {".mp4", ".mov", ".png", ".jpg", ".jpeg", ".webp", ".wav", ".mp3", ".m4a"}
SKIP_DIRS = {"node_modules", ".cache", ".git", ".raea"}

# What Ember may run. Everything else in `raea --help` either opens a window on the server, installs or
# downloads software, runs another program (Blender, Godot, a shell), or spends money with an outside provider.
ALLOWED = {"render", "check", "cut", "frame", "part", "brand", "guide", "context", "skill", "init", "media", "song",
           "sounds", "track", "world", "findings", "scene", "solid", "physics", "sao", "tokensynth", "next", "spec"}
MEDIA_SUB = {"probe", "still", "sheet", "audio", "loudness", "motion", "cuts", "freezes", "proxy", "trim", "concat"}
WHY_NOT = {
    "gen": "raea gen spends money with outside providers. Film new footage with generate_clip and voices with speak instead.",
    "show": "raea show posts to the raea desktop app, which the studio does not use. Bring results back with import_output.",
    "play": "raea play opens a window on the server.", "app": "raea app opens a window on the server.",
    "add": "Installing npm packages is not allowed here. Write the code in the project instead.",
    "install": "Installing npm packages is not allowed here.", "run": "Running free programs is not allowed here; put the logic in a composition.",
    "blender": "Blender is not available in the studio.", "godot": "Godot is not available in the studio.",
}

E: dict[str, Any] = {}                                       # ember.py's globals, set by install()


def available() -> bool:
    return Path(RAEA).exists()


def project_dir(store) -> Path:
    d = store.dir / "raea"
    for sub in ("media", "out"):
        (d / sub).mkdir(parents=True, exist_ok=True)
    return d


def inside(root: Path, rel: str) -> Path:
    """A path the model gave, held inside the project folder."""
    rel = str(rel).strip()
    if not rel or rel.startswith(("/", "~")) or ".." in Path(rel).parts:
        raise ValueError(f'"{rel}" is not a path inside the raea project. Use paths like edit.tsx, media/a_123.mp4, out/ad.mp4.')
    p = (root / rel).resolve()
    if not p.is_relative_to(root.resolve()):
        raise ValueError(f'"{rel}" points outside the raea project.')
    return p


def listing(root: Path) -> list[str]:
    out = []
    for p in sorted(root.rglob("*")):
        if p.is_file() and not (set(p.relative_to(root).parts) & SKIP_DIRS):
            out.append(f"{p.relative_to(root)}  ({p.stat().st_size // 1024 or 1} KB)")
    return out[:200]


def marks(root: Path) -> dict[str, Any]:
    f = root / ".ember.json"
    return json.loads(f.read_text()) if f.exists() else {"references": []}


# --------------------------------------------------------------------------- #
# raea_docs
# --------------------------------------------------------------------------- #
def t_raea_docs(turn, topic: str = "skill", topics: list[str] | None = None) -> dict[str, Any]:
    if topics:                                               # several guides in one call: a turn has a limited number of steps
        out, room = {}, 70000
        for t in list(topics)[:6]:
            try:
                text = one_doc(str(t))["text"][:max(room, 0)]
            except ValueError as e:
                text = str(e)
            out[str(t)] = text
            room -= len(text)
        return {"guides": out}
    return one_doc(topic)


def one_doc(topic: str = "skill") -> dict[str, Any]:
    topic = (topic or "skill").strip().lower().removesuffix(".md")
    if topic in ("skill", "start", "overview"):
        cmd = ["skill"]
    elif topic in ("cli", "feed", "files", "sdk"):
        cmd = ["skill", "--reference", topic]
    elif topic in ("guides", "list", "index"):
        cmd = ["guide"]
    else:
        f = (SHARE / f"{topic}.md").resolve()
        if f.is_file() and f.is_relative_to(SHARE.resolve()):
            return {"topic": topic, "text": f.read_text()[:40000]}
        if not all(c.isalnum() or c in "-_/" for c in topic) or ".." in topic:
            raise ValueError("Topic names are plain words, e.g. motion, craft, pitch, typeset, footage, sound, sdk.")
        cmd = ["guide", topic]
    r = subprocess.run([RAEA, *cmd], capture_output=True, text=True, timeout=60, env={**os.environ, "PATH": ENV_PATH})
    text = (r.stdout or r.stderr or "").strip()
    if r.returncode != 0 or not text:
        raise ValueError(f'raea has no guide called "{topic}". Call raea_docs with topic "guides" for the list.')
    return {"topic": topic, "text": text[:40000]}


# --------------------------------------------------------------------------- #
# raea_files
# --------------------------------------------------------------------------- #
def t_raea_files(turn, use_assets: list[str] | None = None, write: list[dict[str, Any]] | None = None,
                 read: list[str] | None = None, delete: list[str] | None = None) -> dict[str, Any]:
    root = project_dir(turn.store)
    out: dict[str, Any] = {}
    if use_assets:
        p = turn.project()
        m = marks(root)
        brought = {}
        for aid in list(use_assets)[:12]:
            src = turn.store.asset_path(p, aid)
            dest = root / "media" / f"{aid}{src.suffix.lower()}"
            if not dest.exists():
                shutil.copyfile(src, dest)
            a = p["assets"][aid]
            if a.get("reference") and aid not in m["references"]:
                m["references"].append(aid)
            brought[aid] = {"path": f"media/{dest.name}", "name": a["name"], "seconds": a.get("duration"),
                            "size": f'{a.get("width")}x{a.get("height")}', "reference": bool(a.get("reference"))}
        (root / ".ember.json").write_text(json.dumps(m))
        out["media"] = brought
    if write:
        wrote = []
        for f in list(write)[:20]:
            path = inside(root, f.get("path", ""))
            if path.suffix.lower() not in TEXT:
                raise ValueError(f'{path.name}: only source and text files can be written ({", ".join(sorted(TEXT))}).')
            content = str(f.get("content", ""))
            if len(content) > 300_000:
                raise ValueError(f"{path.name} is too large to write in one go.")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            wrote.append(str(path.relative_to(root.resolve())))
        out["wrote"] = wrote
    if delete:
        gone = []
        for rel in list(delete)[:40]:
            path = inside(root, rel)
            if path.is_file():
                path.unlink()
                gone.append(rel)
        out["deleted"] = gone
    if read:
        texts = {}
        for rel in list(read)[:8]:
            path = inside(root, rel)
            if not path.is_file():
                texts[rel] = "(no such file)"
            elif path.suffix.lower() not in TEXT:
                texts[rel] = "(not a text file; see it with the raea tool's preview, or import it and use look_at)"
            else:
                texts[rel] = path.read_text(errors="replace")[:24000]
        out["read"] = texts
    out["files"] = listing(root)
    return out


# --------------------------------------------------------------------------- #
# raea
# --------------------------------------------------------------------------- #
def check_args(root: Path, args: list[str]) -> list[str]:
    if not isinstance(args, list) or not args or not all(isinstance(a, (str, int, float)) for a in args):
        raise ValueError('args is the command as a list of words, e.g. ["render", "edit.tsx", "-o", "out/ad.mp4", "--kbps", "9000"].')
    args = [str(a) for a in args][:60]
    if args[0] == "raea":
        args = args[1:]
    sub = args[0] if args else ""
    everything = os.environ.get("EMBER_RAEA_ALLOW", "").lower() == "all"
    if sub not in ALLOWED and not everything:
        raise ValueError(WHY_NOT.get(sub) or f'"raea {sub}" is not available in the studio. Available: {", ".join(sorted(ALLOWED))}.')
    if sub == "media" and (len(args) < 2 or args[1] not in MEDIA_SUB) and not everything:
        raise ValueError(f'raea media takes one of: {", ".join(sorted(MEDIA_SUB))}.')
    if sub == "skill" and "install" in args:
        raise ValueError("Read the skill with raea_docs.")
    if sub == "render" and any(a.lower().endswith((".mp4", ".mov")) for a in args) and "--kbps" not in args and "--quality" not in args:
        args += ["--kbps", "9000"]                           # raea's own default makes files ten times the size
    for a in args[1:]:
        if a.startswith(("/", "~")) or ".." in Path(a).parts or a.startswith("file:"):
            raise ValueError(f'"{a}": paths must stay inside the raea project (edit.tsx, media/..., out/...).')
    return args


def stills(paths: list[Path]) -> list[dict[str, Any]]:
    """Pictures for the model to look at, small."""
    import base64
    out = []
    for path in paths[:6]:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-vf", "scale=420:-2", "-q:v", "6",
                            "-f", "image2pipe", "-c:v", "mjpeg", "-"], capture_output=True, timeout=60)
        if r.stdout:
            out.append({"type": "text", "text": f"{path.name}:"})
            out.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(r.stdout).decode()}})
    return out


def t_raea(turn, args: list[str], import_output: str | None = None, name: str | None = None, add_to_timeline: bool = False,
           replace_clip: str | None = None, preview: list[str] | None = None) -> Any:
    root = project_dir(turn.store)
    args = check_args(root, args)
    before = {p: p.stat().st_mtime for p in root.rglob("*") if p.is_file() and not (set(p.relative_to(root).parts) & SKIP_DIRS)}
    turn.emit({"type": "progress", "note": {"render": "Rendering the composition", "cut": "Listening for the words",
                                            "check": "Checking the frames"}.get(args[0], f"Running raea {args[0]}")})
    try:
        r = subprocess.run([RAEA, *args], cwd=root, capture_output=True, text=True, timeout=1500, stdin=subprocess.DEVNULL,
                           env={**os.environ, "PATH": ENV_PATH})
    except subprocess.TimeoutExpired:
        raise RuntimeError("raea ran for 25 minutes without finishing and was stopped. Render a shorter range or a lower size first.")
    changed = [str(p.relative_to(root)) for p in sorted(root.rglob("*")) if p.is_file()
               and not (set(p.relative_to(root).parts) & SKIP_DIRS) and before.get(p) != p.stat().st_mtime][:40]
    noise = "\n".join(l for l in (r.stderr or "").splitlines() if "WARN" not in l and l.strip())   # the engine's own chatter
    res: dict[str, Any] = {"exit": r.returncode, "output": (r.stdout or "")[-7000:], "errors": noise[-3000:], "new_or_changed": changed}
    if import_output and r.returncode == 0:
        path = inside(root, import_output)
        if not path.is_file() or path.suffix.lower() not in MEDIA or path.stat().st_size < 500:
            res["import"] = f"{import_output} was not made, so nothing was brought into the library."
        else:
            with turn.store.lock:
                p = turn.project()
                ref = bool(marks(root)["references"])           # anything built beside a reference stays a reference
                a = turn.store.add_asset(p, path, name or path.stem, "edited", reference=ref,
                                         meta={"from": "raea", "command": " ".join(args)[:300]})
                if a["kind"] != "image" and replace_clip:
                    track, i = E["find_clip"](p, replace_clip)
                    p["tracks"][track][i] = {"id": E["new_id"]("c"), "asset": a["id"], "in": 0, "out": a["duration"],
                                             **({"start": p["tracks"][track][i].get("start", 0)} if track == "audio" else {})}
                elif a["kind"] == "video" and add_to_timeline:
                    p["tracks"]["video"].append({"id": E["new_id"]("c"), "asset": a["id"], "in": 0, "out": a["duration"]})
                p = turn.commit(p)
            res["import"] = {"asset": a["id"], "kind": a["kind"], "seconds": a["duration"], "size": f'{a["width"]}x{a["height"]}', "reference": ref}
            res["timeline"] = E["digest"](p)
    if preview:
        pics = stills([q for q in (inside(root, x) for x in preview) if q.is_file() and q.suffix.lower() in MEDIA])
        if pics:
            return [{"type": "text", "text": json.dumps(res)}, *pics]
    return res


# --------------------------------------------------------------------------- #
# What Ember is told
# --------------------------------------------------------------------------- #
TOOLS = [
 {"name": "raea_docs", "fn": t_raea_docs, "label": "Reading the motion manual",
  "description": "Read raea's own manual before writing or changing a composition. raea is the studio's motion engine: React and TypeScript compositions rendered on our GPU. "
   "topic 'skill' is the overview and the order of work; 'guides' lists every guide; then any guide by name, e.g. 'craft' (the floor, read before any edit), 'motion' (writing compositions), "
   "'pitch' / 'explain' / 'story' (kinds of video), 'typeset', 'layout', 'animate', 'retime', 'recut', 'polish', 'footage', 'graphics', 'sound', 'delivery', '3d'; "
   "and the references 'sdk' (components and hooks), 'cli' (every command and flag), 'files', 'feed'. Pass topics, a list, to read up to six in one call: do that rather than one call per guide. Read 'skill' and 'motion' the first time in a chat; read the ones a request calls for after that.",
  "input_schema": {"type": "object", "properties": {"topic": {"type": "string"}, "topics": {"type": "array", "items": {"type": "string"}}}}},
 {"name": "raea_files", "fn": t_raea_files, "label": "Setting up the composition",
  "description": "The person's raea project folder. One call can do several things, in this order: use_assets copies library files into media/ (they become media/<asset id>.<ext>, the paths a composition imports); "
   "write saves source files [{path, content}] such as edit.tsx, cuts.ts, components/Tag.tsx, brief.ts; delete removes files; read returns the text of files. It always returns the folder's file list. "
   "Paths are relative to the project folder. Media never gets written here by hand: it comes from use_assets or from raea commands.",
  "input_schema": {"type": "object", "properties": {
     "use_assets": {"type": "array", "items": {"type": "string"}, "description": "Library asset ids to copy into media/."},
     "write": {"type": "array", "items": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}},
     "read": {"type": "array", "items": {"type": "string"}}, "delete": {"type": "array", "items": {"type": "string"}}}}},
 {"name": "raea", "fn": t_raea, "label": "Running the motion engine",
  "description": "Run one raea command inside the person's raea project folder and get its output. args is the command as a list of words, without the leading 'raea'. The ones you will use most: "
   '["init"] (starter edit.tsx, cuts.ts, components/); ["cut", "media/TAKE.mp4", "a line she says"] or ["cut", "media/TAKE.mp4", "--at", "0-12.4"] (writes cuts.ts and words.json with word-level timing heard from the clip); '
   '["check", "edit.tsx", "--quick"] (text clipped, cramped or under the app buttons, in about a second); ["render", "edit.tsx", "-o", "out/NAME.mp4", "--kbps", "9000", "--manifest", "render.json"]; '
   '["render", "edit.tsx", "--frame", "90", "-o", "out/f90.png"] (one still); ["check", "out/NAME.mp4", "--manifest", "render.json", "--words", "words.json", "--platform", "tiktok"]; '
   '["media", "probe"|"sheet"|"cuts"|"loudness"|"freezes", "media/FILE"]; ["song", "media/TRACK.mp3"] (beats and sections); ["world", "edit.tsx", "--frame", "90"]; ["frame", "media/TAKE.mp4"]; ["part", "list"]; ["brand", "example.com"]. '
   "raea_docs topic 'cli' has every command and flag. All paths are relative to the project folder. "
   "import_output brings a file the command made (video, still or sound) into the library; with add_to_timeline it is appended to the cut, with replace_clip it takes that clip's place. "
   "preview is a list of stills or videos in the project to see for yourself (first frame of a video), including the file this same command makes: render a still with --frame and put its path in preview in the same call, before you render the whole thing. "
   "A video render with no --kbps gets --kbps 9000. "
   "A render takes roughly as long as the video for simple type, longer with footage. If a command fails, read its errors, fix the file, run it again.",
  "input_schema": {"type": "object", "properties": {"args": {"type": "array", "items": {"type": "string"}},
     "import_output": {"type": "string", "description": "Project path of the file to bring into the library, e.g. out/ad.mp4."},
     "name": {"type": "string", "description": "Library name for the imported file."},
     "add_to_timeline": {"type": "boolean"}, "replace_clip": {"type": "string"},
     "preview": {"type": "array", "items": {"type": "string"}, "description": "Project paths of pictures or videos to look at."}},
   "required": ["args"]}},
]

SYSTEM = """
Motion graphics: raea
- You have a real motion engine, raea: compositions written in React and TypeScript, rendered on our own GPU into video. Reach for it whenever the picture needs designed, moving type or graphics that the timeline's plain captions and make_clip's ffmpeg filters cannot do well: captions that light up word by word in time with the speech, a product name tag, lower thirds, titles, an end card with the offer, a price or feature callout, animated numbers and charts, a wipe between two clips, a whole ad built from footage plus type. Text drawn by raea is code, so it is always spelled right; never ask the video model to draw words.
- The work, in order: one raea_docs call with topics (the first time in a chat: 'skill', 'motion', and the one or two guides the job needs; the manual points to more than you need, so do not read it all); raea_files with use_assets to bring the footage in and write to save edit.tsx; raea ["check", "edit.tsx", "--quick"]; render a still with --frame and look at it with preview in that same call; fix; then render the video with import_output and add_to_timeline or replace_clip. Say what you made in one line.
- A turn has a limited number of steps and the render that brings the clip into the library must be one of them. Budget: one docs call, at most three rounds of stills, then the final render. A good clip delivered beats a perfect one that never lands; offer the polish as a next step.
- A composition that sits over footage plays the footage itself inside raea (a <Video> under the graphics) and comes back as one finished clip that replaces the original clip on the timeline. Then clear the timeline's own captions for that stretch so words are not drawn twice.
- Size: 1080x1920 at 30 fps for 9:16, 1920x1080 for 16:9, 1080x1080 for 1:1. Keep text out of the app's furniture on vertical video: nothing in the top 240 px, the bottom 460 px or the right 150 px.
- Word timing: run ["cut", "media/TAKE.mp4", "zzzz"] once first (the made-up line is never found, but raea listens to the clip and keeps the words), then ["cut", "media/TAKE.mp4", "--at", "0-LENGTH"]; after that useWords() in the composition has every word with its frames.
- Known traps: CSS clip-path is ignored (to reveal part of a layer, put it in a box with overflow hidden and a fixed-size inner); always pass --kbps 9000 on a video render or the file is huge; the checker's "contrast" finding on text that sits on its own dark plate is a false alarm.
- House look unless the person's brand says otherwise: ground #0B0B0A, ink #F2F1EE, accent #F25A2B (fills, with #160A05 text on top), accent text #FF7F52, fonts Geist and Geist Mono, hard cuts and short eases, no emoji.
- The rules that do not bend still hold inside raea: anything built with a reference clip in it stays a reference and cannot be exported, product facts only, no invented numbers, and the AI-generated label stays.
- raea commands that open windows, install software or spend money outside the studio are not available; film new footage with generate_clip and record voices with speak, then compose them in raea.
"""


def install(ember: dict[str, Any]) -> bool:
    """Add the raea tools to Ember. Called once by ember.py with its globals()."""
    if not available():
        return False
    E.update(ember)
    have = {t["name"] for t in ember["TOOLS"]}
    ember["TOOLS"] += [t for t in TOOLS if t["name"] not in have]
    if "TOOL_BY_NAME" in ember:
        ember["TOOL_BY_NAME"].update({t["name"]: t for t in TOOLS})
    if "Motion graphics: raea" not in ember.get("SYSTEM", ""):
        head, sep, tail = ember["SYSTEM"].partition("\nRules that do not bend")
        ember["SYSTEM"] = head.rstrip("\n") + "\n" + SYSTEM + sep + tail
    return True
