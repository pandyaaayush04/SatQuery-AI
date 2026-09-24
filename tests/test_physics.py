"""Run: python tests/test_physics.py  -- synthetic scenes with known water/forest."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from satquery.physics import verify  # noqa: E402


def scene(water_frac):
    n = 100
    o = dict(green=np.full((n, n), 0.08), red=np.full((n, n), 0.06), nir=np.full((n, n), 0.35), swir=np.full((n, n), 0.2))  # forest-like
    vv = np.full((n, n), -9.0)
    k = int(n * water_frac)  # water strip: green>nir, dark radar
    o["green"][:, :k], o["nir"][:, :k], vv[:, :k] = 0.07, 0.02, -24.0
    return o, dict(vv=vv, vh=vv - 7)


def demo():
    o, s = scene(0.30)
    assert verify("water", True, o, s)["verdict"] == "supports"
    assert verify("water", False, o, s)["verdict"] == "contradicts"  # model says no water, both sensors see 30%
    o, s = scene(0.0)
    assert verify("water", True, o, s)["verdict"] == "contradicts"
    assert verify("water", False, o, s)["verdict"] == "supports"
    assert verify("vegetation", True, o)["verdict"] == "supports"
    assert verify("water", True, None, None)["verdict"] == "unavailable"  # single PAN band: abstain, don't guess
    o, s = scene(0.30)
    s["vv"][:] = -9.0  # radar sees no water while optical does
    assert verify("water", True, o, s)["verdict"] == "inconclusive"  # sensors disagree
    print("physics: ok")


if __name__ == "__main__":
    demo()
