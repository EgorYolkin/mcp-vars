from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from src.domain.models import JSONValue, VariableRecord, VariableSetItem
from src.storage.store import VariableStore


class LazyVariableStore:
    def __init__(self, factory: Callable[[], VariableStore]) -> None:
        self._factory = factory
        self._store: VariableStore | None = None

    def get(self, key: str) -> VariableRecord | None:
        return self._get_store().get(key)

    def set(
        self,
        key: str,
        value: JSONValue,
        expires_at: datetime | None = None,
    ) -> VariableRecord:
        return self._get_store().set(key, value, expires_at=expires_at)

    def delete(self, key: str) -> VariableRecord | None:
        return self._get_store().delete(key)

    def list(self, prefix: str | None = None) -> list[VariableRecord]:
        return self._get_store().list(prefix=prefix)

    def bulk_set(self, items: list[VariableSetItem]) -> list[VariableRecord]:
        return self._get_store().bulk_set(items)

    def bulk_delete(self, keys: list[str]) -> list[str]:
        return self._get_store().bulk_delete(keys)

    def export_snapshot(self) -> dict[str, JSONValue]:
        return self._get_store().export_snapshot()

    def import_snapshot(self, data: dict[str, JSONValue]) -> dict[str, JSONValue]:
        return self._get_store().import_snapshot(data)

    def _get_store(self) -> VariableStore:
        if self._store is None:
            self._store = self._factory()
        return self._store
