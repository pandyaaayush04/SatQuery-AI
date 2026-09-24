"""SatQuery AI backend. Run from the project root: uvicorn server.app:app --reload --port 8000

Sessions live in memory only (SESSIONS dict) -- fine for a single-process demo, gone on restart.
swap for a real store (redis/sqlite) only if the demo needs multiple server instances or persistence.

The QLoRA-tuned VLM loads lazily on the first request that needs it (captioning/grounding/open vqa/fusion/chat) --
first such request eats the model load time, every request after is fast. Presence/change questions never touch it;
they're answered straight from satquery.physics/change either way.

POST /api/chat is the front door for the UI: one message in, routed to (1) small talk, (2) a named place -> live
Sentinel-2 chip -> the same pipeline as an uploaded image, (3) the current session's imagery, (4) plain chat.
"""
import io
import re
import shutil
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

import numpy as np
import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel

from satquery.bands import load_bands, render_display
from satquery.change import change_report
from satquery.chat import GUIDE, SYSTEM_PROMPT, is_change_question, is_imagery_question, refers_to_session, smalltalk
from satquery.controller import answer, detect_concept
from satquery.physics import optical_mask
from satquery.places import fetch_chip, geocode, wiki_summary
from satquery.preflight import MODES, preflight, read_meta
from satquery.vlm import QwenVLM
from server.auth import router as auth_router

app = FastAPI(title="SatQuery AI")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])  # dev only; credentials need an explicit origin, not "*"
app.include_router(auth_router)

SESSIONS: dict[str, dict] = {}  # id -> {dir, paths, mode, modalities, metas, kind?}
_VLM = QwenVLM()  # not loaded yet -- QwenVLM.ask() itself lazy-loads the model+adapter on first call


class AskBody(BaseModel):
    session_id: str
    question: str


class ChatBody(BaseModel):
    text: str
    session_id: str | None = None
    history: list[dict] = []  # [{"role": "user"|"assistant", "text": str}], most recent last


def _session(session_id: str) -> dict:
    s = SESSIONS.get(session_id)
    if not s:
        raise HTTPException(404, "session not found (server may have restarted)")
    return s


def _detect_mode(paths: list[str]) -> str:
    """1 image -> single. 2 images -> cross_modal if one optical + one SAR, else bitemporal.
    Best-effort: an unreadable/corrupt file falls back to a guess and lets preflight() report the real error."""
    if len(paths) != 2:
        return "single"
    try:
        mods = {read_meta(p).modality for p in paths}
        return "cross_modal" if mods == {"optical", "sar"} else "bitemporal"
    except Exception:
        return "bitemporal"


def _register(sid, d, paths, mode, mods, **extra):
    rep = preflight(paths, mode, mods)
    SESSIONS[sid] = dict(dir=d, paths=paths, mode=mode, modalities=mods, metas=rep.metas, **extra)
    meta_by_path = {m.path: m for m in rep.metas}
    return dict(
        session_id=sid, ok=rep.ok, mode=mode,
        findings=[dict(level=f.level, code=f.code, msg=f.msg) for f in rep.findings],
        files=[dict(index=i, name=Path(p).name, modality=meta_by_path[p].modality if p in meta_by_path else None) for i, p in enumerate(paths)],
    )


@app.post("/api/session")
async def create_session(files: list[UploadFile] = File(...), mode: str = Form("auto"), modalities: str = Form("")):
    """mode: "auto" (default, recommended) or an explicit single|cross_modal|bitemporal override.
    modalities: comma-separated, e.g. "optical,sar" (blank = auto-detect per file too)."""
    if mode != "auto" and mode not in MODES:
        raise HTTPException(400, f"mode must be \"auto\" or one of {MODES}")
    if not 1 <= len(files) <= 2:
        raise HTTPException(400, "attach 1 image (single) or 2 images (fusion / before-after)")
    sid = uuid.uuid4().hex
    d = Path(tempfile.mkdtemp(prefix=f"satquery_{sid}_"))
    paths = []
    for f in files:
        p = d / f.filename
        with open(p, "wb") as out:
            shutil.copyfileobj(f.file, out)
        paths.append(str(p))
    resolved_mode = _detect_mode(paths) if mode == "auto" else mode
    mods = [m.strip() or None for m in modalities.split(",")] if modalities else None
    return _register(sid, d, paths, resolved_mode, mods, kind="upload")


@app.get("/api/preview/{session_id}/{index}")
def preview(session_id: str, index: int):
    s = _session(session_id)
    if index >= len(s["metas"]):
        raise HTTPException(422, "input failed validation, no preview available")
    m = s["metas"][index]
    try:
        img = render_display(m.path, m.modality)
    except ValueError as e:
        raise HTTPException(422, str(e))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


@app.get("/api/overlay/{session_id}")
def overlay(session_id: str):
    """Bi-temporal only: the change mask as a translucent red PNG, same pixel size as the preview."""
    s = _session(session_id)
    if s["mode"] != "bitemporal" or len(s["metas"]) != 2:
        raise HTTPException(400, "overlay is only available for a valid bi-temporal session")
    order = sorted(s["metas"], key=lambda m: m.when)
    b = {order[0].modality: load_bands(order[0].path, order[0].modality)}
    a = {order[1].modality: load_bands(order[1].path, order[1].modality)}
    rep = change_report(b, a)
    if not rep["available"]:
        raise HTTPException(422, rep["why"])
    mask = rep["mask"]
    rgba = np.zeros((*mask.shape, 4), dtype="uint8")
    rgba[mask] = [154, 51, 36, 170]  # --brick-700 at partial alpha
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").resize((256, 256), Image.NEAREST).save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


@app.post("/api/ask")
def ask(body: AskBody):
    s = _session(body.session_id)
    return _answer_safe(s["paths"], body.question, s["mode"], s["modalities"])

@app.get("/api/status")
def status():
    return dict(model_ready=_VLM.ready, model_loading=_VLM._loading, model_error=_VLM.error)


@app.delete("/api/session/{session_id}")
def close_session(session_id: str):
    s = SESSIONS.pop(session_id, None)
    if s:
        shutil.rmtree(s["dir"], ignore_errors=True)
    return dict(ok=True)


# ---------------------------------------------------------------- chat: small talk, place questions, image questions

def _land_stats(path) -> dict:
    o = load_bands(path, "optical")
    return {c: round(float(optical_mask(c, o).mean()) * 100, 1) for c in ("vegetation", "water", "built") if optical_mask(c, o) is not None}


def _short(text, n=320):
    if not text or len(text) <= n:
        return text
    cut = text[:n].rsplit(". ", 1)[0]
    return (cut + ".") if len(cut) > 80 else text[:n].rsplit(" ", 1)[0] + "…"


def _place_payload(place, wiki, chip=None, before=None, stats=None) -> dict:
    out = dict(name=place["name"], display=place["display"], lat=place["lat"], lon=place["lon"], country=place.get("country"), wiki=wiki, stats=stats)
    if chip:
        out.update(when=chip["when"], cloud_pct=chip["cloud_pct"], km=chip["km"], before_when=before["when"] if before else None,
                   source="Copernicus Sentinel-2 L2A via Microsoft Planetary Computer")
    return out


@app.on_event("startup")
def _warm_model():
    _VLM.warm()  # background thread: the server answers small talk / sensor-only questions while the model loads


def _answer_safe(paths, question, mode, mods):
    """Full pipeline with the VLM once it is loaded; until then (or if it fails) answer from sensor data only and say so."""
    if not _VLM.ready:
        _VLM.warm()
        why = f"failed to load: {_VLM.error}" if _VLM.error else "still loading"
        trace = answer(paths, question, mode, mods, vlm=None)
        trace["findings"].append(dict(level="WARN", code="vlm-unavailable", msg=f"language model {why}; answered from sensor data only"))
        return trace
    try:
        return answer(paths, question, mode, mods, vlm=_VLM)
    except Exception as e:  # torch.cuda.OutOfMemoryError, ...
        trace = answer(paths, question, mode, mods, vlm=None)
        trace["findings"].append(dict(level="WARN", code="vlm-unavailable", msg=f"language model error ({type(e).__name__}); answered from sensor data only"))
        return trace


def _fill_from_stats(trace, text, place, chip, stats):
    """When the sensors alone were inconclusive (or no model answered), still give a real, honest number from the scene's index masks."""
    if trace.get("answer") not in (None, "unable to determine") or not stats:
        return
    concept = detect_concept(text)
    where = f"the {chip['km']}x{chip['km']} km around {place['name']} ({chip['when']}, {chip['cloud_pct']}% cloud)"
    names = {"vegetation": "vegetation", "water": "water", "built": "built-up surface"}
    if concept and concept in stats:
        pct = stats[concept]
        size = "clearly present" if pct >= 5 else "present in small amounts" if pct >= 0.5 else "essentially absent"
        trace["answer"] = f"In {where}, about {pct}% matches {names[concept]} by spectral index, so it is {size}."
    else:
        parts = ", ".join(f"{stats[c]}% {names[c]}" for c in ("vegetation", "built", "water") if c in stats)
        trace["answer"] = f"In {where}: {parts} (shares of the scene by NDVI / NDBI / NDWI; the remainder is bare soil, cropland or mixed surface)."
    trace["confidence"] = 0.6
    trace["tools"].append("place.stats")


def _place_flow(text, place):
    wiki = _short(wiki_summary(place["name"]) or wiki_summary(place["query"]))
    if not is_imagery_question(text):
        where = ", ".join(x for x in (place["name"], place.get("state"), place.get("country")) if x)
        reply = f"**{where}** ({place['lat']:.3f}°, {place['lon']:.3f}°)." + (f" {wiki}" if wiki else "")
        reply += f"\n\nWant to see it from orbit? Ask e.g. *\"land cover around {place['name']}\"* or *\"how has {place['name']} changed since last year?\"*"
        return dict(kind="place", reply=reply, place=_place_payload(place, wiki))
    sid = uuid.uuid4().hex
    d = Path(tempfile.mkdtemp(prefix=f"satquery_{sid}_"))
    slug = re.sub(r"\W+", "_", place["name"]).strip("_")[:24] or "place"
    try:
        chip = fetch_chip(place["lat"], place["lon"], d / f"{slug}_now.tif")
        before = None
        if is_change_question(text):
            try:
                before = fetch_chip(place["lat"], place["lon"], d / f"{slug}_before.tif", around=chip["_dt"] - timedelta(days=365))
            except Exception:
                before = None  # honest fallback below: single-date answer plus a note
    except (requests.RequestException, LookupError, KeyError, OSError) as e:
        shutil.rmtree(d, ignore_errors=True)
        return dict(kind="place", place=_place_payload(place, wiki),
                    reply=f"I found **{place['name']}**, but couldn't get Sentinel-2 imagery for it right now ({type(e).__name__}: {str(e)[:120]}). Try again in a moment, or upload an image yourself.")
    paths, mode = ([before["path"], chip["path"]], "bitemporal") if before else ([chip["path"]], "single")
    session = _register(sid, d, paths, mode, None, kind="place")
    stats = _land_stats(chip["path"])
    trace = _answer_safe(paths, text, mode, None) if session["ok"] else None
    if trace is not None and mode == "single":
        _fill_from_stats(trace, text, place, chip, stats)
    if trace is not None and is_change_question(text) and not before:
        trace["findings"].append(dict(level="WARN", code="no-before-scene", msg="no clear scene found about a year earlier, so this answer covers the latest date only"))
    return dict(kind="place", place=_place_payload(place, wiki, chip, before, stats), session=session, trace=trace)


@app.post("/api/chat")
def chat(body: ChatBody):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "empty message")
    reply = smalltalk(text)
    if reply:
        return dict(kind="chat", reply=reply)

    s = SESSIONS.get(body.session_id) if body.session_id else None
    about_attached = bool(s) and s.get("kind") != "place" and re.search(r"\b(this|these|the|attached|uploaded) (image|images|picture|photo|scene|pair)\b", text.lower())
    place = None
    if not about_attached:
        try:
            place = geocode(text)
        except requests.RequestException:
            place = None  # geocoder unreachable: fall through to the other routes instead of failing the message
    if place:
        return _place_flow(text, place)

    if s and refers_to_session(text):
        return dict(kind="image", trace=_answer_safe(s["paths"], text, s["mode"], s["modalities"]))

    msgs = [dict(role="system", content=SYSTEM_PROMPT)]
    msgs += [dict(role=h["role"], content=str(h["text"])[:400]) for h in body.history[-6:] if h.get("role") in ("user", "assistant") and h.get("text")]
    msgs.append(dict(role="user", content=text))
    if not _VLM.ready:
        _VLM.warm()
        return dict(kind="chat", reply=GUIDE + "\n\n(My open-chat brain is still warming up, so for now I stick to what I know best.)")
    try:
        return dict(kind="chat", reply=_VLM.chat(msgs))
    except Exception:
        return dict(kind="chat", reply=GUIDE)
