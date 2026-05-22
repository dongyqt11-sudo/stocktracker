from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, assets, consistency, dashboard, holdings, notes, screenshots, transactions
from app.config import get_settings
from app.db import init_db


settings = get_settings()

app = FastAPI(title="StockTracker API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    settings.screenshot_path.mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/debug/settings")
def debug_settings() -> dict[str, str | int | bool]:
    return {
        "qwen_model": settings.qwen_model,
        "ai_timeout_seconds": settings.ai_timeout_seconds,
        "has_qwen_api_key": bool(settings.qwen_api_key),
    }


app.include_router(screenshots.router, prefix="/api")
app.include_router(holdings.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(consistency.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
