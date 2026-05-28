from app.services.ocr_recognizer import _extract_asset_by_position, _to_number


def test_to_number_splits_joined_profit_and_percent() -> None:
    assert _to_number("72Z931.89%") == 727.93
    assert _to_number("+727.931.89%") == 727.93


def test_extract_asset_by_position_reads_three_column_holding_summary() -> None:
    lines = [
        {"text": "总资产O", "x": 50.0, "y": 573.0},
        {"text": "总盈亏", "x": 421.0, "y": 573.0},
        {"text": "当日参考盈亏O", "x": 784.0, "y": 571.0},
        {"text": "39,287.12", "x": 50.0, "y": 648.0},
        {"text": "+5,937.63", "x": 416.0, "y": 648.0},
        {"text": "72Z931.89%", "x": 782.0, "y": 648.0},
        {"text": "总市值", "x": 50.0, "y": 774.0},
        {"text": "可用逆回购", "x": 416.0, "y": 775.0},
        {"text": "可取转账", "x": 782.0, "y": 776.0},
        {"text": "20,049.80", "x": 50.0, "y": 850.0},
        {"text": "19,237.32", "x": 416.0, "y": 850.0},
        {"text": "19,237.32", "x": 782.0, "y": 850.0},
        {"text": "持仓股", "x": 48.0, "y": 1012.0},
    ]

    assert _extract_asset_by_position(lines) == {
        "total_assets": 39287.12,
        "market_value": 20049.8,
        "cash_available": 19237.32,
        "daily_profit_loss": 727.93,
        "total_profit_loss": 5937.63,
    }
