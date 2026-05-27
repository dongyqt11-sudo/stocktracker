from __future__ import annotations

from datetime import date, timedelta
from time import monotonic
from typing import Any


class MarketDataError(RuntimeError):
    pass


_SPOT_CACHE: tuple[float, dict[str, dict[str, Any]]] | None = None
_SPOT_CACHE_SECONDS = 60


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


def _load_akshare():
    try:
        import akshare as ak
    except Exception as exc:  # pragma: no cover - depends on local optional package state
        raise MarketDataError("AKShare is not available.") from exc
    return ak


def get_a_share_spot_quotes() -> dict[str, dict[str, Any]]:
    global _SPOT_CACHE

    now = monotonic()
    if _SPOT_CACHE and now - _SPOT_CACHE[0] < _SPOT_CACHE_SECONDS:
        return _SPOT_CACHE[1]

    ak = _load_akshare()
    try:
        frame = ak.stock_zh_a_spot_em()
    except Exception as exc:
        raise MarketDataError("Failed to fetch A-share spot quotes.") from exc

    quotes: dict[str, dict[str, Any]] = {}
    for row in frame.to_dict("records"):
        code = _clean_text(row.get("代码"))
        if not code:
            continue
        quotes[code] = {
            "stock_code": code,
            "stock_name": _clean_text(row.get("名称")),
            "latest_price": _clean_number(row.get("最新价")),
            "change_pct": _clean_number(row.get("涨跌幅")),
            "change_amount": _clean_number(row.get("涨跌额")),
            "turnover": _clean_number(row.get("成交额")),
            "volume": _clean_number(row.get("成交量")),
            "amplitude": _clean_number(row.get("振幅")),
            "high": _clean_number(row.get("最高")),
            "low": _clean_number(row.get("最低")),
            "open": _clean_number(row.get("今开")),
            "previous_close": _clean_number(row.get("昨收")),
            "turnover_rate": _clean_number(row.get("换手率")),
            "sixty_day_change_pct": _clean_number(row.get("60日涨跌幅")),
            "year_to_date_change_pct": _clean_number(row.get("年初至今涨跌幅")),
        }

    _SPOT_CACHE = (now, quotes)
    return quotes


def get_a_share_history(stock_code: str, days: int) -> list[dict[str, Any]]:
    ak = _load_akshare()
    end = date.today()
    start = end - timedelta(days=max(days * 2, 30))

    try:
        frame = ak.stock_zh_a_hist(
            symbol=stock_code,
            period="daily",
            start_date=start.strftime("%Y%m%d"),
            end_date=end.strftime("%Y%m%d"),
            adjust="qfq",
        )
    except Exception as exc:
        raise MarketDataError("Failed to fetch A-share history.") from exc

    records = []
    for row in frame.tail(days).to_dict("records"):
        records.append(
            {
                "date": str(row.get("日期")),
                "close": _clean_number(row.get("收盘")),
                "open": _clean_number(row.get("开盘")),
                "high": _clean_number(row.get("最高")),
                "low": _clean_number(row.get("最低")),
                "change_pct": _clean_number(row.get("涨跌幅")),
                "turnover": _clean_number(row.get("成交额")),
                "turnover_rate": _clean_number(row.get("换手率")),
            }
        )
    return records
