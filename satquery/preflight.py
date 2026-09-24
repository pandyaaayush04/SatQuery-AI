"""Preflight: read real GeoTIFF metadata, decide if an input set fits the requested task.

Returns findings, never guesses. BLOCK = refuse, WARN = proceed with a stated fix, INFO = fact.
Runs before any model touches the pixels.
"""
from dataclasses import dataclass, field
from datetime import datetime
from math import cos, radians
from pathlib import Path

import rasterio
from rasterio.warp import transform_bounds

TRAIN_GSD_M = 10.0  # BigEarthNet.txt is Sentinel-1/2 class; confirm against paper's patch spec
MODES = ("single", "cross_modal", "bitemporal")
TIME_TAGS = ("TIFFTAG_DATETIME", "ACQUISITION_DATE", "SENSING_TIME", "DATETIME")
TIME_FMTS = ("%Y:%m:%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y%m%d")
SAR_WORDS = ("sar", "vv", "vh", "hh", "hv", "backscatter", "sigma0")


@dataclass
class Finding:
    level: str  # INFO | WARN | BLOCK
    code: str
    msg: str


@dataclass
class Meta:
    path: str
    georef: bool = False
    crs: str | None = None
    gsd_m: float | None = None
    bounds_wgs84: tuple | None = None
    bands: int = 0
    dtype: str = ""
    size: tuple = (0, 0)
    modality: str = "unknown"
    modality_source: str = "none"
    when: datetime | None = None


@dataclass
class Report:
    mode: str
    metas: list = field(default_factory=list)
    findings: list = field(default_factory=list)

    @property
    def ok(self):
        return not any(f.level == "BLOCK" for f in self.findings)

    def add(self, level, code, msg):
        self.findings.append(Finding(level, code, msg))


def _gsd_m(src):
    a, e = abs(src.transform.a), abs(src.transform.e)
    if src.crs and src.crs.is_geographic:
        lat = (src.bounds.top + src.bounds.bottom) / 2
        return round((a * 111320 * cos(radians(lat)) + e * 110540) / 2, 3)
    return round((a + e) / 2, 3)


def _when(tags):
    for k in TIME_TAGS:
        for fmt in TIME_FMTS:
            try:
                return datetime.strptime(tags[k].strip(), fmt)
            except (KeyError, ValueError):
                continue
    return None


def _modality(src, declared):
    if declared:
        return declared, "declared"
    tag = src.tags().get("MODALITY", "").lower()
    if tag in ("optical", "sar"):
        return tag, "tag"
    desc = " ".join(d or "" for d in src.descriptions).lower()
    if any(w in desc for w in SAR_WORDS):
        return "sar", "band-description"
    if src.count <= 2 and src.dtypes[0].startswith("float"):
        return "sar", "heuristic"  # weak guess, callers should declare modality
    return "optical", "heuristic"


def read_meta(path, declared_modality=None):
    m = Meta(path=str(path))
    with rasterio.open(path) as src:
        m.bands, m.dtype, m.size = src.count, src.dtypes[0], (src.width, src.height)
        m.georef = src.crs is not None and not src.transform.is_identity
        m.modality, m.modality_source = _modality(src, declared_modality)
        m.when = _when(src.tags())
        if m.georef:
            m.crs = src.crs.to_string()
            m.gsd_m = _gsd_m(src)
            m.bounds_wgs84 = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
    return m


def _overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return 0.0
    area = lambda r: (r[2] - r[0]) * (r[3] - r[1])
    return w * h / min(area(a), area(b))


def preflight(paths, mode="single", modalities=None):
    rep = Report(mode=mode)
    need = {"single": 1, "cross_modal": 2, "bitemporal": 2}
    if mode not in MODES:
        rep.add("BLOCK", "bad-mode", f"mode must be one of {MODES}")
        return rep
    if len(paths) != need[mode]:
        rep.add("BLOCK", "image-count", f"{mode} needs {need[mode]} image(s), got {len(paths)}")
        return rep
    modalities = modalities or [None] * len(paths)
    for p, mod in zip(paths, modalities):
        p = Path(p)
        if p.suffix.lower() not in (".tif", ".tiff"):
            rep.add("BLOCK", "format", f"{p.name}: only GeoTIFF/TIFF accepted (benchmark PNG/JPEG go through the benchmark loader)")
            return rep
        try:
            rep.metas.append(read_meta(p, mod))
        except Exception as e:  # rasterio raises many types on corrupt files
            rep.add("BLOCK", "unreadable", f"{p.name}: {e}")
            return rep
    for m in rep.metas:
        name = Path(m.path).name
        if not m.georef:
            rep.add("BLOCK", "no-georef", f"{name}: missing CRS/transform, cannot place or compare it")
            continue
        rep.add("INFO", "meta", f"{name}: {m.modality}({m.modality_source}) {m.bands}b {m.dtype} {m.size[0]}x{m.size[1]} GSD {m.gsd_m} m")
        if m.modality_source == "heuristic":
            rep.add("WARN", "modality-guess", f"{name}: modality guessed as {m.modality}; declare it to be sure")
        ratio = m.gsd_m / TRAIN_GSD_M
        if abs(ratio - 1) > 0.5:
            rep.add("WARN", "gsd-scale", f"{name}: GSD {m.gsd_m} m vs model scale {TRAIN_GSD_M} m; will resample x{ratio:.2f}, fine-detail queries not answerable")
    if not rep.ok or len(rep.metas) < 2:
        return rep
    a, b = rep.metas
    if a.crs != b.crs:
        rep.add("WARN", "crs-differs", f"{a.crs} vs {b.crs}: will reproject to a common grid")
    ov = _overlap(a.bounds_wgs84, b.bounds_wgs84)
    if ov < 0.3:
        rep.add("BLOCK", "no-overlap", f"footprints overlap {ov:.0%} of the smaller image; not the same area")
    elif ov < 0.9:
        rep.add("WARN", "partial-overlap", f"footprints overlap {ov:.0%}; analysis limited to the intersection")
    g = max(a.gsd_m, b.gsd_m) / min(a.gsd_m, b.gsd_m)
    if g > 1.5:
        rep.add("WARN", "gsd-mismatch", f"GSD ratio {g:.1f}x; finer image will be resampled to the coarser grid")
    if mode == "cross_modal":
        if {a.modality, b.modality} != {"optical", "sar"}:
            rep.add("BLOCK", "not-cross-modal", f"need one optical + one SAR, got {a.modality} + {b.modality}")
    else:
        if a.modality != b.modality:
            rep.add("BLOCK", "modality-mismatch", f"bi-temporal pair must share a sensor type, got {a.modality} + {b.modality}")
        if not (a.when and b.when):
            rep.add("BLOCK", "no-timestamp", "acquisition time missing on one image; cannot order a bi-temporal pair (declare dates)")
        elif a.when == b.when:
            rep.add("BLOCK", "same-time", "both images have the same timestamp; nothing to compare")
        else:
            first, second = sorted([a, b], key=lambda m: m.when)
            rep.add("INFO", "time-order", f"before={Path(first.path).name} after={Path(second.path).name} gap={(second.when - first.when).days} d")
    return rep
