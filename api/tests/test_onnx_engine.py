"""Runs the real ONNX engine on the tiny test model. Skipped when the model is not built.

Build it once with: python tools/make_test_model.py
"""
import os
from pathlib import Path

import pytest

DIR = Path(os.environ.get("TEST_MODEL_DIR", Path(__file__).resolve().parents[2] / "web/public/models/test-tiny"))
pytestmark = pytest.mark.skipif(not (DIR / "onnx/model_quantized.onnx").exists(), reason="test model not built")


@pytest.fixture(scope="module")
def engine():
    from app.model import OnnxEngine

    e = OnnxEngine("unused", model_dir=str(DIR), threads=1)
    e.load()
    return e


def test_next_words_are_whole_clean_words(engine):
    words = engine.next_words("kal main office ", 5)
    assert 1 <= len(words) <= 5
    assert all(w and " " not in w and not w.startswith("[") for w, _ in words)
    assert [s for _, s in words] == sorted((s for _, s in words), reverse=True)


def test_mid_word_filters_by_prefix(engine):
    words = engine.next_words("kal main off", 5)
    assert all(w.lower().startswith("off") for w, _ in words)


def test_complete_stops_at_sentence_end_and_is_seeded(engine):
    a = engine.complete("kal milte hain", 3, 1, 40, "balanced", 7)
    b = engine.complete("kal milte hain", 3, 1, 40, "balanced", 7)
    assert a == b and a
    assert all(len(t) > 0 and not t.endswith(" ") for t in a)


def test_blocklist_removes_words(engine):
    engine.blocklist = ("jaa",)
    try:
        assert "jaa" not in [w for w, _ in engine.next_words("kal main office ", 5)]
    finally:
        engine.blocklist = ()
