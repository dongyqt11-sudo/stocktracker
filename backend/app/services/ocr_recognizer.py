import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from PIL import Image


KNOWN_NOISE = {
    "买入",
    "卖出",
    "撤单",
    "持仓",
    "查询",
    "持仓股",
    "市值v",
    "持仓管理",
    "首页",
    "行情",
    "自选",
    "交易",
    "资讯",
    "理财",
    "批量买入",
    "批量卖出",
    "资产分析",
    "止盈止损",
    "持仓资讯",
}


def _clean_text(text: str) -> str:
    return (
        text.replace(" ", "")
        .replace("：", ":")
        .replace("，", ",")
        .replace("．", ".")
        .replace("·", ".")
        .replace("％", "%")
        .replace("一", "-")
        .strip()
    )


def _to_number(text: str) -> float | None:
    cleaned = _clean_text(text)
    amount_before_percent = _amount_before_percent(cleaned)
    if amount_before_percent is not None:
        return amount_before_percent
    cleaned = cleaned.replace("+", "").replace("%", "")
    cleaned = re.sub(r"[^0-9,.\-]", "", cleaned)
    cleaned = cleaned.replace(",", "")
    if cleaned in {"", "-", ".", "-."}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _amount_before_percent(text: str) -> float | None:
    if "%" not in text:
        return None
    cleaned = text.replace("+", "").replace(",", "")
    cleaned = re.sub(r"(?<=\d)[Zz](?=\d)", "7.", cleaned)
    cleaned = re.sub(r"(?<=\d)[Oo](?=\d|\.|%)", "0", cleaned)
    match = re.search(r"(-?\d+(?:\.\d{2}))(?=\d+(?:\.\d+)?%)", cleaned)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _ocr_payload(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"text": line["text"], "x": line["x"], "y": line["y"]} for line in lines]


def _joined_text(lines: list[dict[str, Any]]) -> str:
    return "".join(line["text"] for line in lines)


def _detect_screenshot_type(lines: list[dict[str, Any]]) -> str | None:
    text = _joined_text(lines)
    holding_score = sum(keyword in text for keyword in ("持仓", "成本价", "持仓数量", "持仓股"))
    transaction_score = sum(keyword in text for keyword in ("成交", "委托", "买入", "卖出", "成交时间", "成交价格"))
    asset_score = sum(keyword in text for keyword in ("总资产", "可用资金", "可用现金", "账户", "资产"))

    if holding_score >= 2 or ("持仓" in text and "成本" in text):
        return "holdings"
    if transaction_score >= 2 and ("买入" in text or "卖出" in text):
        return "transactions"
    if asset_score >= 2 or ("总资产" in text and ("可用资金" in text or "可用现金" in text)):
        return "assets"
    return None


def _extract_date(text: str, fallback: date | None = None) -> date:
    fallback = fallback or date.today()
    match = re.search(r"(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})", text)
    if match:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    match = re.search(r"(?<!\d)(\d{1,2})[-/.月](\d{1,2})(?:日)?(?!\d)", text)
    if match:
        return date(fallback.year, int(match.group(1)), int(match.group(2)))
    return fallback


def _normalize_trade_time(text: str, fallback: date | None = None) -> str:
    fallback = fallback or date.today()
    snapshot_date = _extract_date(text, fallback)
    time_match = re.search(r"(?<!\d)(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)", text)
    if not time_match:
        return f"{snapshot_date.isoformat()} 00:00:00"
    hour = int(time_match.group(1))
    minute = int(time_match.group(2))
    second = int(time_match.group(3) or 0)
    return datetime(
        snapshot_date.year,
        snapshot_date.month,
        snapshot_date.day,
        hour,
        minute,
        second,
    ).strftime("%Y-%m-%d %H:%M:%S")


def _is_date_or_time_text(text: str) -> bool:
    return bool(
        re.search(r"(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})", text)
        or re.search(r"(?<!\d)\d{1,2}:\d{2}(?::\d{2})?(?!\d)", text)
    )


def _line_bbox(line: dict[str, Any]) -> dict[str, float]:
    rects = [word["bounding_rect"] for word in line.get("words", []) if "bounding_rect" in word]
    if not rects:
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}
    min_x = min(rect["x"] for rect in rects)
    min_y = min(rect["y"] for rect in rects)
    max_x = max(rect["x"] + rect["width"] for rect in rects)
    max_y = max(rect["y"] + rect["height"] for rect in rects)
    return {"x": min_x, "y": min_y, "width": max_x - min_x, "height": max_y - min_y}


def _ocr_lines(image_path: str) -> list[dict[str, Any]]:
    import winocr

    image = Image.open(image_path)
    result = winocr.recognize_pil_sync(image, lang="zh-Hans")
    lines: list[dict[str, Any]] = []
    for line in result.get("lines", []):
        text = _clean_text(line.get("text", ""))
        if not text:
            continue
        bbox = _line_bbox(line)
        lines.append({"text": text, "x": bbox["x"], "y": bbox["y"], "raw": line})
    return sorted(lines, key=lambda row: (row["y"], row["x"]))


def _is_stock_name(line: dict[str, Any]) -> bool:
    text = line["text"]
    if line["y"] < 1120 or line["x"] > 360:
        return False
    if text in KNOWN_NOISE:
        return False
    if not re.search(r"[\u4e00-\u9fffA-Za-z]", text):
        return False
    if not re.search(r"[\u4e00-\u9fffA-Za-z]", text) and _to_number(text) is not None:
        return False
    return True


def _first_number(
    lines: list[dict[str, Any]],
    x_min: float,
    x_max: float,
    min_y: float | None = None,
) -> float | None:
    candidates = [
        line
        for line in lines
        if x_min <= line["x"] <= x_max
        and (min_y is None or line["y"] >= min_y)
        and _to_number(line["text"]) is not None
    ]
    if not candidates:
        return None
    return _to_number(candidates[0]["text"])


def _numbers_in_column(lines: list[dict[str, Any]], x_min: float, x_max: float) -> list[float]:
    values: list[float] = []
    for line in lines:
        if x_min <= line["x"] <= x_max:
            value = _to_number(line["text"])
            if value is not None:
                values.append(value)
    return values


def _recognize_holdings(lines: list[dict[str, Any]]) -> dict[str, Any]:
    name_lines = [line for line in lines if _is_stock_name(line)]
    items: list[dict[str, Any]] = []

    for index, name_line in enumerate(name_lines):
        next_y = name_lines[index + 1]["y"] if index + 1 < len(name_lines) else 1900
        row_lines = [line for line in lines if name_line["y"] - 15 <= line["y"] < next_y - 10]
        qty_values = _numbers_in_column(row_lines, 650, 900)
        price_values = _numbers_in_column(row_lines, 930, 1180)

        item = {
            "stock_code": "",
            "stock_code_uncertain": True,
            "stock_name": name_line["text"],
            "quantity": qty_values[0] if qty_values else None,
            "cost_price": price_values[0] if price_values else None,
            "current_price": price_values[1] if len(price_values) > 1 else None,
            "market_value": _first_number(row_lines, 0, 320, min_y=name_line["y"] + 35),
            "profit_loss": _first_number(row_lines, 330, 620),
            "profit_loss_pct": None,
        }

        pct_candidates = [
            _to_number(line["text"])
            for line in row_lines
            if 330 <= line["x"] <= 620 and "%" in line["text"]
        ]
        item["profit_loss_pct"] = next((value for value in pct_candidates if value is not None), None)
        items.append(item)

    if not items:
        return {"error": "OCR 已识别文字，但未能按持仓页布局解析出持仓行", "ocr_lines": _ocr_payload(lines)}

    kw_assets = {
        "total_assets": _value_near_keyword(lines, ("总资产", "资产总值")),
        "market_value": _value_near_keyword(lines, ("持仓市值", "证券市值", "股票市值")),
        "cash_available": _value_near_keyword(lines, ("可用资金", "可用现金", "可取资金")),
        "daily_profit_loss": _value_near_keyword(lines, ("当日盈亏", "今日盈亏", "日盈亏", "当日参考盈亏")),
        "total_profit_loss": _value_near_keyword(lines, ("累计盈亏", "总盈亏", "历史盈亏")),
    }

    # Fallback to position-based if keyword matching fails (common with garbled OCR)
    if any(value is None for value in kw_assets.values()):
        pos = _extract_asset_by_position(lines)
        for key in kw_assets:
            if kw_assets[key] is None:
                kw_assets[key] = pos.get(key)

    result: dict[str, Any] = {
        "screenshot_type": "holdings",
        "snapshot_date": date.today().isoformat(),
        "items": items,
        "recognition_method": "windows_ocr",
        "ocr_lines": _ocr_payload(lines),
    }
    asset_fields = {k: v for k, v in kw_assets.items() if v is not None}
    if asset_fields:
        result["asset_fields"] = asset_fields
    return result


def _line_has_direction(line: dict[str, Any]) -> bool:
    return "买入" in line["text"] or "卖出" in line["text"]


def _candidate_stock_name(lines: list[dict[str, Any]]) -> str | None:
    ignored = {
        "成交",
        "委托",
        "买入",
        "卖出",
        "撤单",
        "成交价",
        "成交价格",
        "成交数量",
        "成交金额",
        "时间",
        "日期",
        "操作",
        "方向",
    }
    for line in sorted(lines, key=lambda row: (row["x"], row["y"])):
        text = line["text"]
        if text in ignored or any(keyword in text for keyword in ignored):
            continue
        if re.search(r"[\u4e00-\u9fff]", text) and not _is_date_or_time_text(text):
            return text
    return None


def _transaction_numbers(lines: list[dict[str, Any]]) -> list[tuple[float, float, str]]:
    values: list[tuple[float, float, str]] = []
    for line in lines:
        text = line["text"]
        if _is_date_or_time_text(text) or re.fullmatch(r"\d{6}", text):
            continue
        for number_text in re.findall(r"[-+]?\d[\d,]*(?:\.\d+)?", text):
            if re.fullmatch(r"\d{6}", number_text):
                continue
            value = _to_number(number_text)
            if value is not None:
                values.append((line["x"], value, text))
    return values


def _assign_transaction_numbers(values: list[tuple[float, float, str]]) -> tuple[float | None, float | None, float | None]:
    if not values:
        return None, None, None
    numeric_values = [value for _, value, _ in values]
    amount = max((value for value in numeric_values if abs(value) >= 1000), default=None)
    quantity = next(
        (
            value
            for _, value, text in values
            if value > 0
            and float(value).is_integer()
            and "." not in text
            and value != amount
            and value <= 1_000_000
        ),
        None,
    )
    price = next(
        (
            value
            for _, value, text in values
            if value != amount
            and value != quantity
            and abs(value) < 100_000
            and ("." in text or quantity is not None)
        ),
        None,
    )
    if price is None and amount is not None and quantity:
        price = round(amount / quantity, 4)

    if price is None or quantity is None or amount is None:
        by_x = [value for _, value, _ in sorted(values, key=lambda row: row[0])]
        if price is None and by_x:
            price = by_x[0]
        if quantity is None and len(by_x) > 1:
            quantity = by_x[1]
        if amount is None and len(by_x) > 2:
            amount = by_x[2]
    return price, quantity, amount


def _recognize_transactions(lines: list[dict[str, Any]]) -> dict[str, Any]:
    text = _joined_text(lines)
    fallback_date = _extract_date(text)
    direction_lines = [line for line in lines if _line_has_direction(line)]
    items: list[dict[str, Any]] = []

    for index, direction_line in enumerate(direction_lines):
        next_y = direction_lines[index + 1]["y"] if index + 1 < len(direction_lines) else direction_line["y"] + 140
        row_lines = [
            line
            for line in lines
            if direction_line["y"] - 35 <= line["y"] < next_y - 8
        ]
        row_text = " ".join(line["text"] for line in row_lines)
        direction = "buy" if "买入" in row_text else "sell"
        code_match = re.search(r"(?<!\d)(\d{6})(?!\d)", row_text)
        values = _transaction_numbers(row_lines)
        price, quantity, amount = _assign_transaction_numbers(values)

        items.append(
            {
                "trade_time": _normalize_trade_time(row_text, fallback_date),
                "stock_code": code_match.group(1) if code_match else "",
                "stock_code_uncertain": code_match is None,
                "stock_name": _candidate_stock_name(row_lines),
                "direction": direction,
                "price": price,
                "quantity": quantity,
                "amount": amount,
                "fee": None,
            }
        )

    if not items:
        return {"error": "OCR 已识别文字，但未能按成交页布局解析出成交记录", "ocr_lines": _ocr_payload(lines)}

    return {
        "screenshot_type": "transactions",
        "items": items,
        "recognition_method": "windows_ocr",
        "ocr_lines": _ocr_payload(lines),
    }


def _first_number_in_text(text: str) -> float | None:
    numbers = [_to_number(match) for match in re.findall(r"[-+]?\d[\d,]*(?:\.\d+)?", text)]
    numbers = [number for number in numbers if number is not None]
    return numbers[-1] if numbers else None


def _value_near_keyword(lines: list[dict[str, Any]], aliases: tuple[str, ...]) -> float | None:
    for line in lines:
        if not any(alias in line["text"] for alias in aliases):
            continue
        same_line_value = _first_number_in_text(line["text"])
        if same_line_value is not None:
            return same_line_value
        nearby = [
            candidate
            for candidate in lines
            if abs(candidate["y"] - line["y"]) <= 38
            and candidate["x"] >= line["x"]
            and _to_number(candidate["text"]) is not None
        ]
        if nearby:
            return _to_number(sorted(nearby, key=lambda row: row["x"])[-1]["text"])
        below = [
            candidate
            for candidate in lines
            if 0 < candidate["y"] - line["y"] <= 90
            and candidate["x"] >= line["x"] - 80
            and _to_number(candidate["text"]) is not None
        ]
        if below:
            return _to_number(sorted(below, key=lambda row: (row["y"], row["x"]))[0]["text"])
    return None


def _extract_asset_by_position(lines: list[dict[str, Any]]) -> dict[str, float | None]:
    """Extract asset fields by position when OCR text is garbled but numbers are correct.

    Typical layout of Chinese trading app asset summary:
      Row 1 (upper):   [total_assets]        [daily_profit_loss]
      Row 2 (lower):   [market_value]         [cash_available]

    We group numbers into two rows by y-coordinate, then validate via
    total_assets ≈ market_value + cash_available.
    """
    # Find holdings section start
    holding_start = 1900
    for line in lines:
        if line["y"] >= 1000 and line["x"] < 200:
            holding_start = min(holding_start, line["y"])

    # Collect all numbers in asset area, grouped by row
    rows: dict[int, list[tuple[float, float]]] = {}
    for line in lines:
        if line["y"] < 500 or line["y"] >= holding_start - 40:
            continue
        value = _to_number(line["text"])
        if value is None:
            continue
        # Find which row this belongs to (round y to nearest 100)
        row_key = int(line["y"] / 100)
        if row_key not in rows:
            rows[row_key] = []
        rows[row_key].append((line["x"], value))

    if len(rows) < 2:
        return {}

    sorted_rows = sorted(rows.items())

    # For each row, get left/middle/right values from the common three-column layout.
    parsed: list[dict[str, float | None]] = []
    for _key, entries in sorted_rows:
        left = sorted([v for x, v in entries if x < 350], key=lambda v: -abs(v))
        middle = sorted([v for x, v in entries if 350 <= x < 700], key=lambda v: -abs(v))
        right = sorted([v for x, v in entries if x >= 700], key=lambda v: -abs(v))
        parsed.append({
            "left": left[0] if left else None,
            "middle": middle[0] if middle else None,
            "right": right[0] if right else None,
        })

    # Find the best row pair: total = left_upper, mv = left_lower, cash = middle/right lower
    # Verify: total ≈ market_value + cash_available
    best: dict[str, float | None] = {}
    for i in range(len(parsed)):
        for j in range(i + 1, len(parsed)):
            upper = parsed[i]
            lower = parsed[j]
            total = upper["left"]
            mv = lower["left"]
            cash = lower["middle"] if lower["middle"] is not None else lower["right"]
            total_profit_loss = upper["middle"] if upper["right"] is not None else None
            daily_profit_loss = upper["right"] if upper["right"] is not None else upper["middle"]
            if total is None or mv is None or cash is None:
                # Try: total on upper-left, mv on upper-right, cash on lower-*
                upper_cash = upper["middle"] if upper["middle"] is not None else upper["right"]
                if upper["left"] is not None and upper_cash is not None and lower["left"] is not None:
                    if abs(upper_cash + lower["left"] - upper["left"]) / max(upper["left"], 1) < 0.02:
                        best = {"total_assets": upper["left"], "market_value": lower["left"],
                                "cash_available": upper_cash,
                                "daily_profit_loss": lower["right"] if lower["right"] is not None else lower["middle"]}
                        return best
                continue

            if abs(total - mv - cash) / max(total, 1) < 0.02:
                best = {"total_assets": total, "market_value": mv, "cash_available": cash,
                        "daily_profit_loss": daily_profit_loss,
                        "total_profit_loss": total_profit_loss}
                return best
            # Alternative: cash might be 0 or very small, so compute it
            if abs(total - mv) / max(total, 1) < 0.5:
                best = {"total_assets": total, "market_value": mv,
                        "cash_available": round(total - mv, 2),
                        "daily_profit_loss": daily_profit_loss,
                        "total_profit_loss": total_profit_loss}
                return best

    # Last fallback: use the first row's left as total, second row's left as mv
    for p in parsed:
        if p["left"] is None:
            continue
        if "total_assets" not in best:
            best["total_assets"] = p["left"]
            best["daily_profit_loss"] = p["right"] if p["right"] is not None else p["middle"]
            if p["right"] is not None:
                best["total_profit_loss"] = p["middle"]
        elif "market_value" not in best:
            best["market_value"] = p["left"]
            best["cash_available"] = p["middle"] if p["middle"] is not None else p["right"]
            if best.get("total_assets") and best["market_value"]:
                best["cash_available"] = round(best["total_assets"] - best["market_value"], 2)
            return best

    return best


def _recognize_assets(lines: list[dict[str, Any]]) -> dict[str, Any]:
    text = _joined_text(lines)
    total_assets = _value_near_keyword(lines, ("总资产", "资产总值"))
    market_value = _value_near_keyword(lines, ("持仓市值", "证券市值", "股票市值", "市值"))
    cash_available = _value_near_keyword(lines, ("可用资金", "可用现金", "可取资金"))
    daily_profit_loss = _value_near_keyword(lines, ("当日盈亏", "今日盈亏", "日盈亏", "当日参考盈亏"))
    total_profit_loss = _value_near_keyword(lines, ("累计盈亏", "总盈亏", "历史盈亏"))

    if any(value is None for value in (total_assets, market_value, cash_available, daily_profit_loss, total_profit_loss)):
        pos = _extract_asset_by_position(lines)
        if total_assets is None:
            total_assets = pos.get("total_assets")
        if market_value is None:
            market_value = pos.get("market_value")
        if cash_available is None:
            cash_available = pos.get("cash_available")
        if daily_profit_loss is None:
            daily_profit_loss = pos.get("daily_profit_loss")
        if total_profit_loss is None:
            total_profit_loss = pos.get("total_profit_loss")

    result: dict[str, Any] = {
        "screenshot_type": "assets",
        "snapshot_date": _extract_date(text).isoformat(),
        "total_assets": total_assets,
        "market_value": market_value,
        "cash_available": cash_available,
        "daily_profit_loss": daily_profit_loss,
        "total_profit_loss": total_profit_loss,
        "recognition_method": "windows_ocr",
        "ocr_lines": _ocr_payload(lines),
    }
    if total_assets is not None and market_value is not None and cash_available is not None:
        difference = round(total_assets - market_value - cash_available, 2)
        result["asset_check_difference"] = difference
        if abs(difference) > 1:
            result["asset_check_warning"] = f"总资产与持仓市值+可用现金差额为 {difference:.2f} 元，请检查识别结果。"

    if total_assets is None and market_value is None and cash_available is None:
        return {"error": "OCR 已识别文字，但未能按资产页布局解析出资产字段", "ocr_lines": _ocr_payload(lines)}
    return result


def recognize_screenshot_by_ocr(image_path: str, hint_type: str | None = None) -> dict[str, Any]:
    """
    Recognize Tonghuashun screenshots with local Windows OCR.

    Stage 2 supports automatic type detection for holdings, transactions, and
    assets pages. This does not call any AI service.
    """

    try:
        lines = _ocr_lines(image_path)
    except AssertionError:
        return {"error": "本机未安装中文 OCR 语言包，无法使用 Windows 本地 OCR"}
    except Exception as exc:
        return {"error": f"本地 OCR 识别失败：{exc}"}

    screenshot_type = _detect_screenshot_type(lines)
    if screenshot_type == "holdings":
        return _recognize_holdings(lines)
    if screenshot_type == "transactions":
        return _recognize_transactions(lines)
    if screenshot_type == "assets":
        return _recognize_assets(lines)

    return {
        "error": "无法识别截图类型，请检查是否为同花顺截图",
        "recognition_method": "windows_ocr",
        "ocr_lines": _ocr_payload(lines),
    }
