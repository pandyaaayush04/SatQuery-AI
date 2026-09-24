"""Run: python tests/test_auth.py  -- session cookie + per-user chat storage (temp SQLite db; Google's verify step is not called)."""
import os
import sys
import tempfile
import time
from pathlib import Path

os.environ["SATQUERY_DB"] = str(Path(tempfile.mkdtemp()) / "t.db")
os.environ["SATQUERY_SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from server import auth  # noqa: E402
from server.app import app  # noqa: E402


def demo():
    c = TestClient(app)
    assert c.get("/api/me").json() == {"user": None}
    assert c.get("/api/chats").status_code == 401  # guests can't read or write server-side history
    assert c.put("/api/chats/x", json=dict(title="t", updated_at=1, messages=[])).status_code == 401

    with auth.db() as con:
        for uid in ("u1", "u2"):
            con.execute("INSERT INTO users VALUES (?,?,?,?,?)", (uid, f"{uid}@x.com", uid.upper(), None, time.time()))
    cookie = auth._sign(f"u1|{time.time() + 60}")
    c.cookies.set(auth.COOKIE, cookie)
    assert c.get("/api/me").json()["user"]["email"] == "u1@x.com"

    msgs = [dict(id="a", role="user", text="hi"), dict(id="b", role="assistant", reply="hello")]
    assert c.put("/api/chats/c1", json=dict(title="hi", updated_at=5, messages=msgs)).status_code == 200
    assert c.put("/api/chats/c1", json=dict(title="hi!", updated_at=6, messages=msgs)).status_code == 200  # upsert, not duplicate
    got = c.get("/api/chats").json()
    assert len(got) == 1 and got[0]["title"] == "hi!" and got[0]["messages"] == msgs

    c2 = TestClient(app)  # a different user must not see u1's chats
    c2.cookies.set(auth.COOKIE, auth._sign(f"u2|{time.time() + 60}"))
    assert c2.get("/api/chats").json() == []
    assert c2.delete("/api/chats/c1").status_code == 200 and len(c.get("/api/chats").json()) == 1  # ...nor delete them

    c3 = TestClient(app)  # forged / expired cookies are rejected
    c3.cookies.set(auth.COOKIE, auth._sign(f"u1|{time.time() - 5}"))
    assert c3.get("/api/me").json()["user"] is None
    c3.cookies.set(auth.COOKIE, cookie[:-2] + "00")
    assert c3.get("/api/me").json()["user"] is None

    assert c.delete("/api/chats/c1").status_code == 200 and c.get("/api/chats").json() == []
    assert c.post("/api/auth/google", json=dict(credential="x")).status_code in (503, 401)  # not configured / bad token

    # email + password accounts
    c4 = TestClient(app)
    assert c4.post("/api/auth/register", json=dict(email="bad", password="longenough")).status_code == 400
    assert c4.post("/api/auth/register", json=dict(email="a@b.co", password="short")).status_code == 400
    r = c4.post("/api/auth/register", json=dict(email=" A@B.co ", password="hunter22!"))
    assert r.status_code == 200 and r.json()["user"]["email"] == "a@b.co"
    assert c4.get("/api/me").json()["user"]["email"] == "a@b.co"  # register signs you in
    assert c4.post("/api/auth/register", json=dict(email="a@b.co", password="another1!")).status_code == 409
    assert c4.post("/api/auth/register", json=dict(email="u1@x.com", password="another1!")).status_code == 409  # google-owned email
    c5 = TestClient(app)
    assert c5.post("/api/auth/login", json=dict(email="a@b.co", password="wrongpass")).status_code == 401
    assert c5.post("/api/auth/login", json=dict(email="nobody@b.co", password="hunter22!")).status_code == 401
    assert "Google" in c5.post("/api/auth/login", json=dict(email="u1@x.com", password="hunter22!")).json()["detail"]
    assert c5.post("/api/auth/login", json=dict(email="A@b.co", password="hunter22!")).status_code == 200
    assert c5.get("/api/me").json()["user"]["email"] == "a@b.co"
    with auth.db() as con:
        assert "hunter22" not in con.execute("SELECT hash FROM passwords").fetchone()[0]  # stored hashed
    print("auth ok")


if __name__ == "__main__":
    demo()
