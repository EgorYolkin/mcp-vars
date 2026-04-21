import sqlite3

from mcp_vars.storage.connection import _configure_connection


class FakeConnection:
    def __init__(self) -> None:
        self.statements: list[str] = []

    def execute(self, statement: str):  # type: ignore[no-untyped-def]
        self.statements.append(statement)
        if statement == "PRAGMA journal_mode=WAL;":
            raise sqlite3.OperationalError("unable to open database file")
        return None


def test_configure_connection_falls_back_when_wal_is_unavailable() -> None:
    connection = FakeConnection()

    _configure_connection(connection)  # type: ignore[arg-type]

    assert connection.statements == [
        "PRAGMA busy_timeout=5000;",
        "PRAGMA journal_mode=WAL;",
        "PRAGMA synchronous=NORMAL;",
    ]
