import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

SECRET = "x" * 32


class StubEngine:
    def __init__(self, loaded=True):
        self.loaded = loaded
        self.vocab_size = 30523
        self.calls = []

    def load(self):
        self.loaded = True

    def next_words(self, prompt, k):
        self.calls.append(("next", prompt, k))
        words = [("jaa", 0.3), ("aa", 0.2), ("kar", 0.1), ("ho", 0.05), ("de", 0.02)]
        return words[:k]

    def complete(self, prompt, n, sentences, max_new, creativity, seed):
        self.calls.append(("complete", prompt, n, sentences, max_new, creativity, seed))
        return [f"option {i} ho jayega." for i in range(n)]


def make_settings(**kw):
    base = dict(env="production", api_shared_secret=SECRET, rate_limit_per_min=1000)
    base.update(kw)
    return Settings(**base)


@pytest.fixture
def engine():
    return StubEngine()


@pytest.fixture
def client(engine):
    return TestClient(create_app(make_settings(), engine), headers={"x-api-key": SECRET})


def build(engine=None, **kw):
    engine = engine or StubEngine()
    return TestClient(create_app(make_settings(**kw), engine), headers={"x-api-key": SECRET}), engine
