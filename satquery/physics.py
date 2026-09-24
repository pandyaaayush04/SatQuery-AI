"""Physics fact-checker: test a model's presence claim ("there is water") against band-index masks.

Training-free and sensor-aware. If the bands a test needs are missing, it says "unavailable" instead of guessing.
Thresholds are textbook defaults; calibrate on the bench split (scripts/calibrate_physics later).
Inputs are float arrays: optical = reflectance 0..1 dict with keys green/red/nir/swir; sar = dict vv/vh in dB.
"""
import numpy as np
from skimage.filters import threshold_otsu

PRESENT, ABSENT = 0.02, 0.005  # coverage fractions; the band in between is "ambiguous"


def ndi(a, b):
    return (a - b) / (a + b + 1e-6)


def optical_mask(concept, o):
    need = {"water": ("green", "nir"), "vegetation": ("nir", "red"), "built": ("swir", "nir")}[concept]
    if any(k not in o for k in need):
        return None
    if concept == "water":
        return ndi(o["green"], o["nir"]) > 0.0  # NDWI, McFeeters
    if concept == "vegetation":
        return ndi(o["nir"], o["red"]) > 0.4  # NDVI
    built = ndi(o["swir"], o["nir"]) > 0.0  # NDBI
    return built & (ndi(o["nir"], o["red"]) < 0.2 if "red" in o else True)


def sar_mask(concept, s):
    if "vv" not in s or concept == "vegetation":
        return None  # SAR vegetation needs time series, out of scope
    vv = s["vv"]
    if concept == "water":  # smooth water is dark; Otsu clipped to a physical range
        thr = float(np.clip(threshold_otsu(vv[np.isfinite(vv)]), -22, -15)) if np.ptp(vv) > 1 else -18.0
        return vv < thr
    return vv > -6.0  # built-up: bright double-bounce; weakest of the tests


def vote(mask):
    f = float(mask.mean())
    return f, ("present" if f >= PRESENT else "absent" if f < ABSENT else "ambiguous")


def verify(concept, claim_present, optical=None, sar=None):
    """Compare the model's claim with each available sensor. verdict: supports | contradicts | inconclusive | unavailable."""
    tests = {}
    for name, m in (("optical", optical_mask(concept, optical) if optical else None), ("sar", sar_mask(concept, sar) if sar else None)):
        if m is not None:
            f, v = vote(m)
            tests[name] = dict(coverage=round(f, 4), says=v)
    if not tests:
        return dict(verdict="unavailable", tests=tests, why="required bands not present in this input")
    claim = "present" if claim_present else "absent"
    says = {t["says"] for t in tests.values()} - {"ambiguous"}
    if not says:
        verdict = "inconclusive"
    elif len(says) > 1:
        verdict = "inconclusive"  # sensors disagree with each other
    else:
        verdict = "supports" if says == {claim} else "contradicts"
    return dict(verdict=verdict, tests=tests)
