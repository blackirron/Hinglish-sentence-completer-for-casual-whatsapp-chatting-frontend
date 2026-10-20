"""All runtime settings come from environment variables, with safe defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _csv(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(part.strip() for part in value.split(",") if part.strip())


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    env: str = "production"  # "dev" relaxes the secret requirement, nothing else
    model_repo: str = "blackirron/hinglish-gpt2-onnx"
    model_dir: str | None = None  # a local folder with the ONNX package, skips the Hub download
    model_revision: str | None = None
    hf_token: str | None = None
    allowed_origins: tuple[str, ...] = ()
    api_shared_secret: str | None = None
    max_prompt_chars: int = 300
    max_new_tokens: int = 60
    max_suggestions: int = 4
    max_k: int = 10
    rate_limit_per_min: int = 30
    max_queue: int = 4
    max_body_bytes: int = 4096
    blocklist: tuple[str, ...] = ()
    ort_threads: int = 0  # 0 means 2 threads

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            env=os.environ.get("APP_ENV", "production").lower(),
            model_repo=os.environ.get("MODEL_REPO", cls.model_repo),
            model_dir=os.environ.get("MODEL_DIR") or None,
            model_revision=os.environ.get("MODEL_REVISION") or None,
            hf_token=os.environ.get("HF_TOKEN") or None,
            allowed_origins=_csv(os.environ.get("ALLOWED_ORIGINS")),
            api_shared_secret=os.environ.get("API_SHARED_SECRET") or None,
            max_prompt_chars=_int("MAX_PROMPT_CHARS", 300),
            max_new_tokens=_int("MAX_NEW_TOKENS", 60),
            max_suggestions=_int("MAX_SUGGESTIONS", 4),
            max_k=_int("MAX_K", 10),
            rate_limit_per_min=_int("RATE_LIMIT_PER_MIN", 30),
            max_queue=_int("MAX_QUEUE", 4),
            max_body_bytes=_int("MAX_BODY_BYTES", 4096),
            blocklist=tuple(w.lower() for w in _csv(os.environ.get("BLOCKLIST_WORDS"))),
            ort_threads=_int("ORT_THREADS", 0),
        )

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"

    def validate(self) -> None:
        """Fail at startup, not at the first request, when the setup is unsafe."""
        if not self.is_dev:
            if not self.api_shared_secret or len(self.api_shared_secret) < 24:
                raise RuntimeError(
                    "API_SHARED_SECRET must be set to at least 24 characters "
                    "(set APP_ENV=dev for local work without it)."
                )
            if "*" in self.allowed_origins:
                raise RuntimeError("ALLOWED_ORIGINS must not contain '*'.")
