"""Google sign-in + per-user chat storage (SQLite). Demo-grade on purpose.

Two ways in, same session cookie afterwards:
  * email + password: /api/auth/register and /api/auth/login. Passwords are hashed with scrypt (stdlib) + a per-user salt, kept in
    their own table so Google-only users simply have no row there.
  * Google. Flow ("Sign in with Google" button / Google Identity Services): the browser gets a signed ID token (JWT) from Google, POSTs it to
/api/auth/google, we verify it with Google's tokeninfo endpoint (audience must be OUR client id), upsert the user, and set an
HttpOnly session cookie. No client secret and no redirect handling are needed -- only GOOGLE_CLIENT_ID.

Config: GOOGLE_CLIENT_ID from the environment or from server/.env (KEY=VALUE lines). Without it the app still works for guests;
/api/config just reports google_client_id = null and the UI hides the sign-in button.
Storage: data/app.db (sqlite3 from the stdlib). Chats are stored per user as JSON. Guests keep chats in their browser only.
SQLite + a signed cookie is enough for one demo server; move to Postgres / a session store if it ever needs several instances.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

import requests
from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("SATQUERY_DB", ROOT / "data" / "app.db"))
COOKIE = "sq_session"
SESSION_DAYS = 14
MAX_CHATS_PER_USER = 100
MAX_CHAT_BYTES = 2_000_000


def _load_env_file():
    f = Path(__file__).resolve().parent / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_file()
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID") or None


def _secret() -> bytes:
    """Cookie-signing key: env SATQUERY_SECRET, else a random key generated once and kept in data/.secret."""
    if os.environ.get("SATQUERY_SECRET"):
        return os.environ["SATQUERY_SECRET"].encode()
    f = DB_PATH.parent / ".secret"
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip().encode()


_KEY = _secret()


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, created_at REAL);
        CREATE TABLE IF NOT EXISTS passwords (user_id TEXT PRIMARY KEY, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT, updated_at REAL, messages TEXT,
            PRIMARY KEY (id, user_id)
        );
        """
    )
    return con


# ---- signed session cookie: base64(user_id|expiry).hmac
def _sign(payload: str) -> str:
    mac = hmac.new(_KEY, payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(payload.encode()).decode() + "." + mac


def _unsign(token: str | None) -> str | None:
    try:
        b64, mac = (token or "").rsplit(".", 1)
        payload = base64.urlsafe_b64decode(b64.encode()).decode()
        if not hmac.compare_digest(mac, hmac.new(_KEY, payload.encode(), hashlib.sha256).hexdigest()):
            return None
        user_id, exp = payload.rsplit("|", 1)
        return user_id if float(exp) > time.time() else None
    except Exception:
        return None


def current_user(token: str | None) -> dict | None:
    uid = _unsign(token)
    if not uid:
        return None
    with db() as con:
        row = con.execute("SELECT id, email, name, picture FROM users WHERE id = ?", (uid,)).fetchone()
    return dict(row) if row else None


def _require_user(token: str | None) -> dict:
    u = current_user(token)
    if not u:
        raise HTTPException(401, "sign in required")
    return u


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    return salt.hex() + "$" + hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1).hex()


def check_password(pw: str, stored: str) -> bool:
    salt, h = stored.split("$", 1)
    return hmac.compare_digest(h, hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1).hex())


def _start_session(response: Response, user_id: str):
    exp = time.time() + SESSION_DAYS * 86400
    response.set_cookie(COOKIE, _sign(f"{user_id}|{exp}"), max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", path="/")


def verify_google_credential(credential: str) -> dict:
    """Validate a Google ID token via Google's tokeninfo endpoint; returns the claims or raises 401."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not configured (set GOOGLE_CLIENT_ID)")
    try:
        r = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential}, timeout=10)
    except requests.RequestException:
        raise HTTPException(502, "could not reach Google to verify the sign-in")
    if r.status_code != 200:
        raise HTTPException(401, "invalid Google sign-in token")
    c = r.json()
    if c.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "token was issued for a different app")
    if c.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(401, "unexpected token issuer")
    if str(c.get("email_verified")).lower() != "true":
        raise HTTPException(401, "Google account email is not verified")
    return c


router = APIRouter(prefix="/api")


class GoogleBody(BaseModel):
    credential: str


class PasswordBody(BaseModel):
    email: str
    password: str


def _clean(body: PasswordBody) -> tuple[str, str]:
    email = body.email.strip().lower()
    if len(email) > 254 or "@" not in email or "." not in email.rsplit("@", 1)[-1] or " " in email:
        raise HTTPException(400, "enter a valid email address")
    if not 8 <= len(body.password) <= 128:
        raise HTTPException(400, "password must be 8-128 characters")
    return email, body.password


class ChatBody(BaseModel):
    title: str
    updated_at: float
    messages: list


@router.get("/config")
def config():
    return dict(google_client_id=GOOGLE_CLIENT_ID)


@router.post("/auth/google")
def auth_google(body: GoogleBody, response: Response):
    c = verify_google_credential(body.credential)
    with db() as con:
        con.execute(
            "INSERT INTO users (id, email, name, picture, created_at) VALUES (?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name, picture=excluded.picture",
            (c["sub"], c.get("email"), c.get("name") or c.get("email"), c.get("picture"), time.time()),
        )
    _start_session(response, c["sub"])
    return dict(user=dict(id=c["sub"], email=c.get("email"), name=c.get("name") or c.get("email"), picture=c.get("picture")))


# no rate limiting / lockout on these two -- fine for a demo box; put one in front before this faces the open internet.
@router.post("/auth/register")
def auth_register(body: PasswordBody, response: Response):
    email, pw = _clean(body)
    uid = "pw_" + secrets.token_hex(12)
    with db() as con:
        if con.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone():
            raise HTTPException(409, "an account with this email already exists -- log in instead")
        con.execute("INSERT INTO users (id, email, name, picture, created_at) VALUES (?,?,?,?,?)", (uid, email, email.split("@")[0], None, time.time()))
        con.execute("INSERT INTO passwords (user_id, hash) VALUES (?,?)", (uid, hash_password(pw)))
    _start_session(response, uid)
    return dict(user=dict(id=uid, email=email, name=email.split("@")[0], picture=None))


@router.post("/auth/login")
def auth_login(body: PasswordBody, response: Response):
    email, pw = body.email.strip().lower(), body.password
    with db() as con:
        row = con.execute(
            "SELECT u.id, u.email, u.name, u.picture, p.hash FROM users u LEFT JOIN passwords p ON p.user_id = u.id WHERE lower(u.email) = ?", (email,)
        ).fetchone()
    if row and not row["hash"]:
        raise HTTPException(401, "this account uses Google sign-in -- use the Google button")
    if not row or not check_password(pw, row["hash"]):
        raise HTTPException(401, "wrong email or password")
    _start_session(response, row["id"])
    return dict(user=dict(id=row["id"], email=row["email"], name=row["name"], picture=row["picture"]))


@router.get("/me")
def me(sq_session: str | None = Cookie(default=None)):
    return dict(user=current_user(sq_session))


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return dict(ok=True)


@router.get("/chats")
def list_chats(sq_session: str | None = Cookie(default=None)):
    u = _require_user(sq_session)
    with db() as con:
        rows = con.execute("SELECT id, title, updated_at, messages FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?", (u["id"], MAX_CHATS_PER_USER)).fetchall()
    return [dict(id=r["id"], title=r["title"], updatedAt=r["updated_at"], messages=json.loads(r["messages"])) for r in rows]


@router.put("/chats/{chat_id}")
def put_chat(chat_id: str, body: ChatBody, sq_session: str | None = Cookie(default=None)):
    u = _require_user(sq_session)
    data = json.dumps(body.messages)
    if len(data) > MAX_CHAT_BYTES:
        raise HTTPException(413, "chat too large to save")
    with db() as con:
        con.execute(
            "INSERT INTO chats (id, user_id, title, updated_at, messages) VALUES (?,?,?,?,?) "
            "ON CONFLICT(id, user_id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at, messages=excluded.messages",
            (chat_id, u["id"], body.title[:200], body.updated_at, data),
        )
        # keep only the newest MAX_CHATS_PER_USER per user
        con.execute(
            "DELETE FROM chats WHERE user_id = ? AND id NOT IN (SELECT id FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?)",
            (u["id"], u["id"], MAX_CHATS_PER_USER),
        )
    return dict(ok=True)


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str, sq_session: str | None = Cookie(default=None)):
    u = _require_user(sq_session)
    with db() as con:
        con.execute("DELETE FROM chats WHERE id = ? AND user_id = ?", (chat_id, u["id"]))
    return dict(ok=True)
