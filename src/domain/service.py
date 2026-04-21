from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from src.domain.errors import VariableError, VariableValidationError
from src.domain.models import (
    JSONValue,
    SnapshotData,
    StorageScope,
    ToolResponse,
    VariableDeleteItem,
    VariableListItem,
    VariableListResult,
    VariableSetItem,
)
from src.domain.validation import (
    ensure_object_value,
    shallow_merge,
    validate_expires_at,
    validate_json_value,
    validate_key,
    validate_scope,
)
from src.storage.store import VariableStore


@dataclass(frozen=True)
class ScopedStores:
    user: VariableStore
    project: VariableStore | None = None


class VariableService:
    def __init__(self, stores: ScopedStores) -> None:
        self._stores = stores

    def get(self, key: str, scope: str | None = None) -> ToolResponse:
        resolved_scope, resolved_key = self._validate_identity(scope, key)
        try:
            record = self._store_for(resolved_scope).get(resolved_key)
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(resolved_key, resolved_scope, exc)

        if record is None:
            return ToolResponse(
                status="not_found",
                key=resolved_key,
                value=None,
                scope=resolved_scope,
                message=f"Variable '{resolved_key}' was not found in scope '{resolved_scope}'.",
            )

        return ToolResponse(
            status="ok",
            key=resolved_key,
            value=record.value,
            scope=resolved_scope,
            message=f"Loaded variable '{resolved_key}'.",
        )

    def set(
        self,
        key: str,
        value: JSONValue,
        scope: str | None = None,
        expires_at: Any = None,
    ) -> ToolResponse:
        resolved_scope, resolved_key = self._validate_identity(scope, key)
        resolved_value = validate_json_value(value)
        resolved_expires_at = validate_expires_at(expires_at)

        try:
            record = self._store_for(resolved_scope).set(
                resolved_key,
                resolved_value,
                expires_at=resolved_expires_at,
            )
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(resolved_key, resolved_scope, exc)

        return ToolResponse(
            status="ok",
            key=resolved_key,
            value=record.value,
            scope=resolved_scope,
            message=f"Stored variable '{resolved_key}'.",
        )

    def patch(
        self,
        key: str,
        patch: dict[str, JSONValue],
        scope: str | None = None,
    ) -> ToolResponse:
        resolved_scope, resolved_key = self._validate_identity(scope, key)
        resolved_patch = ensure_object_value(validate_json_value(patch), operation="patch")

        try:
            store = self._store_for(resolved_scope)
            current = store.get(resolved_key)
            if current is None:
                return ToolResponse(
                    status="not_found",
                    key=resolved_key,
                    value=None,
                    scope=resolved_scope,
                    message=f"Variable '{resolved_key}' was not found in scope '{resolved_scope}'.",
                )

            current_value = ensure_object_value(current.value, operation="patch")
            merged_value = shallow_merge(current_value, resolved_patch)
            updated = store.set(
                resolved_key,
                merged_value,
                expires_at=current.expires_at,
            )
        except VariableValidationError as exc:
            return ToolResponse(
                status="error",
                key=resolved_key,
                value=None,
                scope=resolved_scope,
                message=str(exc),
            )
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(resolved_key, resolved_scope, exc)

        return ToolResponse(
            status="ok",
            key=resolved_key,
            value=updated.value,
            scope=resolved_scope,
            message=f"Patched variable '{resolved_key}'.",
        )

    def delete(self, key: str, scope: str | None = None) -> ToolResponse:
        resolved_scope, resolved_key = self._validate_identity(scope, key)
        try:
            deleted = self._store_for(resolved_scope).delete(resolved_key)
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(resolved_key, resolved_scope, exc)

        if deleted is None:
            return ToolResponse(
                status="not_found",
                key=resolved_key,
                value=None,
                scope=resolved_scope,
                message=f"Variable '{resolved_key}' was not found in scope '{resolved_scope}'.",
            )

        return ToolResponse(
            status="ok",
            key=resolved_key,
            value=None,
            scope=resolved_scope,
            message=f"Deleted variable '{resolved_key}'.",
        )

    def list(self, scope: str | None = None, prefix: str | None = None) -> ToolResponse:
        resolved_scope = validate_scope(scope)
        resolved_prefix = validate_key(prefix) if prefix else None

        try:
            records = self._store_for(resolved_scope).list(prefix=resolved_prefix)
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(resolved_prefix, resolved_scope, exc)

        payload = VariableListResult(
            scope=resolved_scope,
            items=[VariableListItem(key=record.key, value=record.value) for record in records],
        )
        return ToolResponse(
            status="ok",
            key=resolved_prefix,
            value=payload.model_dump(mode="json"),
            scope=resolved_scope,
            message=f"Listed {len(records)} variable(s) in scope '{resolved_scope}'.",
        )

    def bulk_set(self, items: list[VariableSetItem]) -> ToolResponse:
        grouped_items: dict[StorageScope, list[VariableSetItem]] = {"project": [], "user": []}
        for item in items:
            validated_item = VariableSetItem(
                scope=validate_scope(item.scope),
                key=validate_key(item.key),
                value=validate_json_value(item.value),
                expires_at=validate_expires_at(item.expires_at),
            )
            grouped_items[validated_item.scope].append(validated_item)

        try:
            records = []
            for scope_name, scoped_items in grouped_items.items():
                if scoped_items:
                    records.extend(self._store_for(scope_name).bulk_set(scoped_items))
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(None, None, exc)

        return ToolResponse(
            status="ok",
            key=None,
            value=[record.model_dump(mode="json") for record in records],
            message=f"Stored {len(records)} variable(s).",
        )

    def bulk_delete(self, items: list[VariableDeleteItem]) -> ToolResponse:
        grouped_keys: dict[StorageScope, list[str]] = {"project": [], "user": []}
        for item in items:
            validated_item = VariableDeleteItem(
                scope=validate_scope(item.scope),
                key=validate_key(item.key),
            )
            grouped_keys[validated_item.scope].append(validated_item.key)

        try:
            deleted_keys = []
            for scope_name, scoped_keys in grouped_keys.items():
                if scoped_keys:
                    deleted_keys.extend(self._store_for(scope_name).bulk_delete(scoped_keys))
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(None, None, exc)

        return ToolResponse(
            status="ok",
            key=None,
            value=deleted_keys,
            message=f"Deleted {len(deleted_keys)} variable(s).",
        )

    def export_snapshot(self) -> ToolResponse:
        try:
            snapshot = SnapshotData(
                project=self._store_for("project").export_snapshot() if self._stores.project else {},
                user=self._store_for("user").export_snapshot(),
            )
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(None, None, exc)

        return ToolResponse(
            status="ok",
            key=None,
            value=snapshot.model_dump(mode="json"),
            message="Exported snapshot.",
        )

    def import_snapshot(self, data: SnapshotData) -> ToolResponse:
        try:
            project_snapshot = (
                self._store_for("project").import_snapshot(data.project)
                if self._stores.project
                else {}
            )
            user_snapshot = self._store_for("user").import_snapshot(data.user)
            snapshot = SnapshotData(project=project_snapshot, user=user_snapshot)
        except Exception as exc:  # pragma: no cover - defensive wrapper
            return self._error_response(None, None, exc)

        return ToolResponse(
            status="ok",
            key=None,
            value=snapshot.model_dump(mode="json"),
            message="Imported snapshot.",
        )

    def _validate_identity(self, scope: str | None, key: str) -> tuple[StorageScope, str]:
        return validate_scope(scope), validate_key(key)

    def _store_for(self, scope: StorageScope) -> VariableStore:
        if scope == "project":
            if self._stores.project is None:
                raise VariableValidationError(
                    "Project scope is not initialized. Run project initialization first."
                )
            return self._stores.project
        return self._stores.user

    def _error_response(
        self,
        key: str | None,
        scope: StorageScope | None,
        exc: Exception,
    ) -> ToolResponse:
        if isinstance(exc, VariableValidationError):
            return ToolResponse(status="error", key=key, value=None, scope=scope, message=str(exc))
        if isinstance(exc, VariableError):
            return ToolResponse(status="error", key=key, value=None, scope=scope, message=str(exc))
        return ToolResponse(
            status="error",
            key=key,
            value=None,
            scope=scope,
            message=f"Unexpected storage error: {exc}",
        )
