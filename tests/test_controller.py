"""Run: python tests/test_controller.py -- synthetic GeoTIFFs, no real model. Backend-free paths tested fully;
backend-required paths tested with a scripted fake VLM.
"""
import sys
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from satquery.controller import answer, classify_task, detect_concept  # noqa: E402


class FakeVLM:
    def __init__(self, reply):
        self.reply, self.calls = reply, []

    def ask(self, images, prompt, max_new_tokens=64):
        self.calls.append((len(images), prompt))
        return self.reply


def make(d, name, bands, dtype, values, desc, gsd=10.0, x0=500000, y0=2000000, tags=None, noise=None):
    p = Path(d) / name
    with rasterio.open(p, "w", driver="GTiff", width=40, height=40, count=bands, dtype=dtype, crs="EPSG:32643", transform=from_origin(x0, y0, gsd, gsd)) as dst:
        for i, v in enumerate(values, 1):
            arr = np.full((40, 40), v, dtype="float64")
            if noise is not None:
                arr[20:, 20:] = noise[i - 1]  # a real spatial region actually changes, not the whole uniform scene
            dst.write((arr + np.random.default_rng(i).normal(0, max(abs(v) * 0.02, 1), (40, 40))).astype(dtype), i)
            dst.set_band_description(i, desc[i - 1])
        if tags:
            dst.update_tags(**tags)
    return str(p)


def demo():
    with tempfile.TemporaryDirectory() as d:
        # forest-like optical scene (low NDWI, high NDVI)
        opt = make(d, "o.tif", 5, "uint16", [600, 800, 3500, 400, 2000], ["B04", "B03", "B08", "B02", "B11"], tags={"MODALITY": "optical", "ACQUISITION_DATE": "2023-01-10"})
        opt_water = make(d, "o2.tif", 5, "uint16", [200, 800, 200, 400, 800], ["B04", "B03", "B08", "B02", "B11"], tags={"MODALITY": "optical", "ACQUISITION_DATE": "2024-06-01"})
        sar = make(d, "s.tif", 2, "float32", [-9.0, -14.0], ["VV", "VH"])
        # bi-temporal pair: a lake appears in one corner (spatial region, not a uniform whole-scene shift)
        before = make(d, "b.tif", 5, "uint16", [600, 800, 3500, 400, 2000], ["B04", "B03", "B08", "B02", "B11"], tags={"MODALITY": "optical", "ACQUISITION_DATE": "2023-01-10"})
        after = make(d, "a.tif", 5, "uint16", [600, 800, 3500, 400, 2000], ["B04", "B03", "B08", "B02", "B11"], tags={"MODALITY": "optical", "ACQUISITION_DATE": "2024-06-01"}, noise=[200, 800, 200, 400, 800])

        assert classify_task("Is there water in this scene?", "single") == "vqa"
        assert classify_task("Point out the largest lake", "single") == "grounding"
        assert classify_task("Describe this image", "single") == "caption"
        assert detect_concept("Are there any buildings here?") == "built"

        # 1. single-image presence question, NO backend -> physics answers it alone
        r = answer([opt], "Is water present in this image?", "single")
        assert r["task"] == "vqa" and r["answer"] == "no" and r["confidence"] > 0.8, r
        assert "physics.verify" in r["tools"]

        r = answer([opt_water], "Is water present in this image?", "single")
        assert r["answer"] == "yes" and r["confidence"] > 0.8, r

        # 2. model contradicts sensor evidence -> flagged, not silently trusted
        r = answer([opt], "Is water present in this image?", "single", vlm=FakeVLM("yes"))
        assert "Uncertain" in r["answer"] and r["confidence"] < 0.3, r

        # 3. captioning needs a backend
        r = answer([opt], "Describe this image", "single")
        assert r["answer"] is None and any(f["code"] == "no-backend" for f in r["findings"])
        r = answer([opt], "Describe this image", "single", vlm=FakeVLM("A forested area."))
        assert r["answer"] == "A forested area." and r["confidence"] > 0

        # 4. grounding: box parsed from model output
        r = answer([opt], "Point out the forest", "single", vlm=FakeVLM("[0.1 0.1, 0.9 0.9]"))
        assert r["evidence"]["box"] == (0.1, 0.1, 0.9, 0.9) and r["confidence"] > 0.5

        # 5. bi-temporal change, no backend -> templated description from index math alone
        r = answer([before, after], "What changed between these dates?", "bitemporal")
        assert r["task"] == "change" and "changed" in r["answer"].lower() and r["confidence"] > 0.5, r
        assert r["evidence"]["change"]["regions"] and r["evidence"]["change"]["trends"]["water"]["trend"] == "increased", r

        # 6. cross-modal fusion, physics-only fallback
        r = answer([opt, sar], "Is there water here?", "cross_modal")
        assert r["task"] == "fusion" and r["answer"] is not None

        # 7. preflight rejection propagates cleanly (wrong count for the mode)
        r = answer([opt], "changed?", "bitemporal")
        assert r["task"] == "preflight" and r["confidence"] == 0.0
    print("controller: ok")


if __name__ == "__main__":
    demo()
