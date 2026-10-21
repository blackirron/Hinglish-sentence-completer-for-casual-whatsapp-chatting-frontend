from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Creativity = Literal["safe", "balanced", "playful"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NextRequest(_Strict):
    prompt: str = Field(min_length=1, max_length=2000)
    k: int = Field(default=5, ge=1, le=20)


class CompleteRequest(_Strict):
    prompt: str = Field(min_length=1, max_length=2000)
    n: int = Field(default=3, ge=1, le=8)
    sentences: int = Field(default=1, ge=1, le=3)
    max_new: int = Field(default=48, ge=8, le=200)
    creativity: Creativity = "balanced"
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)


class Candidate(BaseModel):
    word: str
    score: float


class NextResponse(BaseModel):
    mode: Literal["next-word"] = "next-word"
    candidates: list[Candidate]
    source: Literal["model"] = "model"
    latency_ms: int


class Suggestion(BaseModel):
    text: str  # prompt plus continuation, ready to copy
    continuation: str  # only the new part


class CompleteResponse(BaseModel):
    mode: Literal["complete"] = "complete"
    completion: str  # first suggestion, kept for simple clients
    suggestions: list[Suggestion]
    source: Literal["model"] = "model"
    latency_ms: int


class HealthResponse(BaseModel):
    status: Literal["ok", "warming_up"]
    model_loaded: bool


class MetaResponse(BaseModel):
    model_repo: str
    vocab_size: int | None
    max_prompt_chars: int
    max_new_tokens: int
    max_suggestions: int
    languages: list[str]
    perplexity: float


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
