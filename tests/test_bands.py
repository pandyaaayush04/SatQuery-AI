"""Run: python tests/test_bands.py"""
import sys
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from satquery.bands import load_bands, render_display  # noqa: E402


def make(d, bands, dtype, values, desc):
    p = Path(d) / "t.tif"
    with rasterio.open(p, "w", driver="GTiff", width=32, height=32, count=bands, dtype=dtype, crs="EPSG:32633", transform=from_origin(0, 0, 10, 10)) as dst:
        for i, v in enumerate(values, 1):
            dst.write(np.full((32, 32), v, dtype=dtype), i)
            dst.set_band_description(i, desc[i - 1])
    return str(p)


def demo():
    with tempfile.TemporaryDirectory() as d:
        opt = make(d, 5, "uint16", [1500, 800, 400, 3000, 2000], ["B04", "B03", "B02", "B08", "B11"])
        b = load_bands(opt, "optical")
        assert abs(b["red"][0, 0] - 0.15) < 1e-6 and abs(b["nir"][0, 0] - 0.30) < 1e-6  # normalized to reflectance
        img = render_display(opt, "optical")
        assert img.size == (256, 256)

        sar = make(d, 2, "float32", [-12.0, -18.0], ["VV", "VH"])
        b = load_bands(sar, "sar")
        assert abs(b["vv"][0, 0] - (-12.0)) < 1e-6  # already dB, passed through unchanged
        assert render_display(sar, "sar").size == (256, 256)

        nolab = make(d, 2, "float32", [-9.0, -14.0], ["", ""])  # no descriptions -> positional fallback
        b = load_bands(nolab, "sar")
        assert b["vv"][0, 0] == -9.0 and b["vh"][0, 0] == -14.0
    print("bands: ok")


if __name__ == "__main__":
    demo()
