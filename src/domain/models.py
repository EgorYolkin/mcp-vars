from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, Field
from typing_extensions import TypeAliasType

JSONPrimitive: TypeAlias = str | int | float | bool | None
JSONValue = TypeAliasType(
    "JSONValue",
    JSONPrimitive | list["JSONValue"] | dict[str, "JSONValue"],
)
StorageScope: TypeAlias = Literal["project", "user"]
ToolStatus: TypeAlias = Literal["ok", "not_found", "error"]


class ToolResponse(BaseModel):
    status: ToolStatus
    key: str | None = None
    value: Any = None
    message: str
    scope: StorageScope | None = None


class InitializationResult(BaseModel):
    scope: StorageScope
    db_path: str
    created: bool
    message: str


class VariableRecord(BaseModel):
    key: str
    value: JSONValue
    expires_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class VariableSetItem(BaseModel):
    scope: StorageScope = "project"
    key: str
    value: JSONValue
    expires_at: datetime | None = None


class VariableDeleteItem(BaseModel):
    scope: StorageScope = "project"
    key: str


class VariableListItem(BaseModel):
    key: str
    value: JSONValue | None = None


class VariableListResult(BaseModel):
    scope: StorageScope
    items: list[VariableListItem] = Field(default_factory=list)


class SnapshotData(BaseModel):
    project: dict[str, JSONValue] = Field(default_factory=dict)
    user: dict[str, JSONValue] = Field(default_factory=dict)
