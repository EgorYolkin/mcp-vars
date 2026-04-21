from __future__ import annotations

import os

from fastmcp import FastMCP

from mcp_vars.domain.errors import VariableStorageError, VariableValidationError
from mcp_vars.domain.service import ScopedStores, VariableService
from mcp_vars.server.tools.variable_tools import register_resources, register_tools
from mcp_vars.storage.lazy_store import LazyVariableStore
from mcp_vars.storage.path_resolver import resolve_project_db_path, resolve_user_db_path
from mcp_vars.storage.sqlite_store import SQLiteVariableStore


def create_mcp() -> FastMCP:
    mcp = FastMCP(
        "mcp-vars",
        instructions=(
            "Persistent variable store for MCP agents. "
            "Use project scope for repository-specific state and user scope for shared user state."
            "Persistent variable store for tracking"
            "structured data across tool calls. Use when you need to remembe"
            "values, counters, task state, or any data between steps."
        ),
    )
    service = VariableService(_build_scoped_stores())
    register_tools(mcp, service)
    register_resources(mcp)

    return mcp


def _build_scoped_stores() -> ScopedStores:
    user_store = LazyVariableStore(
        lambda: SQLiteVariableStore(resolve_user_db_path(os.environ))
    )
    project_store = _build_project_store()
    return ScopedStores(user=user_store, project=project_store)


def _build_project_store() -> LazyVariableStore | None:
    try:
        project_db_path = resolve_project_db_path(os.environ)
    except VariableValidationError:
        return None
    return LazyVariableStore(lambda: SQLiteVariableStore(project_db_path))
