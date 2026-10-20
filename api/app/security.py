"""Small, dependency free guards: rate limiting, queue limit, key check, errors."""
from __future__ import annotations

import hmac
import ipaddress
import threading
import time
from collections import deque
from contextlib import contextmanager


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.headers = headers or {}


def secrets_match(supplied: str | None, expected: str | None) -> bool:
    if not supplied or not expected:
        return False
    return hmac.compare_digest(supplied.encode(), expected.encode())


def parse_client_ip(value: str | None) -> str | None:
    """Accept only a well formed IP address from the trusted proxy header."""
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


class RateLimiter:
    """Sliding window per key, in memory. Fine for one small instance."""

    def __init__(self, per_minute: int, window_s: float = 60.0, max_keys: int = 5000):
        self.per_minute = per_minute
        self.window = window_s
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> None:
        if self.per_minute <= 0:
            return
        now = time.monotonic() if now is None else now
        with self._lock:
            if len(self._hits) > self.max_keys:
                self._prune(now)
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.per_minute:
                retry = max(1, int(self.window - (now - hits[0])) + 1)
                raise AppError(
                    "rate_limited",
                    "Too many requests. Please wait a moment and try again.",
                    429,
                    {"Retry-After": str(retry)},
                )
            hits.append(now)

    def _prune(self, now: float) -> None:
        for key in [k for k, h in self._hits.items() if not h or now - h[-1] > self.window]:
            del self._hits[key]


class SlotGuard:
    """One generation at a time, a short waiting line, then a clear 503."""

    def __init__(self, max_waiting: int):
        self._run = threading.Semaphore(1)
        self._max_waiting = max_waiting
        self._waiting = 0
        self._lock = threading.Lock()

    @contextmanager
    def slot(self):
        with self._lock:
            if self._waiting >= self._max_waiting:
                raise AppError("busy", "The model is busy. Try again in a few seconds.", 503, {"Retry-After": "5"})
            self._waiting += 1
        try:
            self._run.acquire()
            try:
                yield
            finally:
                self._run.release()
        finally:
            with self._lock:
                self._waiting -= 1
