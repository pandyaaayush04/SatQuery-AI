"""Run: python tests/test_preflight.py  (also pytest-compatible). Synthetic GeoTIFFs, no data download."""
import sys
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from satquery.preflight import preflight  # noqa: E402


def make(d, name, *, bands=3, dtype="uint16", gsd=10.0, x0=500000, y0=2000000, crs="EPSG:32643", tags=None, desc=None, size=64):
    p = Path(d) / name
    prof = dict(driver="GTiff", width=size, height=size, count=bands, dtype=dtype, crs=crs, transform=from_origin(x0, y0, gsd, gsd))
    with rasterio.open(p, "w", **prof) as dst:
        dst.write(np.ones((bands, size, size), dtype=dtype))
        if tags:
            dst.update_tags(**tags)
        if desc:
            for i, s in enumerate(desc, 1):
                dst.set_band_description(i, s)
    return str(p)


def codes(rep, level):
    return {f.code for f in rep.findings if f.level == level}


def demo():
    with tempfile.TemporaryDirectory() as d:
        opt = make(d, "opt.tif", tags={"MODALITY": "optical", "ACQUISITION_DATE": "2023-01-10"})
        opt2 = make(d, "opt2.tif", tags={"MODALITY": "optical", "ACQUISITION_DATE": "2024-03-01"})
        sar = make(d, "sar.tif", bands=2, dtype="float32", desc=["VV", "VH"])
        far = make(d, "far.tif", x0=900000, tags={"MODALITY": "optical"})
        hi = make(d, "hires.tif", gsd=0.65, size=64, tags={"MODALITY": "optical", "ACQUISITION_DATE": "2023-01-10"})
        raw = Path(d) / "nogeo.tif"
        with rasterio.open(raw, "w", driver="GTiff", width=8, height=8, count=1, dtype="uint8") as dst:
            dst.write(np.ones((1, 8, 8), dtype="uint8"))

        assert preflight([opt], "single").ok
        assert "gsd-scale" in codes(preflight([hi], "single"), "WARN")  # Cartosat-like scale gap flagged
        assert "no-georef" in codes(preflight([str(raw)], "single"), "BLOCK")
        assert "format" in codes(preflight(["x.png"], "single"), "BLOCK")
        assert "image-count" in codes(preflight([opt], "bitemporal"), "BLOCK")

        assert preflight([opt, sar], "cross_modal").ok
        assert "not-cross-modal" in codes(preflight([opt, opt2], "cross_modal"), "BLOCK")
        assert "no-overlap" in codes(preflight([opt, far], "cross_modal"), "BLOCK")

        r = preflight([opt, opt2], "bitemporal")
        assert r.ok and "time-order" in {f.code for f in r.findings}
        assert "same-time" in codes(preflight([opt, opt], "bitemporal"), "BLOCK")
        assert "no-timestamp" in codes(preflight([opt, sar], "bitemporal"), "BLOCK") or "modality-mismatch" in codes(preflight([opt, sar], "bitemporal"), "BLOCK")
    print("preflight: all checks pass")


if __name__ == "__main__":
    demo()
