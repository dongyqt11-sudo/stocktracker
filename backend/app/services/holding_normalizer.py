"""Normalize holding OCR numbers before they are stored.

Local OCR can occasionally drop the decimal point from ETF prices, for example
reading 1.998 as 998. When quantity and market value are available, the current
price can be inferred reliably from market_value / quantity.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


PRICE_SCALE = Decimal("0.0001")
MIN_ABSOLUTE_TOLERANCE = Decimal("0.01")
RELATIVE_TOLERANCE = Decimal("0.05")


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError):
        return None


def _to_json_number(value: Decimal) -> float:
    return float(value.quantize(PRICE_SCALE, rounding=ROUND_HALF_UP))


def infer_current_price(quantity: Any, market_value: Any) -> Decimal | None:
    """Infer current price from quantity and market value when possible."""
    quantity_decimal = _to_decimal(quantity)
    market_value_decimal = _to_decimal(market_value)
    if quantity_decimal is None or market_value_decimal is None:
        return None
    if quantity_decimal <= 0 or market_value_decimal <= 0:
        return None
    return (market_value_decimal / quantity_decimal).quantize(PRICE_SCALE, rounding=ROUND_HALF_UP)


def should_correct_current_price(current_price: Any, inferred_price: Decimal | None) -> bool:
    """Return True when the stored price is missing or clearly inconsistent."""
    if inferred_price is None:
        return False
    current_decimal = _to_decimal(current_price)
    if current_decimal is None:
        return True
    tolerance = max(MIN_ABSOLUTE_TOLERANCE, abs(inferred_price) * RELATIVE_TOLERANCE)
    return abs(current_decimal - inferred_price) > tolerance


def normalize_holding_numbers(data: dict[str, Any]) -> dict[str, Any]:
    """Return a copy with an obviously wrong current_price corrected.

    The correction is intentionally conservative: it only changes current_price
    when the value differs from market_value / quantity by more than 5% and at
    least one cent. Extra metadata is kept in the JSON payload for traceability.
    """
    normalized = dict(data)
    inferred_price = infer_current_price(
        normalized.get("quantity"),
        normalized.get("market_value"),
    )
    if not should_correct_current_price(normalized.get("current_price"), inferred_price):
        return normalized

    original_price = normalized.get("current_price")
    if original_price is not None and original_price != "":
        normalized["current_price_original"] = original_price
    normalized["current_price"] = _to_json_number(inferred_price)
    normalized["current_price_auto_corrected"] = True
    return normalized


def normalize_holding_recognized_data(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize every holding item inside a recognized screenshot payload."""
    if data.get("screenshot_type") != "holdings" or not isinstance(data.get("items"), list):
        return data
    normalized = dict(data)
    normalized["items"] = [
        normalize_holding_numbers(item) if isinstance(item, dict) else item
        for item in data["items"]
    ]
    return normalized
