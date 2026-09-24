"""Run: python tests/test_change.py  -- synthetic before/after with a known change."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from satquery.change import change_report  # noqa: E402

N = 120
rng = np.random.default_rng(1)


def epoch(water_box=None):
    o = {k: np.full((N, N), v) + rng.normal(0, 0.005, (N, N)) for k, v in dict(green=0.08, red=0.06, nir=0.35, swir=0.2).items()}
    vv = np.full((N, N), -9.0) + rng.normal(0, 0.5, (N, N))
    if water_box:
        y0, y1, x0, x1 = water_box
        o["green"][y0:y1, x0:x1], o["nir"][y0:y1, x0:x1], vv[y0:y1, x0:x1] = 0.07, 0.02, -24.0
    return dict(optical=o, sar=dict(vv=vv, vh=vv - 7))


def demo():
    r = change_report(epoch(), epoch(water_box=(5, 45, 75, 115)))  # a lake appears in the north-east
    assert r["available"] and r["regions"], r
    top = r["regions"][0]
    assert top["where"] == "north-east" and 8 < top["area_pct"] < 14, top  # 40x40 of 120x120 = 11%
    assert r["trends"]["water"]["trend"] == "increased" and r["trends"]["water"]["after_pct"] > 8
    assert r["trends"]["vegetation"]["trend"] == "decreased"

    same = change_report(epoch(), epoch())  # noise only: must report NO change
    assert same["changed_pct"] == 0 and not same["regions"], same["changed_pct"]
    assert all(t["trend"] == "unchanged" for t in same["trends"].values())

    assert change_report(dict(optical=None, sar=None), epoch())["available"] is False  # nothing to compare: refuse
    print("change: ok")


if __name__ == "__main__":
    demo()
