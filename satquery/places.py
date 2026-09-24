"""Place lookup + live Sentinel-2 chips, so a user can name an area instead of uploading an image.

geocode(): OpenStreetMap Nominatim (no key; polite 1 req/s, cached). wiki_summary(): Wikipedia REST.
fetch_chip(): a km x km Sentinel-2 L2A GeoTIFF around a point from Microsoft Planetary Computer (free, no login),
written with band descriptions + acquisition time so satquery.preflight / bands / physics / change take it unchanged.
Everything here needs network and raises on failure -- callers turn that into an honest "couldn't reach X" reply.
"""
import os
import re
import time
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import numpy as np
import rasterio
import requests
from rasterio.transform import from_bounds
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds as win_from_bounds

UA = {"User-Agent": "SatQueryAI/0.1 (SIH 2026 demo)"}
PC = "https://planetarycomputer.microsoft.com/api"
BANDS = ("B02", "B03", "B04", "B08", "B11")
NOT_PLACES = {"this", "that", "these", "those", "the image", "image", "images", "picture", "photo", "scene", "area", "region", "it", "me", "you", "us", "general", "detail", "details"}
STOP = {"and", "how", "what", "is", "are", "has", "have", "had", "since", "between", "during", "over", "with", "does", "do", "did", "was", "were", "changed", "change", "look", "looks", "like", "from", "now", "today", "recently", "lately", "please", "compared", "the", "a", "an"}
_last_geocode = [0.0]


def extract_candidates(text: str) -> list[str]:
    """Phrases that might name a place, best guess first. Purely lexical: geocode() decides if any is real."""
    t = text.strip().rstrip("?.! ")
    found = []
    for m in re.finditer(r"\b(?:of|in|at|near|around|over|for|about|from|to)\s+((?:[A-Za-z][\w'’.\-]*)(?:[ ,]+[A-Za-z][\w'’.\-]*){0,4})", t):
        words = re.split(r"\s+", m.group(1).replace(",", " ,").replace(" ,", ",").strip())
        keep = []
        for w in words:
            if w.lower().strip(",") in STOP and keep:
                break
            keep.append(w)
        phrase = " ".join(keep).strip(" ,")
        while phrase:  # trim trailing stopwords the loop above let through at position 0
            first = phrase.split()[0].lower()
            if first in STOP or first in NOT_PLACES:
                phrase = " ".join(phrase.split()[1:])
            else:
                break
        if phrase and phrase.lower() not in NOT_PLACES:
            found.append(phrase)
    caps = re.findall(r"\b[A-Z][\w'’\-]+(?:\s+[A-Z][\w'’\-]+)*", t)  # capitalised runs: "New Delhi", "Lake Victoria"
    lead = {"i", "hi", "hello", "hey", "what", "how", "is", "are", "has", "have", "had", "show", "tell", "can", "do", "does", "did", "where", "which", "when", "why", "who", "please", "give", "find", "look", "describe", "explain"}
    for c in caps:
        words = c.split()
        while words and words[0].lower() in lead:  # "Has Dubai" -> "Dubai" (sentence-initial word is capitalised, not part of the name)
            words = words[1:]
        c = " ".join(words)
        if c and c.lower() not in NOT_PLACES:
            found.append(c)
    if 0 < len(t.split()) <= 3 and t.lower() not in NOT_PLACES:
        found.append(t)  # a bare place name typed on its own
    seen, out = set(), []
    for f in found:
        if f.lower() not in seen:
            seen.add(f.lower())
            out.append(f)
    return out[:4]


@lru_cache(maxsize=256)
def _nominatim(q: str):
    wait = 1.1 - (time.time() - _last_geocode[0])
    if wait > 0:
        time.sleep(wait)
    _last_geocode[0] = time.time()
    r = requests.get("https://nominatim.openstreetmap.org/search", params=dict(q=q, format="jsonv2", limit=1, addressdetails=1), headers=UA, timeout=15)
    r.raise_for_status()
    hits = r.json()
    return hits[0] if hits else None


def geocode(text: str):
    """First candidate phrase that resolves to a reasonably notable place, else None."""
    for cand in extract_candidates(text):
        hit = _nominatim(cand)
        if not hit:
            continue
        importance = float(hit.get("importance", 0))
        capitalised = cand[:1].isupper()
        if importance >= (0.25 if capitalised else 0.5):
            a = hit.get("address", {})
            return dict(
                query=cand, name=hit.get("name") or cand, display=hit.get("display_name", cand),
                lat=float(hit["lat"]), lon=float(hit["lon"]), kind=hit.get("type", ""),
                country=a.get("country"), state=a.get("state"),
            )
    return None


@lru_cache(maxsize=128)
def wiki_summary(title: str):
    try:
        r = requests.get("https://en.wikipedia.org/api/rest_v1/page/summary/" + requests.utils.quote(title.replace(" ", "_")), headers=UA, timeout=10)
        if r.status_code != 200:
            return None
        j = r.json()
        return (j.get("extract") or "").strip() or None if j.get("type") == "standard" else None
    except requests.RequestException:
        return None


def _bbox(lat, lon, km):
    dlat = km / 2 / 110.574
    dlon = km / 2 / (111.32 * np.cos(np.radians(lat)))
    return [lon - dlon, lat - dlat, lon + dlon, lat + dlat]


def _search(bbox, start, end, max_cloud, limit=8):
    body = {"collections": ["sentinel-2-l2a"], "bbox": bbox, "datetime": f"{start:%Y-%m-%d}/{end:%Y-%m-%d}", "limit": limit,
            "query": {"eo:cloud_cover": {"lt": max_cloud}}, "sortby": [{"field": "datetime", "direction": "desc"}]}
    r = requests.post(PC + "/stac/v1/search", json=body, timeout=60)
    r.raise_for_status()
    return r.json()["features"]


def _read(item, asset, token, bbox, n):
    with rasterio.open(item["assets"][asset]["href"] + "?" + token) as ds:
        b = transform_bounds("EPSG:4326", ds.crs, *bbox)
        w = win_from_bounds(*b, transform=ds.transform)
        arr = ds.read(1, window=w, out_shape=(n, n), resampling=rasterio.enums.Resampling.bilinear)
        return arr, ds.crs, b


def _chip(item, bbox, token, n, out_path):
    """Read one scene's 5 bands (+cloud fraction from SCL) and write the GeoTIFF. Returns (cloud_frac, valid_frac)."""
    scl, _, _ = _read(item, "SCL", token, bbox, n)
    cloud = float(np.isin(scl, (3, 8, 9, 10)).mean())  # shadow, cloud medium/high, cirrus
    layers, crs, b = [], None, None
    for name in BANDS:
        a, crs, b = _read(item, name, token, bbox, n)
        layers.append(np.clip(a.astype("int32") - 1000, 0, None).astype("uint16"))  # L2A 04.00 adds +1000 DN offset; bands.py assumes none
    valid = float((layers[2] > 0).mean())
    dt = datetime.fromisoformat(item["properties"]["datetime"].replace("Z", "+00:00"))
    with rasterio.open(out_path, "w", driver="GTiff", count=len(BANDS), dtype="uint16", width=n, height=n, crs=crs, transform=from_bounds(*b, n, n)) as dst:
        for i, (name, a) in enumerate(zip(BANDS, layers), 1):
            dst.write(a, i)
            dst.set_band_description(i, name)
        dst.update_tags(MODALITY="optical", TIFFTAG_DATETIME=dt.strftime("%Y-%m-%dT%H:%M:%S"), SOURCE="Copernicus Sentinel-2 L2A via Microsoft Planetary Computer")
    return cloud, valid, dt


def fetch_chip(lat, lon, out_path, around=None, km=6, max_cloud=25):
    """Best recent cloud-free Sentinel-2 chip near (lat, lon). `around` (datetime) centres the search +-45 days on a past date
    (for the 'before' half of a change question); default is the last ~5 months. Returns dict(path, when, cloud_pct, km)."""
    n = int(km * 1000 / 10)
    bbox = _bbox(lat, lon, km)
    now = datetime.now(timezone.utc)
    windows = [(around - timedelta(days=45), around + timedelta(days=45))] if around else [(now - timedelta(days=150), now), (now - timedelta(days=400), now)]
    token = requests.get(f"{PC}/sas/v1/token/sentinel-2-l2a", timeout=30).json()["token"]
    best, tmp = None, f"{out_path}.part"
    for start, end in windows:
        for item in _search(bbox, start, end, max_cloud):
            try:
                cloud, valid, dt = _chip(item, bbox, token, n, tmp)
            except Exception:
                continue
            if valid < 0.9:
                continue
            if best is None or cloud < best[0]:
                best = (cloud, dt)
                os.replace(tmp, out_path)  # keep the clearest scene seen so far
                if cloud < 0.05:
                    break
        if best:
            break
    if best is None:
        raise LookupError("no usable Sentinel-2 scene found for that spot")
    cloud, dt = best
    return dict(path=str(out_path), when=dt.strftime("%Y-%m-%d"), cloud_pct=round(cloud * 100, 1), km=km, _dt=dt)
