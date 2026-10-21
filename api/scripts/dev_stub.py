"""Run the API with a fake model, for building and testing the UI without torch or weights.

    python scripts/dev_stub.py        # serves http://localhost:8000

The words below are placeholders, not model output.
"""
from __future__ import annotations

import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("APP_ENV", "dev")
os.environ.setdefault("API_SHARED_SECRET", "change-me-to-a-long-random-string-32-chars")

import uvicorn  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

WORDS = [("jaa", 0.31), ("aa", 0.19), ("kar", 0.12), ("ho", 0.08), ("de", 0.05), ("raha", 0.04)]
ENDINGS = [
    "timing confirm kar dena.", "location bata dena.", "thoda pehle bata dena yaar.",
    "exact time aur location send kar dena!", "kya scene hai?", "main late ho jaunga.",
]


class StubEngine:
    loaded = True
    vocab_size = 30523

    def load(self):  # pragma: no cover
        pass

    def next_words(self, prompt, k):
        time.sleep(0.05)
        return WORDS[:k]

    def complete(self, prompt, n, sentences, max_new, creativity, seed):
        time.sleep(0.4)
        rng = random.Random(seed)
        return rng.sample(ENDINGS, k=min(n, len(ENDINGS)))


if __name__ == "__main__":
    app = create_app(Settings.from_env(), StubEngine())
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
