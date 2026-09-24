"""Bi-temporal change analysis without training data. Returns numbers + a mask; a language model only verbalises them.

Inputs: before/after = dict(optical=<bands dict or None>, sar=<dict vv/vh dB or None>), co-registered, same shape.
"""
import numpy as np
from scipy import ndimage as ndi
from skimage.filters import threshold_otsu
from skimage.morphology import disk, opening

from .physics import optical_mask, sar_mask

MIN_REGION_FRAC = 0.002  # ignore change blobs smaller than 0.2% of the scene
TREND_EPS = 0.005  # coverage moving < 0.5 percentage points counts as unchanged
CONCEPTS = ("water", "vegetation", "built")
COMPASS = [["north-west", "north", "north-east"], ["west", "centre", "east"], ["south-west", "south", "south-east"]]


def _robust(x):
    return (x - np.median(x)) / (1.4826 * np.median(np.abs(x - np.median(x))) + 1e-3)


def _magnitude(b, a):
    """Per-pixel change strength in noise units from whichever sensor is present in both epochs."""
    mags = []
    if b.get("optical") and a.get("optical"):
        keys = [k for k in ("red", "green", "nir", "swir") if k in b["optical"] and k in a["optical"]]
        if keys:
            mags.append(np.sqrt(sum((_robust(a["optical"][k]) - _robust(b["optical"][k])) ** 2 for k in keys) / len(keys)))
    if b.get("sar") and a.get("sar") and "vv" in b["sar"] and "vv" in a["sar"]:
        d = np.abs(a["sar"]["vv"] - b["sar"]["vv"])  # log-ratio in dB
        mags.append(_robust(d))
    return np.maximum.reduce(mags) if mags else None


def change_mask(b, a):
    mag = _magnitude(b, a)
    if mag is None:
        return None
    med = np.median(mag)
    mad = 1.4826 * np.median(np.abs(mag - med))
    floor = med + 6 * mad + 1e-6  # pure noise never passes this floor, so "no change" stays no change
    thr = max(threshold_otsu(mag), floor) if np.ptp(mag) > 1e-6 else np.inf
    return opening(mag > thr, disk(1))


def _compass(cy, cx, h, w):
    return COMPASS[min(int(3 * cy / h), 2)][min(int(3 * cx / w), 2)]


def _coverage(concept, s):
    for m in (optical_mask(concept, s["optical"]) if s.get("optical") else None, sar_mask(concept, s["sar"]) if s.get("sar") else None):
        if m is not None:
            return float(m.mean())
    return None


def change_report(before, after):
    mask = change_mask(before, after)
    if mask is None:
        return dict(available=False, why="no sensor present in both epochs")
    h, w = mask.shape
    lab, n = ndi.label(mask)
    regions = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        area = float((lab[sl] == i).sum()) / mask.size
        if area >= MIN_REGION_FRAC:
            cy, cx = ndi.center_of_mass(lab == i)
            regions.append(dict(area_pct=round(100 * area, 2), where=_compass(cy, cx, h, w), bbox=[sl[1].start / w, sl[0].start / h, sl[1].stop / w, sl[0].stop / h]))
    regions.sort(key=lambda r: -r["area_pct"])
    trends = {}
    for c in CONCEPTS:
        cb, ca = _coverage(c, before), _coverage(c, after)
        if cb is not None and ca is not None:
            trends[c] = dict(before_pct=round(100 * cb, 2), after_pct=round(100 * ca, 2), trend="increased" if ca - cb > TREND_EPS else "decreased" if cb - ca > TREND_EPS else "unchanged")
    return dict(available=True, changed_pct=round(100 * float(mask.mean()), 2), regions=regions[:5], trends=trends, mask=mask)
