"""Fix holdings with obviously wrong current prices.

The script uses the same rule as the backend: when current_price is clearly
inconsistent with market_value / quantity, replace it with the inferred price.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "stocktracker.db"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.holding_normalizer import infer_current_price, should_correct_current_price  # noqa: E402


def fix_database(db_path: Path) -> list[sqlite3.Row]:
    """Correct bad holding current prices and return changed rows."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    changed_rows: list[sqlite3.Row] = []
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT id, stock_code, stock_name, quantity, current_price, market_value
            FROM holdings
            WHERE quantity IS NOT NULL
              AND market_value IS NOT NULL
            ORDER BY id
            """
        ).fetchall()

        for row in rows:
            inferred_price = infer_current_price(row["quantity"], row["market_value"])
            if not should_correct_current_price(row["current_price"], inferred_price):
                continue
            connection.execute(
                "UPDATE holdings SET current_price = ? WHERE id = ?",
                (float(inferred_price), row["id"]),
            )
            changed_rows.append(row)

        connection.commit()

    return changed_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Fix obviously wrong holding prices.")
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path. Default: {DEFAULT_DB_PATH}",
    )
    args = parser.parse_args()

    changed_rows = fix_database(args.db)
    print(f"fixed_holdings: {len(changed_rows)}")
    for row in changed_rows:
        inferred_price = infer_current_price(row["quantity"], row["market_value"])
        print(
            "id={id} code={code} name={name} old={old} new={new}".format(
                id=row["id"],
                code=row["stock_code"],
                name=row["stock_name"] or "",
                old=row["current_price"],
                new=inferred_price,
            )
        )


if __name__ == "__main__":
    main()
