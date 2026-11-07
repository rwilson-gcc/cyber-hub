"""
Cyber Security Learning Hub: static site + tiny progress API.

* Serves ./public (the hub and rooms) and a JSON API under /api.
* Learners are identified by a random ID issued here (GCC-XXXX-XXXX-XXXX). No names, emails or
  student numbers are ever stored: only the ID and the room state the browser sends.
* The ID travels in an X-Learner-Id header (not the URL) so it stays out of access logs.
* Storage is a single SQLite file in DATA_DIR (mount a volume there).

Environment:
  DATA_DIR      where hub.db lives                      (default /data)
  PUBLIC_DIR    the static site                         (default ../public)
  ADMIN_TOKEN   enables GET /api/admin/export.csv       (default: disabled)
"""
import csv
import io
import json
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
PUBLIC_DIR = Path(os.environ.get("PUBLIC_DIR", BASE.parent / "public"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
DB_PATH = DATA_DIR / "hub.db"

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford base32, matches js/learner.js
HUB_SLUG = "_hub"
MAX_BODY = 100_000      # bytes
MAX_STATE = 64_000      # bytes of stored JSON per room

# Rooms are discovered from public/rooms/*.html, so adding a room needs no server change.
ROOMS = sorted(p.stem for p in (PUBLIC_DIR / "rooms").glob("*.html")) if (PUBLIC_DIR / "rooms").is_dir() else []


# --------------------------------------------------------------------------- helpers
def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def valid_id(value: Optional[str]) -> bool:
    if not value or len(value) != 18 or not value.startswith("GCC-"):
        return False
    parts = value[4:].split("-")
    return len(parts) == 3 and all(len(p) == 4 and all(c in ALPHABET for c in p) for p in parts)


def new_id() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(12))
    return f"GCC-{raw[:4]}-{raw[4:8]}-{raw[8:]}"


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.execute(
            """CREATE TABLE IF NOT EXISTS learners(
                 id TEXT PRIMARY KEY, created_at TEXT NOT NULL, last_seen TEXT NOT NULL)"""
        )
        c.execute(
            """CREATE TABLE IF NOT EXISTS progress(
                 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                 slug TEXT NOT NULL, state TEXT NOT NULL,
                 tasks_done INTEGER NOT NULL DEFAULT 0, flag INTEGER NOT NULL DEFAULT 0,
                 updated_at TEXT NOT NULL, PRIMARY KEY(learner_id, slug))"""
        )


class Window:
    """Tiny in-memory sliding-window limiter (per process, which is fine for a single container)."""

    def __init__(self, limit: int, seconds: int):
        self.limit, self.seconds, self.hits = limit, seconds, defaultdict(deque)

    def _trim(self, key: str) -> deque:
        q, cutoff = self.hits[key], time.monotonic() - self.seconds
        while q and q[0] < cutoff:
            q.popleft()
        if not q:
            self.hits.pop(key, None)
            return self.hits[key]
        return q

    def blocked(self, key: str) -> bool:
        return len(self._trim(key)) >= self.limit

    def hit(self, key: str) -> None:
        self._trim(key).append(time.monotonic())
        if len(self.hits) > 20_000:  # keep memory bounded
            for k in list(self.hits)[:10_000]:
                self.hits.pop(k, None)


create_limit = Window(10, 60)     # new IDs per IP per minute
miss_limit = Window(20, 60)       # unknown-ID lookups per IP per minute (stops ID guessing)
api_limit = Window(300, 60)       # everything else


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# --------------------------------------------------------------------------- state validation
def _key_ok(k: Any) -> bool:
    return isinstance(k, str) and 0 < len(k) <= 60 and all(c.isalnum() or c in "-_" for c in k)


def clean_room_state(raw: Any) -> dict:
    """Keep only the shape js/room-progress.js produces, with sane limits."""
    if not isinstance(raw, dict):
        raise HTTPException(422, "state must be an object")
    fields = {k: v[:4000] for k, v in list((raw.get("fields") or {}).items())[:60] if _key_ok(k) and isinstance(v, str)}
    radios = {k: v[:40] for k, v in list((raw.get("radios") or {}).items())[:20] if _key_ok(k) and isinstance(v, str)}
    checks = {k: bool(v) for k, v in list((raw.get("checks") or {}).items())[:20] if _key_ok(k)}
    tasks = [t for t in (raw.get("tasks") or [])[:10] if isinstance(t, str) and t.isdigit() and len(t) <= 2]
    quizzes = [q for q in (raw.get("quizzes") or [])[:10] if _key_ok(q)]
    hints = raw.get("hints")
    hints = hints if isinstance(hints, int) and 0 <= hints <= 10 else 0
    flag_in = raw.get("flag") if isinstance(raw.get("flag"), dict) else {}
    saved_at = raw.get("savedAt")
    return {
        "v": 1,
        "fields": fields,
        "radios": radios,
        "checks": checks,
        "tasks": sorted(set(tasks), key=int),
        "quizzes": quizzes,
        "hints": hints,
        "dec": bool(raw.get("dec")),
        "flag": {"submitted": bool(flag_in.get("submitted")), "achieved": bool(flag_in.get("achieved"))},
        "savedAt": saved_at if isinstance(saved_at, (int, float)) and 0 < saved_at < 4e12 else 0,
    }


# --------------------------------------------------------------------------- auth
def current_learner(request: Request, x_learner_id: Optional[str] = Header(default=None)) -> str:
    ip = client_ip(request)
    if api_limit.blocked(ip):
        raise HTTPException(429, "Too many requests")
    api_limit.hit(ip)
    if not valid_id(x_learner_id):
        raise HTTPException(401, "Missing or malformed learner ID")
    if miss_limit.blocked(ip):
        raise HTTPException(429, "Too many attempts")
    with db() as c:
        row = c.execute("SELECT id FROM learners WHERE id=?", (x_learner_id,)).fetchone()
        if not row:
            miss_limit.hit(ip)
            raise HTTPException(404, "Unknown learner ID")
        c.execute("UPDATE learners SET last_seen=? WHERE id=?", (now(), x_learner_id))
    return x_learner_id


# --------------------------------------------------------------------------- API
api = APIRouter(prefix="/api")


class CreateBody(BaseModel):
    id: Optional[str] = None


class RoomBody(BaseModel):
    state: dict


class HubBody(BaseModel):
    ticks: dict
    savedAt: Optional[float] = None


@api.get("/health")
def health():
    return {"ok": True, "rooms": ROOMS}


@api.post("/learners", status_code=201)
def create_learner(request: Request, body: CreateBody = CreateBody()):
    ip = client_ip(request)
    if create_limit.blocked(ip):
        raise HTTPException(429, "Too many new IDs from this address. Try again in a minute.")
    create_limit.hit(ip)
    ts = now()
    with db() as c:
        if body.id is not None:                      # claiming an ID that was generated offline
            if not valid_id(body.id):
                raise HTTPException(422, "Malformed learner ID")
            if c.execute("SELECT 1 FROM learners WHERE id=?", (body.id,)).fetchone():
                miss_limit.hit(ip)
                raise HTTPException(409, "That ID is already registered")
            c.execute("INSERT INTO learners(id, created_at, last_seen) VALUES(?,?,?)", (body.id, ts, ts))
            return {"id": body.id, "created_at": ts}
        for _ in range(5):
            lid = new_id()
            try:
                c.execute("INSERT INTO learners(id, created_at, last_seen) VALUES(?,?,?)", (lid, ts, ts))
                return {"id": lid, "created_at": ts}
            except sqlite3.IntegrityError:
                continue
    raise HTTPException(503, "Could not allocate an ID")


@api.get("/me")
def me(lid: str = Depends(current_learner)):
    with db() as c:
        learner = c.execute("SELECT created_at FROM learners WHERE id=?", (lid,)).fetchone()
        rows = c.execute(
            "SELECT slug, state, tasks_done, flag, updated_at FROM progress WHERE learner_id=?", (lid,)
        ).fetchall()
    hub, rooms = {"ticks": {}, "savedAt": 0}, {}
    for r in rows:
        if r["slug"] == HUB_SLUG:
            hub = json.loads(r["state"])
        else:
            rooms[r["slug"]] = {"tasks_done": r["tasks_done"], "flag": bool(r["flag"]), "updated_at": r["updated_at"]}
    return {"id": lid, "created_at": learner["created_at"], "hub": hub, "rooms": rooms}


def _check_slug(slug: str) -> None:
    if slug not in ROOMS:
        raise HTTPException(404, "Unknown room")


@api.get("/me/rooms/{slug}")
def get_room(slug: str, lid: str = Depends(current_learner)):
    _check_slug(slug)
    with db() as c:
        r = c.execute("SELECT state, updated_at FROM progress WHERE learner_id=? AND slug=?", (lid, slug)).fetchone()
    if not r:
        return {"state": None, "updated_at": None}
    return {"state": json.loads(r["state"]), "updated_at": r["updated_at"]}


@api.put("/me/rooms/{slug}")
def put_room(slug: str, body: RoomBody, lid: str = Depends(current_learner)):
    _check_slug(slug)
    state = clean_room_state(body.state)
    blob = json.dumps(state, separators=(",", ":"))
    if len(blob.encode()) > MAX_STATE:
        raise HTTPException(413, "State too large")
    ts = now()
    with db() as c:
        c.execute(
            """INSERT INTO progress(learner_id, slug, state, tasks_done, flag, updated_at) VALUES(?,?,?,?,?,?)
               ON CONFLICT(learner_id, slug) DO UPDATE SET state=excluded.state, tasks_done=excluded.tasks_done,
               flag=excluded.flag, updated_at=excluded.updated_at""",
            (lid, slug, blob, len(state["tasks"]), int(state["flag"]["achieved"]), ts),
        )
    return {"ok": True, "updated_at": ts}


@api.put("/me/hub")
def put_hub(body: HubBody, lid: str = Depends(current_learner)):
    ticks = {k: bool(v) for k, v in body.ticks.items() if k in ROOMS}
    saved = body.savedAt if body.savedAt and 0 < body.savedAt < 4e12 else 0
    blob = json.dumps({"ticks": ticks, "savedAt": saved}, separators=(",", ":"))
    ts = now()
    with db() as c:
        c.execute(
            """INSERT INTO progress(learner_id, slug, state, tasks_done, flag, updated_at) VALUES(?,?,?,0,0,?)
               ON CONFLICT(learner_id, slug) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at""",
            (lid, HUB_SLUG, blob, ts),
        )
    return {"ok": True, "updated_at": ts}


@api.get("/admin/export.csv")
def export_csv(request: Request, authorization: Optional[str] = Header(default=None)):
    """Optional staff export: one row per learner ID. Disabled unless ADMIN_TOKEN is set."""
    if not ADMIN_TOKEN:
        raise HTTPException(404, "Not found")
    ip = client_ip(request)
    if miss_limit.blocked(ip):
        raise HTTPException(429, "Too many attempts")
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(supplied.encode(), ADMIN_TOKEN.encode()):
        miss_limit.hit(ip)
        raise HTTPException(401, "Unauthorised")
    with db() as c:
        learners = c.execute("SELECT id, created_at, last_seen FROM learners ORDER BY created_at").fetchall()
        prog = {}
        for r in c.execute("SELECT learner_id, slug, tasks_done, flag, updated_at FROM progress WHERE slug != ?", (HUB_SLUG,)):
            prog[(r["learner_id"], r["slug"])] = r
    out = io.StringIO()
    w = csv.writer(out)
    header = ["learner_id", "created_at", "last_seen"]
    for s in ROOMS:
        header += [f"{s}_tasks", f"{s}_flag", f"{s}_updated"]
    w.writerow(header)
    for l in learners:
        row = [l["id"], l["created_at"], l["last_seen"]]
        for s in ROOMS:
            p = prog.get((l["id"], s))
            row += [p["tasks_done"], "yes" if p["flag"] else "no", p["updated_at"]] if p else [0, "no", ""]
        w.writerow(row)
    return Response(out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="learning-hub-progress.csv"'})


# --------------------------------------------------------------------------- app
@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Cyber Security Learning Hub", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


@app.middleware("http")
async def guard(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY:
        return JSONResponse({"detail": "Request too large"}, status_code=413)
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    resp.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        "connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    )
    if request.url.path.startswith("/api"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


app.include_router(api)
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="site")
