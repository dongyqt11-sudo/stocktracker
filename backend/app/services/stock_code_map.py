"""Local stock name to code mapping for OCR-assisted holdings imports."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import BACKEND_DIR


MAP_PATH = BACKEND_DIR / "data" / "stock_code_map.json"


def is_valid_stock_code(value: object) -> bool:
    """Return True when value is an A-share-style six-digit code."""
    return isinstance(value, str) and len(value) == 6 and value.isdigit()


def normalize_stock_name(value: object) -> str:
    """Normalize stock names for local lookup."""
    return str(value or "").strip()


def load_stock_code_map(path: Path = MAP_PATH) -> dict[str, str]:
    """Load the local stock name-code mapping file."""
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {
        normalize_stock_name(name): str(code).strip()
        for name, code in data.items()
        if normalize_stock_name(name) and is_valid_stock_code(str(code).strip())
    }


def save_stock_code_map(mapping: dict[str, str], path: Path = MAP_PATH) -> None:
    """Persist the local stock name-code mapping file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    clean_mapping = {
        normalize_stock_name(name): code
        for name, code in sorted(mapping.items())
        if normalize_stock_name(name) and is_valid_stock_code(code)
    }
    path.write_text(
        json.dumps(clean_mapping, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def apply_stock_code_suggestions(
    recognized_data: dict[str, Any],
    mapping: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Fill missing stock codes from previously confirmed local mappings."""
    mapping = mapping if mapping is not None else load_stock_code_map()
    items = recognized_data.get("items")
    if not isinstance(items, list) or not mapping:
        return recognized_data

    suggested = 0
    for item in items:
        if not isinstance(item, dict):
            continue
        current_code = str(item.get("stock_code") or "").strip()
        stock_name = normalize_stock_name(item.get("stock_name"))
        suggestion = mapping.get(stock_name)
        if current_code or not suggestion:
            continue
        item["stock_code"] = suggestion
        item["stock_code_suggested"] = True
        item["stock_code_source"] = "local_map"
        item["stock_code_uncertain"] = False
        suggested += 1

    if suggested:
        recognized_data["stock_code_suggestions_applied"] = suggested
    return recognized_data


def update_stock_code_map_from_items(items: list[Any]) -> int:
    """Update the mapping from confirmed holdings rows and return changes."""
    mapping = load_stock_code_map()
    changed = 0

    for item in items:
        data = item.model_dump() if hasattr(item, "model_dump") else item
        if not isinstance(data, dict):
            continue
        stock_name = normalize_stock_name(data.get("stock_name"))
        stock_code = str(data.get("stock_code") or "").strip()
        if not stock_name or not is_valid_stock_code(stock_code):
            continue
        if mapping.get(stock_name) != stock_code:
            mapping[stock_name] = stock_code
            changed += 1

    if changed:
        save_stock_code_map(mapping)
    return changed
