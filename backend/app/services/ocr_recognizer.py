import re
from datetime import date
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
    cleaned = cleaned.replace("+", "").replace("%", "")
    cleaned = re.sub(r"[^0-9,.\-]", "", cleaned)
    cleaned = cleaned.replace(",", "")
    if cleaned in {"", "-", ".", "-."}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


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


def recognize_screenshot_by_ocr(image_path: str, hint_type: str | None = None) -> dict[str, Any]:
    """
    Recognize a Tonghuashun holdings screenshot with local Windows OCR.

    This does not call any AI service. Stock codes are left blank because the
    holdings screenshot layout usually shows names but not codes.
    """

    try:
        lines = _ocr_lines(image_path)
    except AssertionError:
        return {"error": "本机未安装中文 OCR 语言包，无法使用 Windows 本地 OCR"}
    except Exception as exc:
        return {"error": f"本地 OCR 识别失败：{exc}"}

    if not any("持仓股" in line["text"] or line["text"] == "持仓" for line in lines):
        return {"error": "未识别到同花顺持仓页"}

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
        return {"error": "OCR 已识别文字，但未能按持仓页布局解析出持仓行", "ocr_lines": lines}

    return {
        "screenshot_type": "holdings",
        "snapshot_date": date.today().isoformat(),
        "items": items,
        "recognition_method": "windows_ocr",
        "ocr_lines": [{"text": line["text"], "x": line["x"], "y": line["y"]} for line in lines],
    }
