"""Run: python tests/test_chat.py  -- small-talk routing + place-name extraction (offline; no network, no model)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from satquery.chat import is_change_question, is_imagery_question, smalltalk  # noqa: E402
from satquery.places import extract_candidates  # noqa: E402


def demo():
    for t in ("hi", "Hello!!!", "how are you?", "thanks a lot", "who are you", "tell me a joke", "bye", "what can you do?", "help"):
        assert smalltalk(t), t
    from satquery.chat import _R
    assert smalltalk("i'm so sad today") in _R["mood_sad"]  # mood-aware, not the generic greeting
    for t in ("Hi can you show me land cover around Pune", "is there water in this image?", "help me find water in Delhi", "Has Dubai grown since last year?"):
        assert smalltalk(t) is None, t  # real questions must reach the pipeline
    assert "Pune" in extract_candidates("land cover around Pune")
    assert extract_candidates("Has Dubai grown since last year?")[0] == "Dubai"
    assert extract_candidates("is there water in this image?") == []
    assert is_change_question("how has Dubai changed since last year") and not is_change_question("land cover around Pune")
    assert is_imagery_question("land cover around Pune") and not is_imagery_question("tell me about Pune")
    print("chat ok")


if __name__ == "__main__":
    demo()
