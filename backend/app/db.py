from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

if settings.database_url.startswith("sqlite:///"):
    db_path = settings.database_url.replace("sqlite:///", "", 1)
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import assets, holdings, notes, screenshots, transactions  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_account_columns()


def _ensure_account_columns() -> None:
    inspector = inspect(engine)
    table_columns = {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in inspector.get_table_names()
    }
    migrations = {
        "notes": [
            ("title", "VARCHAR NOT NULL DEFAULT ''"),
        ],
        "screenshots": [
            ("account_id", "VARCHAR NOT NULL DEFAULT 'account_1'"),
            ("account_name", "VARCHAR NOT NULL DEFAULT 'Account 1'"),
        ],
        "holdings": [
            ("account_id", "VARCHAR NOT NULL DEFAULT 'account_1'"),
            ("account_name", "VARCHAR NOT NULL DEFAULT 'Account 1'"),
        ],
        "transactions": [
            ("account_id", "VARCHAR NOT NULL DEFAULT 'account_1'"),
            ("account_name", "VARCHAR NOT NULL DEFAULT 'Account 1'"),
        ],
        "assets_daily": [
            ("account_id", "VARCHAR NOT NULL DEFAULT 'account_1'"),
            ("account_name", "VARCHAR NOT NULL DEFAULT 'Account 1'"),
        ],
    }
    with engine.begin() as connection:
        for table_name, columns in migrations.items():
            existing = table_columns.get(table_name, set())
            for column_name, ddl in columns:
                if column_name not in existing:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))
        if "assets_daily" in table_columns:
            index_rows = connection.execute(text("PRAGMA index_list(assets_daily)")).fetchall()
            for index_row in index_rows:
                index_name = index_row[1]
                is_unique = bool(index_row[2])
                if index_name == "ix_assets_daily_snapshot_date" and is_unique:
                    connection.execute(text("DROP INDEX ix_assets_daily_snapshot_date"))
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_assets_daily_snapshot_date "
                    "ON assets_daily (snapshot_date)"
                )
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_daily_account_date "
                    "ON assets_daily (account_id, snapshot_date)"
                )
            )
