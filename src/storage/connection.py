from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from src.domain.errors import VariableStorageError

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


@contextmanager
def sqlite_connection(db_path: str | Path) -> Iterator[sqlite3.Connection]:
    path = Path(db_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(str(path))
    connection.row_factory = sqlite3.Row
    _configure_connection(connection)

    try:
        yield connection
        connection.commit()
    except sqlite3.Error as exc:
        connection.rollback()
        raise VariableStorageError(f"SQLite operation failed: {exc}") from exc
    finally:
        connection.close()


def initialize_database(db_path: str | Path) -> Path:
    path = Path(db_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

    with sqlite_connection(path) as connection:
        connection.executescript(schema_sql)

    return path


def _configure_connection(connection: sqlite3.Connection) -> None:
    _try_execute_pragma(connection, "PRAGMA busy_timeout=5000;")
    _try_execute_pragma(connection, "PRAGMA journal_mode=WAL;")
    _try_execute_pragma(connection, "PRAGMA synchronous=NORMAL;")


def _try_execute_pragma(connection: sqlite3.Connection, statement: str) -> None:
    try:
        connection.execute(statement)
    except sqlite3.OperationalError:
        # Some local paths reject PRAGMA changes; keep SQLite defaults instead of failing server startup.
        return
