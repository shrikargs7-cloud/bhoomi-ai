"""Security utilities: Magic-byte upload validation and sliding-window rate limiting."""

import os
import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


MAGIC_SIGNATURES = {
    ".pdf": ("application/pdf", lambda b: b.startswith(b"%PDF-")),
    ".png": ("image/png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    ".jpg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".webp": ("image/webp", lambda b: len(b) >= 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}


def validate_magic_bytes(raw_bytes: bytes, ext: str) -> str:
    """Validates actual binary file headers against allowed extensions and returns canonical MIME type."""
    ext_low = ext.lower()
    entry = MAGIC_SIGNATURES.get(ext_low)
    if not entry:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(MAGIC_SIGNATURES.keys()))}",
        )
    canonical_mime, checker = entry
    if not raw_bytes or not checker(raw_bytes):
        raise HTTPException(
            status_code=400,
            detail=f"File header magic bytes do not match claimed '{ext_low}' format. Upload rejected.",
        )
    return canonical_mime


class SlidingWindowRateLimiter:
    """Thread-safe in-memory per-key sliding-window rate limiter."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> Tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        ts = now if now is not None else time.monotonic()
        cutoff = ts - self.window_seconds
        with self._lock:
            dq = self._buckets.setdefault(key, deque())
            while dq and dq[0] <= cutoff:
                dq.popleft()
            if len(dq) >= self.max_requests:
                retry_after = max(1, int(dq[0] + self.window_seconds - ts) + 1)
                return False, retry_after
            dq.append(ts)
            return True, 0


def _should_rate_limit(path: str, method: str) -> bool:
    if method != "POST":
        return False
    if path.startswith("/api/auth/"):
        return True
    if path.startswith("/api/cases/") and path.endswith("/documents/upload"):
        return True
    return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP sliding-window rate limiting on auth & document upload endpoints."""

    def __init__(self, app, limiter: SlidingWindowRateLimiter | None = None):
        super().__init__(app)
        rpm = int(os.environ.get("BHOOMI_RATE_LIMIT_RPM", "60"))
        self.limiter = limiter or SlidingWindowRateLimiter(max_requests=rpm, window_seconds=60)

    async def dispatch(self, request: Request, call_next):
        enabled = os.environ.get("BHOOMI_RATE_LIMIT_ENABLED", "true").lower() == "true"
        if enabled and _should_rate_limit(request.url.path, request.method):
            client_ip = request.client.host if request.client else "unknown"
            key = f"{client_ip}:{request.url.path}"
            allowed, retry_after = self.limiter.check(key)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Rate limit exceeded. Retry in {retry_after}s."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)
