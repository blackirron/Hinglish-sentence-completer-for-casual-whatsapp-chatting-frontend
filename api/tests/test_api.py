import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.security import RateLimiter, SlotGuard, AppError
from tests.conftest import SECRET, StubEngine, build, make_settings


def test_health_is_public_and_minimal(engine):
    c = TestClient(create_app(make_settings(), engine))  # no key
    r = c.get("/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model_loaded": True}


def test_health_reports_warming_up():
    c, _ = build(StubEngine(loaded=False))
    # the loader thread is not started by TestClient without lifespan, so still warming
    assert c.get("/v1/health").json()["status"] == "warming_up"


def test_next_word_happy_path(client, engine):
    r = client.post("/v1/next", json={"prompt": "kal main office", "k": 3})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "next-word" and body["source"] == "model"
    assert [c["word"] for c in body["candidates"]] == ["jaa", "aa", "kar"]
    assert engine.calls[-1] == ("next", "kal main office", 3)


def test_complete_happy_path(client, engine):
    r = client.post("/v1/complete", json={"prompt": "kal ka plan", "n": 2, "creativity": "safe", "seed": 7})
    assert r.status_code == 200
    body = r.json()
    assert len(body["suggestions"]) == 2
    assert body["completion"] == body["suggestions"][0]["text"] == "kal ka plan option 0 ho jayega."
    assert engine.calls[-1][5:] == ("safe", 7)


def test_k_and_n_are_clamped_to_settings():
    c, eng = build(max_k=4, max_suggestions=2, max_new_tokens=20)
    c.post("/v1/next", json={"prompt": "hi", "k": 10})
    assert eng.calls[-1][2] == 4
    c.post("/v1/complete", json={"prompt": "hi", "n": 8, "max_new": 100})
    assert eng.calls[-1][2] == 2 and eng.calls[-1][4] == 20


@pytest.mark.parametrize("path,body", [
    ("/v1/next", {"prompt": ""}),
    ("/v1/next", {"prompt": "   "}),
    ("/v1/next", {"prompt": "hi", "k": 0}),
    ("/v1/next", {"prompt": "hi", "extra": 1}),
    ("/v1/complete", {"prompt": "hi", "sentences": 9}),
    ("/v1/complete", {"prompt": "hi", "creativity": "wild"}),
    ("/v1/complete", {"prompt": "x" * 301}),
    ("/v1/complete", {"prompt": 5}),
])
def test_bad_requests_get_uniform_422(client, path, body):
    r = client.post(path, json=body)
    assert r.status_code == 422
    assert set(r.json()) == {"error"} and r.json()["error"]["code"] == "bad_request"


def test_validation_error_does_not_echo_input(client):
    r = client.post("/v1/complete", json={"prompt": "SECRETPROMPT" * 300})
    assert "SECRETPROMPT" not in r.text


def test_auth_required():
    c = TestClient(create_app(make_settings(), StubEngine()))
    assert c.post("/v1/next", json={"prompt": "hi"}).status_code == 401
    r = c.post("/v1/next", json={"prompt": "hi"}, headers={"x-api-key": "wrong" * 8})
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
    assert c.get("/v1/meta").status_code == 401


def test_meta(client):
    r = client.get("/v1/meta")
    assert r.status_code == 200 and r.json()["languages"] == ["hinglish"]


def test_warming_up_returns_503_with_retry_after():
    c, _ = build(StubEngine(loaded=False))
    r = c.post("/v1/next", json={"prompt": "hi"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "warming_up"
    assert r.headers["retry-after"] == "10"


def test_rate_limit_per_client_ip_header_is_trusted_only_with_key():
    c, _ = build(rate_limit_per_min=2)
    h = {"x-client-ip": "203.0.113.9"}
    assert c.post("/v1/next", json={"prompt": "hi"}, headers=h).status_code == 200
    assert c.post("/v1/next", json={"prompt": "hi"}, headers=h).status_code == 200
    r = c.post("/v1/next", json={"prompt": "hi"}, headers=h)
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"
    assert int(r.headers["retry-after"]) >= 1
    # a different end user is not affected
    assert c.post("/v1/next", json={"prompt": "hi"}, headers={"x-client-ip": "203.0.113.10"}).status_code == 200
    # a spoofed garbage value falls back to the connecting host instead of crashing
    assert c.post("/v1/next", json={"prompt": "hi"}, headers={"x-client-ip": "not-an-ip"}).status_code == 200


def test_no_result_gives_422():
    class Empty(StubEngine):
        def complete(self, *a, **k):
            return []
    c, _ = build(Empty())
    r = c.post("/v1/complete", json={"prompt": "hi"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "no_result"


def test_unexpected_error_is_hidden():
    class Boom(StubEngine):
        def next_words(self, *a, **k):
            raise RuntimeError("stack detail /secret/path")
    c = TestClient(create_app(make_settings(), Boom()), headers={"x-api-key": SECRET}, raise_server_exceptions=False)
    r = c.post("/v1/next", json={"prompt": "hi"})
    assert r.status_code == 500 and "secret" not in r.text
    assert r.json()["error"]["code"] == "internal"


def test_body_too_large_413():
    c, _ = build(max_body_bytes=200)
    r = c.post("/v1/next", content=b'{"prompt": "' + b"a" * 500 + b'"}', headers={"content-type": "application/json"})
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"


def test_security_headers_and_docs_hidden(client):
    r = client.get("/v1/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["cache-control"] == "no-store"
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_cors_only_for_allowed_origin():
    c, _ = build(allowed_origins=("https://complete.example",))
    ok = c.get("/v1/health", headers={"origin": "https://complete.example"})
    bad = c.get("/v1/health", headers={"origin": "https://evil.example"})
    assert ok.headers.get("access-control-allow-origin") == "https://complete.example"
    assert "access-control-allow-origin" not in bad.headers


def test_startup_refuses_unsafe_config():
    with pytest.raises(RuntimeError):
        create_app(Settings(env="production", api_shared_secret=None), StubEngine())
    with pytest.raises(RuntimeError):
        create_app(Settings(env="production", api_shared_secret="short"), StubEngine())
    with pytest.raises(RuntimeError):
        create_app(make_settings(allowed_origins=("*",)), StubEngine())
    create_app(Settings(env="dev"), StubEngine())  # dev may run without a secret


def test_dev_mode_without_secret_allows_calls():
    c = TestClient(create_app(Settings(env="dev"), StubEngine()))
    assert c.post("/v1/next", json={"prompt": "hi"}).status_code == 200


def test_rate_limiter_window():
    rl = RateLimiter(2, window_s=10)
    rl.check("a", now=0); rl.check("a", now=1)
    with pytest.raises(AppError):
        rl.check("a", now=2)
    rl.check("a", now=11.5)  # window moved on


def test_slot_guard_rejects_when_line_is_full():
    g = SlotGuard(max_waiting=1)
    with g.slot():
        with pytest.raises(AppError) as exc:
            with g.slot():
                pass
        assert exc.value.status == 503
