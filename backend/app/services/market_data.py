from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
import json
import re
from time import monotonic
from typing import Any

import requests


class MarketDataError(RuntimeError):
    pass


_SPOT_CACHE: tuple[float, dict[str, dict[str, Any]]] | None = None
_SPOT_FAILURE_UNTIL = 0.0
_SPOT_CACHE_SECONDS = 60
_SPOT_FAILURE_COOLDOWN_SECONDS = 60
_MARKET_TIMEOUT_SECONDS = 10
_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="market-data")


def _clean_number(value: Any) -> float | None:
    try:
        if value is None or value == "-":
            return None
        if isinstance(value, float) and value != value:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _run_with_timeout(func, *args):
    future = _EXECUTOR.submit(func, *args)
    try:
        return future.result(timeout=_MARKET_TIMEOUT_SECONDS)
    except TimeoutError as exc:
        raise MarketDataError("Market data request timed out.") from exc


def get_cached_a_share_spot_quotes() -> dict[str, dict[str, Any]]:
    if _SPOT_CACHE:
        return _SPOT_CACHE[1]
    return {}


def _market_symbol(stock_code: str) -> str:
    if stock_code.startswith(("4", "8", "92")):
        return f"bj{stock_code}"
    if stock_code.startswith(("6", "5", "9")):
        return f"sh{stock_code}"
    return f"sz{stock_code}"


def _decode_response(content: bytes, fallback_text: str) -> str:
    try:
        return content.decode("gbk")
    except UnicodeDecodeError:
        return fallback_text


def _fetch_tencent_quotes(stock_codes: list[str]) -> str:
    symbols = ",".join(_market_symbol(code) for code in stock_codes)
    response = requests.get(
        "https://qt.gtimg.cn/q=" + symbols,
        headers={"Referer": "https://gu.qq.com/"},
        timeout=_MARKET_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return _decode_response(response.content, response.text)


def _fetch_tencent_history(stock_code: str, days: int) -> dict[str, Any]:
    symbol = _market_symbol(stock_code)
    response = requests.get(
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get",
        params={"param": f"{symbol},day,,,{days},qfq"},
        headers={"Referer": "https://gu.qq.com/"},
        timeout=_MARKET_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return json.loads(response.text)


def _part(parts: list[str], index: int) -> str | None:
    if index >= len(parts):
        return None
    return parts[index]


def _parse_tencent_quotes(text: str) -> dict[str, dict[str, Any]]:
    quotes: dict[str, dict[str, Any]] = {}
    for match in re.finditer(r'v_(?:sh|sz|bj)(\d{6})="([^"]*)"', text):
        parts = match.group(2).split("~")
        code = _clean_text(_part(parts, 2)) or match.group(1)
        turnover_value = _clean_number(_part(parts, 37))
        quotes[code] = {
            "stock_code": code,
            "stock_name": _clean_text(_part(parts, 1)),
            "latest_price": _clean_number(_part(parts, 3)),
            "change_pct": _clean_number(_part(parts, 32)),
            "change_amount": _clean_number(_part(parts, 31)),
            "turnover": turnover_value * 10000 if turnover_value is not None else None,
            "volume": _clean_number(_part(parts, 36)),
            "amplitude": _clean_number(_part(parts, 43)),
            "high": _clean_number(_part(parts, 33)),
            "low": _clean_number(_part(parts, 34)),
            "open": _clean_number(_part(parts, 5)),
            "previous_close": _clean_number(_part(parts, 4)),
            "turnover_rate": _clean_number(_part(parts, 38)),
            "sixty_day_change_pct": None,
            "year_to_date_change_pct": None,
        }
    return quotes


def get_a_share_spot_quotes(stock_codes: list[str] | None = None) -> dict[str, dict[str, Any]]:
    global _SPOT_CACHE, _SPOT_FAILURE_UNTIL

    codes = sorted({code for code in stock_codes or [] if len(code) == 6 and code.isdigit()})
    if not codes:
        return get_cached_a_share_spot_quotes()

    now = monotonic()
    if _SPOT_CACHE and now - _SPOT_CACHE[0] < _SPOT_CACHE_SECONDS and all(code in _SPOT_CACHE[1] for code in codes):
        return {code: _SPOT_CACHE[1][code] for code in codes}
    if now < _SPOT_FAILURE_UNTIL:
        raise MarketDataError("Market data is temporarily unavailable.")

    try:
        text = _run_with_timeout(_fetch_tencent_quotes, codes)
    except Exception as exc:
        _SPOT_FAILURE_UNTIL = monotonic() + _SPOT_FAILURE_COOLDOWN_SECONDS
        raise MarketDataError("Failed to fetch Tencent A-share spot quotes.") from exc

    quotes = _parse_tencent_quotes(text)
    _SPOT_CACHE = (now, quotes)
    return quotes


def get_a_share_history(stock_code: str, days: int) -> list[dict[str, Any]]:
    try:
        payload = _run_with_timeout(_fetch_tencent_history, stock_code, days)
    except Exception as exc:
        raise MarketDataError("Failed to fetch Tencent A-share history.") from exc

    records = []
    symbol = _market_symbol(stock_code)
    rows = payload.get("data", {}).get(symbol, {}).get("qfqday") or payload.get("data", {}).get(symbol, {}).get("day") or []
    previous_close = None
    for row in rows[-days:]:
        open_price = _clean_number(row[1] if len(row) > 1 else None)
        close_price = _clean_number(row[2] if len(row) > 2 else None)
        change_pct = None
        if previous_close not in (None, 0) and close_price is not None:
            change_pct = round((close_price - previous_close) / previous_close * 100, 4)
        records.append(
            {
                "date": str(row[0] if len(row) > 0 else ""),
                "close": close_price,
                "open": open_price,
                "high": _clean_number(row[3] if len(row) > 3 else None),
                "low": _clean_number(row[4] if len(row) > 4 else None),
                "change_pct": change_pct,
                "turnover": None,
                "turnover_rate": None,
            }
        )
        if close_price is not None:
            previous_close = close_price
    return records
