"""Checks the real model end to end. Needs the ONNX package, from the Hub or MODEL_DIR.

    cd api && python scripts/smoke_test.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402
from app.model import OnnxEngine  # noqa: E402

s = Settings.from_env()
eng = OnnxEngine(s.model_repo, s.model_revision, s.hf_token, model_dir=s.model_dir)
t = time.time()
eng.load()
print(f"loaded in {time.time() - t:.1f}s, vocab {eng.vocab_size}, eos {eng.eos}")
if not s.model_dir:
    assert eng.eos == 30522 and eng.vocab_size == 30523, "unexpected eos or vocab size"

print("ids:", eng.tok.encode("kal main office", add_special_tokens=False).ids)

PROMPTS = ["kal main office", "yaar aaj bahut", "tu kya kar raha", "mujhe lagta hai ki", "chal kal milte hain"]
for p in PROMPTS:
    t = time.time()
    words = eng.next_words(p + " ", 5)
    t_next = time.time() - t
    t = time.time()
    outs = eng.complete(p, 3, 1, 48, "balanced", 1)
    t_c = time.time() - t
    assert words and outs, f"empty result for {p!r}"
    print(f"\n{p!r}  next {t_next:.2f}s  complete(3) {t_c:.2f}s")
    print("  next :", [(w, round(sc, 3)) for w, sc in words])
    for o in outs:
        print("  full :", p, o)

words = eng.next_words("kal main off", 5)  # mid word, prefix filtered
print("\nmid word 'off':", words)
assert all(w.lower().startswith("off") for w, _ in words)
print("\nSMOKE TEST PASSED")
