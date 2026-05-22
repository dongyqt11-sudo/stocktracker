from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models.holdings import Holding
from app.models.screenshots import Screenshot
from app.schemas.holdings import HoldingRecognizedData
from app.schemas.screenshots import (
    ScreenshotConfirmRequest,
    ScreenshotConfirmResponse,
    ScreenshotUploadResponse,
)
from app.services.ocr_recognizer import recognize_screenshot_by_ocr
from app.services.stock_code_map import (
    apply_stock_code_suggestions,
    is_valid_stock_code,
    load_stock_code_map,
    normalize_stock_name,
    update_stock_code_map_from_items,
)

router = APIRouter(prefix="/screenshots", tags=["screenshots"])


def _safe_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def _save_upload(file: UploadFile) -> Path:
    settings = get_settings()
    screenshot_dir = settings.screenshot_path
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "screenshot.png").suffix.lower() or ".png"
    target = screenshot_dir / f"{date.today().isoformat()}-{uuid4().hex}{suffix}"
    target.write_bytes(file.file.read())
    return target


def _build_stock_code_map(db: Session) -> dict[str, str]:
    mapping = load_stock_code_map()
    rows = (
        db.query(Holding.stock_name, Holding.stock_code)
        .filter(Holding.stock_name.isnot(None))
        .order_by(Holding.id)
        .all()
    )
    for stock_name, stock_code in rows:
        name = normalize_stock_name(stock_name)
        code = str(stock_code or "").strip()
        if name and is_valid_stock_code(code):
            mapping[name] = code
    return mapping


@router.post("/upload", response_model=ScreenshotUploadResponse)
def upload_screenshot(
    file: UploadFile = File(...),
    hint_type: str | None = Form(default=None),
    account_id: str = Form(default="account_1"),
    account_name: str = Form(default="Account 1"),
    db: Session = Depends(get_db),
) -> ScreenshotUploadResponse:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    path = _save_upload(file)
    recognized_data = recognize_screenshot_by_ocr(str(path), hint_type=hint_type)
    if not recognized_data.get("error") and recognized_data.get("screenshot_type") == "holdings":
        recognized_data = apply_stock_code_suggestions(recognized_data, _build_stock_code_map(db))

    screenshot = Screenshot(
        account_id=account_id,
        account_name=account_name,
        file_path=str(path),
        screenshot_type=recognized_data.get("screenshot_type"),
        raw_ai_response=recognized_data,
        status="pending",
    )
    db.add(screenshot)
    db.commit()
    db.refresh(screenshot)

    return ScreenshotUploadResponse(
        screenshot_id=screenshot.id,
        account_id=screenshot.account_id,
        account_name=screenshot.account_name,
        status=screenshot.status,
        recognized_data=recognized_data,
        error=recognized_data.get("error"),
    )


@router.post("/{screenshot_id}/confirm", response_model=ScreenshotConfirmResponse)
def confirm_screenshot(
    screenshot_id: int,
    payload: ScreenshotConfirmRequest,
    db: Session = Depends(get_db),
) -> ScreenshotConfirmResponse:
    screenshot = db.get(Screenshot, screenshot_id)
    if screenshot is None:
        raise HTTPException(status_code=404, detail="Screenshot record not found.")
    if screenshot.status == "confirmed":
        raise HTTPException(status_code=409, detail="This screenshot has already been confirmed.")
    if payload.screenshot_type != "holdings":
        raise HTTPException(status_code=400, detail="Stage 1 only supports holdings screenshots.")

    try:
        recognized = HoldingRecognizedData.model_validate(payload.data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid holdings data: {exc.errors()}") from exc

    if recognized.screenshot_type != "holdings":
        raise HTTPException(status_code=400, detail="Recognition result is not a holdings page.")
    if not recognized.items:
        raise HTTPException(status_code=400, detail="No holdings records to save.")
    invalid_codes = [
        item.stock_name or f"row {index + 1}"
        for index, item in enumerate(recognized.items)
        if not is_valid_stock_code(item.stock_code)
    ]
    if invalid_codes:
        names = ", ".join(invalid_codes[:5])
        raise HTTPException(
            status_code=400,
            detail=f"Please fill valid 6-digit stock codes before saving: {names}",
        )

    try:
        for item in recognized.items:
            data = item.model_dump()
            db.add(
                Holding(
                    account_id=screenshot.account_id,
                    account_name=screenshot.account_name,
                    snapshot_date=recognized.snapshot_date,
                    stock_code=data["stock_code"],
                    stock_name=data.get("stock_name"),
                    quantity=_safe_decimal(data.get("quantity")),
                    cost_price=_safe_decimal(data.get("cost_price")),
                    current_price=_safe_decimal(data.get("current_price")),
                    market_value=_safe_decimal(data.get("market_value")),
                    profit_loss=_safe_decimal(data.get("profit_loss")),
                    profit_loss_pct=_safe_decimal(data.get("profit_loss_pct")),
                    screenshot_id=screenshot.id,
                )
            )

        screenshot.status = "confirmed"
        screenshot.screenshot_type = "holdings"
        screenshot.raw_ai_response = payload.data
        update_stock_code_map_from_items(recognized.items)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database save failed. Please retry.") from exc

    return ScreenshotConfirmResponse(
        screenshot_id=screenshot.id,
        account_id=screenshot.account_id,
        account_name=screenshot.account_name,
        status=screenshot.status,
        inserted_count=len(recognized.items),
    )
