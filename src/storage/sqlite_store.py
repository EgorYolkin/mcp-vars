from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from src.domain.models import JSONValue, VariableRecord, VariableSetItem
from src.storage.connection import initialize_database, sqlite_connection


class SQLiteVariableStore:
    def __init__(self, db_path: str | Path) -> None:
        self._db_path = initialize_database(db_path)

    @property
    def db_path(self) -> Path:
        return self._db_path

    def get(self, key: str) -> VariableRecord | None:
        with sqlite_connection(self._db_path) as connection:
            row = connection.execute(
                """
                SELECT key, value_json, expires_at, created_at, updated_at
                FROM variables
                WHERE key = ?
                """,
                (key,),
            ).fetchone()

        return None if row is None else _row_to_record(row)

    def set(
        self,
        key: str,
        value: JSONValue,
        expires_at: datetime | None = None,
    ) -> VariableRecord:
        now = datetime.now().astimezone().isoformat()
        encoded_value = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
        encoded_expires_at = expires_at.isoformat() if expires_at is not None else None

        with sqlite_connection(self._db_path) as connection:
            existing = connection.execute(
                "SELECT created_at FROM variables WHERE key = ?",
                (key,),
            ).fetchone()
            created_at = existing["created_at"] if existing is not None else now

            connection.execute(
                """
                INSERT INTO variables(key, value_json, expires_at, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value_json = excluded.value_json,
                    expires_at = excluded.expires_at,
                    updated_at = excluded.updated_at
                """,
                (key, encoded_value, encoded_expires_at, created_at, now),
            )
            row = connection.execute(
                """
                SELECT key, value_json, expires_at, created_at, updated_at
                FROM variables
                WHERE key = ?
                """,
                (key,),
            ).fetchone()

        return _row_to_record(row)

    def delete(self, key: str) -> VariableRecord | None:
        existing = self.get(key)
        if existing is None:
            return None

        with sqlite_connection(self._db_path) as connection:
            connection.execute("DELETE FROM variables WHERE key = ?", (key,))

        return existing

    def list(self, prefix: str | None = None) -> list[VariableRecord]:
        query = """
            SELECT key, value_json, expires_at, created_at, updated_at
            FROM variables
            WHERE 1 = 1
        """
        params: list[str] = []

        if prefix:
            query += " AND key LIKE ?"
            params.append(f"{prefix}%")

        query += " ORDER BY key ASC"

        with sqlite_connection(self._db_path) as connection:
            rows = connection.execute(query, tuple(params)).fetchall()

        return [_row_to_record(row) for row in rows]

    def bulk_set(self, items: list[VariableSetItem]) -> list[VariableRecord]:
        records: list[VariableRecord] = []
        for item in items:
            records.append(self.set(item.key, item.value, expires_at=item.expires_at))
        return records

    def bulk_delete(self, keys: list[str]) -> list[str]:
        deleted_keys: list[str] = []
        for key in keys:
            deleted = self.delete(key)
            if deleted is not None:
                deleted_keys.append(key)
        return deleted_keys

    def export_snapshot(self) -> dict[str, JSONValue]:
        return {record.key: record.value for record in self.list()}

    def import_snapshot(self, data: dict[str, JSONValue]) -> dict[str, JSONValue]:
        with sqlite_connection(self._db_path) as connection:
            connection.execute("DELETE FROM variables")

        items = [VariableSetItem(key=key, value=value) for key, value in data.items()]
        self.bulk_set(items)
        return self.export_snapshot()


def _row_to_record(row: object) -> VariableRecord:
    key = row["key"]
    value_json = row["value_json"]
    expires_at = row["expires_at"]
    created_at = row["created_at"]
    updated_at = row["updated_at"]

    return VariableRecord(
        key=key,
        value=json.loads(value_json),
        expires_at=datetime.fromisoformat(expires_at) if expires_at else None,
        created_at=datetime.fromisoformat(created_at) if created_at else None,
        updated_at=datetime.fromisoformat(updated_at) if updated_at else None,
    )
