"""BhoomiAI FastAPI Main Application Entrypoint"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.security import RateLimitMiddleware
from app.db.database import Base, SessionLocal, engine
from app.db.repository import seed_demo_cases


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_cases(db, force_reset=False)
    finally:
        db.close()
    yield


def _allowed_origins() -> list[str]:
    raw = os.environ.get(
        "BHOOMI_CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(
    title="BhoomiAI Land Intelligence API",
    description="Evidence-first land document intelligence, lineage reconstruction, and discrepancy detection engine.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
