from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from datetime import datetime

from mcp_vars.domain.errors import VariableValidationError
from mcp_vars.domain.models import JSONValue, StorageScope

KEY_PATTERN = re.compile(r"^[a-z0-9._-]+$")
VALID_SCOPES = {"project", "user"}


def validate_scope(scope: str | None) -> StorageScope:
    resolved = scope or "project"
    if resolved not in VALID_SCOPES:
        raise VariableValidationError(
            f"Invalid scope '{resolved}'. Use 'project' or 'user'."
        )
    return resolved  # type: ignore[return-value]


def validate_key(key: str) -> str:
    if not key:
        raise VariableValidationError("Key must not be empty.")
    if not KEY_PATTERN.fullmatch(key):
        raise VariableValidationError(
            "Key must match pattern [a-z0-9._-] and use dot-notation only."
        )
    return key


def validate_json_value(value: JSONValue) -> JSONValue:
    if _is_json_native(value):
        return value
    raise VariableValidationError(
        "Value must use JSON-native types only: string, number, boolean, null, array, object."
    )


def validate_expires_at(expires_at: datetime | None) -> datetime | None:
    if expires_at is None:
        return None
    if expires_at.tzinfo is None:
        raise VariableValidationError("expires_at must be timezone-aware.")
    return expires_at


def ensure_object_value(value: JSONValue, *, operation: str) -> dict[str, JSONValue]:
    if not isinstance(value, dict):
        raise VariableValidationError(f"{operation} requires the current value to be an object.")
    return value


def shallow_merge(
    current: dict[str, JSONValue], patch: dict[str, JSONValue]
) -> dict[str, JSONValue]:
    validate_json_value(patch)
    return {**current, **patch}


def _is_json_native(value: object) -> bool:
    if value is None or isinstance(value, (str, int, float, bool)):
        return True
    if isinstance(value, Mapping):
        return all(isinstance(key, str) and _is_json_native(item) for key, item in value.items())
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return all(_is_json_native(item) for item in value)
    return False
