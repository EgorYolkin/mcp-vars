from __future__ import annotations

from datetime import datetime
from typing import Protocol

from src.domain.models import (
    InitializationResult,
    JSONValue,
    SnapshotData,
    VariableRecord,
    VariableSetItem,
)


class VariableStore(Protocol):
    def get(self, key: str) -> VariableRecord | None: ...

    def set(
        self,
        key: str,
        value: JSONValue,
        expires_at: datetime | None = None,
    ) -> VariableRecord: ...

    def delete(self, key: str) -> VariableRecord | None: ...

    def list(self, prefix: str | None = None) -> list[VariableRecord]: ...

    def bulk_set(self, items: list[VariableSetItem]) -> list[VariableRecord]: ...

    def bulk_delete(self, keys: list[str]) -> list[str]: ...

    def export_snapshot(self) -> dict[str, JSONValue]: ...

    def import_snapshot(self, data: dict[str, JSONValue]) -> dict[str, JSONValue]: ...


class StorageInitializer(Protocol):
    def initialize_user_storage(self) -> InitializationResult: ...

    def initialize_project_storage(self, project_root: str | None = None) -> InitializationResult: ...
