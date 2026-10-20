from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings
from .model import Engine, OnnxEngine, build_text
from .schemas import (
    Candidate,
    CompleteRequest,
    CompleteResponse,
    HealthResponse,
    MetaResponse,
    NextRequest,
    NextResponse,
    Suggestion,
)
from .security import AppError, RateLimiter, SlotGuard, parse_client_ip, secrets_match
from .textutil import clean_prompt

log = logging.getLogger("complete.api")
PERPLEXITY = 10.79  # eval perplexity of the fine tuned model from training


class BodyTooLarge(Exception):
    pass


class BodyLimitMiddleware:
    """Reject oversized bodies before they reach the JSON parser."""

    def __init__(self, app, max_bytes: int):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        length = dict(scope["headers"]).get(b"content-length")
        if length and length.isdigit() and int(length) > self.max_bytes:
            return await self._reject(send)
        seen = 0
        started = False

        async def limited():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    raise BodyTooLarge
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited, tracking_send)
        except BodyTooLarge:
            if not started:
                await self._reject(send)

    async def _reject(self, send):
        response = _error_response(AppError("too_large", "Request is too large.", 413))
        await response({"type": "http", "headers": []}, None, send)


def _error_response(err: AppError) -> JSONResponse:
    return JSONResponse(
        {"error": {"code": err.code, "message": err.message}}, status_code=err.status, headers=err.headers
    )


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.validate()
    if engine is None:
        engine = OnnxEngine(
            settings.model_repo, settings.model_revision, settings.hf_token,
            blocklist=settings.blocklist, threads=settings.ort_threads, model_dir=settings.model_dir,
        )
    limiter = RateLimiter(settings.rate_limit_per_min)
    guard = SlotGuard(settings.max_queue)
    state = {"load_error": None}

    def _load() -> None:
        try:
            engine.load()
        except Exception:  # keep serving health so the failure is visible
            log.exception("model failed to load")
            state["load_error"] = True

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if not engine.loaded:
            threading.Thread(target=_load, daemon=True, name="model-loader").start()
        yield

    app = FastAPI(
        title="complete.io inference API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.is_dev else None,
    )
    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.max_body_bytes)
    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.allowed_origins),
            allow_methods=["GET", "POST"],
            allow_headers=["content-type", "x-api-key", "x-client-ip"],
            max_age=600,
        )

    @app.middleware("http")
    async def headers_and_logging(request: Request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        # Never log request bodies: prompts are private.
        log.info("%s %s %s %dms", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - t0) * 1000)
        return response

    # errors ----------------------------------------------------------------
    @app.exception_handler(AppError)
    async def _app_error(_: Request, err: AppError):
        return _error_response(err)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, __: RequestValidationError):
        # Do not echo the submitted input back.
        return _error_response(AppError("bad_request", "The request was not valid.", 422))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "error")
        return _error_response(AppError(code, "Not available.", exc.status_code))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        log.exception("unhandled error")
        return _error_response(AppError("internal", "Something went wrong on our side.", 500))

    # dependencies ----------------------------------------------------------
    def authed(request: Request) -> str:
        """Check the shared secret and the rate limit; return the rate key."""
        trusted = False
        if settings.api_shared_secret:
            if not secrets_match(request.headers.get("x-api-key"), settings.api_shared_secret):
                raise AppError("unauthorized", "Missing or wrong API key.", 401)
            trusted = True
        elif not settings.is_dev:
            raise AppError("unauthorized", "Missing or wrong API key.", 401)
        ip = parse_client_ip(request.headers.get("x-client-ip")) if trusted else None
        key = ip or (request.client.host if request.client else "unknown")
        limiter.check(key)
        return key

    def ready() -> Engine:
        if not engine.loaded:
            raise AppError("warming_up", "The model is waking up. Try again shortly.", 503, {"Retry-After": "10"})
        return engine

    def prompt_of(raw: str) -> str:
        text = clean_prompt(raw)
        if not text.strip():
            raise AppError("bad_request", "Please type something first.", 422)
        if len(text) > settings.max_prompt_chars:
            raise AppError("bad_request", f"Keep it under {settings.max_prompt_chars} characters.", 422)
        return text

    # routes ----------------------------------------------------------------
    @app.get("/v1/health", response_model=HealthResponse)
    def health():
        return HealthResponse(status="ok" if engine.loaded else "warming_up", model_loaded=engine.loaded)

    @app.get("/v1/meta", response_model=MetaResponse)
    def meta(_: str = Depends(authed)):
        return MetaResponse(
            model_repo=settings.model_repo,
            vocab_size=engine.vocab_size,
            max_prompt_chars=settings.max_prompt_chars,
            max_new_tokens=settings.max_new_tokens,
            max_suggestions=settings.max_suggestions,
            languages=["hinglish"],
            perplexity=PERPLEXITY,
        )

    @app.post("/v1/next", response_model=NextResponse)
    def next_word(body: NextRequest, _: str = Depends(authed)):
        eng = ready()
        prompt = prompt_of(body.prompt)
        k = min(body.k, settings.max_k)
        t0 = time.perf_counter()
        with guard.slot():
            found = eng.next_words(prompt, k)
        return NextResponse(
            candidates=[Candidate(word=w, score=round(s, 4)) for w, s in found],
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )

    @app.post("/v1/complete", response_model=CompleteResponse)
    def complete(body: CompleteRequest, _: str = Depends(authed)):
        eng = ready()
        prompt = prompt_of(body.prompt)
        n = min(body.n, settings.max_suggestions)
        max_new = min(body.max_new, settings.max_new_tokens)
        t0 = time.perf_counter()
        with guard.slot():
            parts = eng.complete(prompt, n, body.sentences, max_new, body.creativity, body.seed)
        suggestions = [Suggestion(text=build_text(prompt, p), continuation=p) for p in parts if p]
        if not suggestions:
            raise AppError("no_result", "The model had nothing to add. Try a longer start.", 422)
        return CompleteResponse(
            completion=suggestions[0].text,
            suggestions=suggestions,
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )

    return app


def app_factory() -> FastAPI:  # uvicorn app.main:app_factory --factory
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return create_app()
