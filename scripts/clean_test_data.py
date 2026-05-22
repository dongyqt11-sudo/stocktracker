"""Clean placeholder holdings and their related upload records.

The MVP OCR flow originally allowed placeholder stock codes such as 11111 or
2222. A-share stock codes must be exactly six digits, so this script removes
invalid holding batches and their linked screenshots/transactions.
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "backend" / "data" / "stocktracker.db"


def is_valid_a_share_code(value: object) -> bool:
    """Return True when value is exactly six numeric digits."""
    return isinstance(value, str) and len(value) == 6 and value.isdigit()


def clean_database(db_path: Path) -> dict[str, int]:
    """Delete invalid holding rows and linked screenshots/transactions."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        holdings = connection.execute(
            "SELECT id, stock_code, screenshot_id FROM holdings"
        ).fetchall()
        dirty_holding_ids = [
            row["id"] for row in holdings if not is_valid_a_share_code(row["stock_code"])
        ]
        screenshot_ids = sorted(
            {
                row["screenshot_id"]
                for row in holdings
                if row["id"] in dirty_holding_ids and row["screenshot_id"] is not None
            }
        )

        if not dirty_holding_ids:
            return {
                "dirty_holdings_found": 0,
                "holdings_deleted": 0,
                "transactions_deleted": 0,
                "screenshots_deleted": 0,
            }

        cursor = connection.cursor()

        holdings_deleted = 0
        transactions_deleted = 0
        screenshots_deleted = 0

        if screenshot_ids:
            placeholders = ",".join("?" for _ in screenshot_ids)
            cursor.execute(
                f"DELETE FROM holdings WHERE screenshot_id IN ({placeholders})",
                screenshot_ids,
            )
            holdings_deleted = cursor.rowcount

            cursor.execute(
                f"DELETE FROM transactions WHERE screenshot_id IN ({placeholders})",
                screenshot_ids,
            )
            transactions_deleted = cursor.rowcount

            cursor.execute(
                f"DELETE FROM screenshots WHERE id IN ({placeholders})",
                screenshot_ids,
            )
            screenshots_deleted = cursor.rowcount
        else:
            placeholders = ",".join("?" for _ in dirty_holding_ids)
            cursor.execute(
                f"DELETE FROM holdings WHERE id IN ({placeholders})",
                dirty_holding_ids,
            )
            holdings_deleted = cursor.rowcount

        connection.commit()

    return {
        "dirty_holdings_found": len(dirty_holding_ids),
        "holdings_deleted": holdings_deleted,
        "transactions_deleted": transactions_deleted,
        "screenshots_deleted": screenshots_deleted,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean invalid StockTracker test data.")
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path. Default: {DEFAULT_DB_PATH}",
    )
    args = parser.parse_args()

    result = clean_database(args.db)
    for key, value in result.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
