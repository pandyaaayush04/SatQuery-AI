"""GeoTIFF -> named band arrays for physics.py / change.py.

Band names come from the file's band descriptions (e.g. "B04", "VV") or from an explicit list. Unknown names are ignored,
so a 1-band panchromatic file simply yields no indices and the physics checker abstains.
"""
import numpy as np
import rasterio
from rasterio.enums import Resampling

S2_NAMES = {"B02": "blue", "B03": "green", "B04": "red", "B08": "nir", "B8A": "nir", "B11": "swir"}
SAR_NAMES = {"VV": "vv", "VH": "vh"}
DISPLAY_FALLBACK = {"optical": ("red", "green", "blue"), "sar": ("vv", "vh")}  # positional guess if band names are missing


def _db(x):
    return x if np.nanmedian(x) < 0 else 10 * np.log10(np.clip(x, 1e-6, None))  # same dB rule as ben_data


def _read_named(path, table, shape=None):
    """Raw (un-normalized) named bands: DN counts for optical, native units for SAR."""
    out = {}
    with rasterio.open(path) as src:
        names = [d or "" for d in src.descriptions]
        if not any(names):
            modality = "optical" if table is S2_NAMES else "sar"
            names = [n.upper() for n in DISPLAY_FALLBACK[modality][:src.count]]
        for i, n in enumerate(names, 1):
            key = table.get(n.upper())
            if key is None or key in out:
                continue
            out[key] = src.read(i, out_shape=shape or (src.height, src.width), resampling=Resampling.bilinear).astype("float32")
        out["_dtype"] = src.dtypes[0]
    return out


def load_bands(path, modality, shape=None):
    """Return dict of float32 arrays. optical: reflectance 0..1 keyed red/green/blue/nir/swir. sar: dB keyed vv/vh.

    Bands are matched by the file's band descriptions (e.g. "B04", "VV"). A file with no descriptions at all falls
    back to position (band 1/2/3 = R/G/B, or VV/VH) -- common for hand-exported composites; a labelled file always wins.
    """
    raw = _read_named(path, S2_NAMES if modality == "optical" else SAR_NAMES, shape)
    dtype = raw.pop("_dtype")
    if modality == "optical":
        return {k: (v / 10000 if dtype.startswith("uint") else v) for k, v in raw.items()}
    return {k: _db(v) for k, v in raw.items()}


def render_display(path, modality):
    """Bands -> a PIL image for showing to a VLM or a human. Same stretch as training (satquery.ben_data)."""
    from .ben_data import render_optical, render_sar  # local import: avoid a hard torch/PIL dep for callers that only need indices

    if modality == "optical":
        b = _read_named(path, S2_NAMES)
        if not {"red", "green", "blue"} <= b.keys():
            raise ValueError(f"{path}: need red/green/blue bands to render, got {sorted(k for k in b if k != '_dtype')}")
        return render_optical(b["red"], b["green"], b["blue"])
    b = _read_named(path, SAR_NAMES)
    if "vv" not in b or "vh" not in b:
        raise ValueError(f"{path}: need vv/vh bands to render, got {sorted(k for k in b if k != '_dtype')}")
    return render_sar(b["vv"], b["vh"])
