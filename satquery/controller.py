"""Agentic controller: validate inputs, pick a task and tools, run them, return an auditable trace.

No model needed for: presence/absence questions about water/vegetation/built-up (index-only, satquery.physics)
and bi-temporal change (index-only, satquery.change). Free-form captioning, open VQA and grounding need a
`vlm` backend (anything with .ask(images: list[PIL.Image], prompt: str, max_new_tokens: int) -> str) --
without one, the trace says so plainly instead of guessing.
"""
from .bands import load_bands, render_display
from .change import change_report
from .metrics import norm_binary, parse_box
from .physics import verify
from .preflight import preflight

CONCEPT_WORDS = {
    "water": ("water", "river", "lake", "flood", "pond", "sea", "reservoir", "wetland"),
    "vegetation": ("vegetation", "forest", "tree", "crop", "farmland", "greenery", "vegetated"),
    "built": ("built", "building", "urban", "road", "settlement", "construction", "infrastructure"),
}
GROUND_WORDS = ("box", "locate", "point out", "where is", "where are", "highlight", "bounding")
CAPTION_WORDS = ("describe", "caption", "what does this image show", "summarize", "summarise", "scene description")
OBJECTIVE_CONFIDENCE = {"supports": 0.9, "contradicts": 0.9, "inconclusive": 0.35, "unavailable": 0.35}  # sensors answer directly
DISAGREE_CONFIDENCE = 0.15  # model's free-text answer conflicts with the sensor evidence


def detect_concept(question):
    q = question.lower()
    for concept, words in CONCEPT_WORDS.items():
        if any(w in q for w in words):
            return concept
    return None


def classify_task(question, mode):
    """Deterministic keyword router: auditable and cheap. rule-based, not learned -- upgrade to an
    LLM router (still schema-constrained) only if real usage shows questions this misses."""
    if mode == "bitemporal":
        return "change"
    if mode == "cross_modal":
        return "fusion"
    q = question.lower()
    if any(w in q for w in GROUND_WORDS):
        return "grounding"
    if any(w in q for w in CAPTION_WORDS):
        return "caption"
    return "vqa"


def describe_change(rep):
    if not rep["regions"]:
        parts = ["No significant change detected between the two dates."]
    else:
        top = rep["regions"][0]
        parts = [f"{rep['changed_pct']}% of the scene changed; the largest change ({top['area_pct']}% of the scene) is in the {top['where']}."]
    for c, t in rep["trends"].items():
        if t["trend"] != "unchanged":
            parts.append(f"{c.capitalize()} {t['trend']} from {t['before_pct']}% to {t['after_pct']}% of the scene.")
    return " ".join(parts)


def _physics_step(trace, concept, bands_by_role):
    """Ask the sensors directly: is `concept` present? (verify()'s claim_present=True just frames the question;
    the answer is read off the verdict, not treated as a claim to double-check.)"""
    v = verify(concept, True, optical=bands_by_role.get("optical"), sar=bands_by_role.get("sar"))
    trace["tools"].append("physics.verify")
    trace["evidence"]["physics"] = v
    return v


def _physical_yesno(verdict):
    return {"supports": "yes", "contradicts": "no"}.get(verdict)


def answer(paths, question, mode, modalities=None, vlm=None):
    """Run the full pipeline for one query. Returns a dict: task, tools, findings, answer, confidence, evidence."""
    trace = dict(task=None, mode=mode, tools=[], findings=[], answer=None, confidence=None, evidence={})
    rep = preflight(paths, mode, modalities)
    trace["findings"] = [vars(f) for f in rep.findings]
    if not rep.ok:
        trace.update(task="preflight", answer="Cannot proceed: " + "; ".join(f.msg for f in rep.findings if f.level == "BLOCK"), confidence=0.0)
        return trace

    modality_of = {m.path: m.modality for m in rep.metas}
    task = trace["task"] = classify_task(question, mode)
    concept = detect_concept(question)

    if task == "change":
        order = sorted(rep.metas, key=lambda m: m.when)
        b_bands = {modality_of[order[0].path]: load_bands(order[0].path, modality_of[order[0].path])}
        a_bands = {modality_of[order[1].path]: load_bands(order[1].path, modality_of[order[1].path])}
        rep_ch = change_report(b_bands, a_bands)
        trace["tools"].append("change.change_report")
        trace["evidence"]["change"] = {k: v for k, v in rep_ch.items() if k != "mask"}
        if not rep_ch["available"]:
            trace.update(answer="Cannot determine change: " + rep_ch["why"], confidence=0.0)
            return trace
        text = describe_change(rep_ch)
        if vlm:
            imgs = [render_display(order[0].path, modality_of[order[0].path]), render_display(order[1].path, modality_of[order[1].path])]
            text = vlm.ask(imgs, f"Rephrase this change-detection result in one or two fluent sentences, without adding any new facts:\n{text}")
            trace["tools"].append("vlm.phrase")
        trace.update(answer=text, confidence=0.85 if rep_ch["regions"] else 0.6)
        return trace

    if task == "fusion":
        opt_p = next(p for p in paths if modality_of[p] == "optical")
        sar_p = next(p for p in paths if modality_of[p] == "sar")
        bands_by_role = {"optical": load_bands(opt_p, "optical"), "sar": load_bands(sar_p, "sar")}
        per_sensor = {}
        if vlm:
            for role, p in (("optical", opt_p), ("sar", sar_p)):
                per_sensor[role] = vlm.ask([render_display(p, role)], question, max_new_tokens=48)
            trace["tools"].append("vlm.vqa x2")
            trace["evidence"]["per_sensor"] = per_sensor
        if concept:
            v = _physics_step(trace, concept, bands_by_role)
            conf = OBJECTIVE_CONFIDENCE[v["verdict"]]
            text = per_sensor.get("optical") or per_sensor.get("sar") or (f"{concept.capitalize()} is {v['verdict'].replace('supports', 'present').replace('contradicts', 'absent')} based on combined optical+SAR evidence." if v["verdict"] in ("supports", "contradicts") else f"Cannot determine {concept} confidently from optical+SAR evidence.")
        else:
            conf, text = (0.5, per_sensor.get("optical") or per_sensor.get("sar")) if vlm else (0.0, None)
        trace.update(answer=text, confidence=conf)
        if not text:
            trace["findings"].append(dict(level="BLOCK", code="no-backend", msg="fusion needs a VLM backend for this question; none provided"))
        return trace

    if task == "vqa" and concept:
        m = modality_of[paths[0]]
        bands_by_role = {m: load_bands(paths[0], m)}
        v = _physics_step(trace, concept, bands_by_role)
        physics_ans = _physical_yesno(v["verdict"])  # "yes"/"no", or None if the sensors can't tell
        if vlm:
            model_ans = vlm.ask([render_display(paths[0], m)], question, max_new_tokens=8)
            trace["tools"].append("vlm.vqa")
            agree = physics_ans is None or norm_binary(model_ans) == physics_ans
            trace.update(answer=model_ans if agree else f"Uncertain -- model answered '{model_ans}' but sensor evidence says {physics_ans} (see physics check).",
                         confidence=(OBJECTIVE_CONFIDENCE[v["verdict"]] if agree else DISAGREE_CONFIDENCE))
        else:
            trace.update(answer=physics_ans or "unable to determine", confidence=OBJECTIVE_CONFIDENCE[v["verdict"]])
        return trace

    if not vlm:
        trace.update(answer=None, confidence=0.0)
        trace["findings"].append(dict(level="BLOCK", code="no-backend", msg=f"'{task}' needs a VLM backend; none provided"))
        return trace

    imgs = [render_display(p, modality_of[p]) for p in paths]
    max_new = {"caption": 160, "grounding": 32, "vqa": 24}[task]
    ans = vlm.ask(imgs, question, max_new_tokens=max_new)
    trace["tools"].append(f"vlm.{task}")
    if task == "grounding":
        box = parse_box(ans)
        trace["evidence"]["box"] = box
        trace.update(answer=ans, confidence=0.6 if box else 0.2)
        if not box:
            trace["findings"].append(dict(level="WARN", code="unparseable-box", msg=f"model output not a valid box: {ans!r}"))
    else:
        trace.update(answer=ans, confidence=0.7)
    return trace
