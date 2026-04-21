from __future__ import annotations

import os
from pathlib import Path
from typing import Mapping

from mcp_vars.domain.models import InitializationResult, StorageScope
from mcp_vars.domain.errors import VariableValidationError


def resolve_db_path(
    scope: StorageScope,
    env: Mapping[str, str] | None = None,
    *,
    home: Path | None = None,
    project_root: str | Path | None = None,
) -> Path:
    if scope == "user":
        return resolve_user_db_path(env=env, home=home)
    return resolve_project_db_path(env=env, project_root=project_root)


def resolve_user_db_path(
    env: Mapping[str, str] | None = None,
    *,
    home: Path | None = None,
) -> Path:
    environment = env if env is not None else os.environ
    user_home = home if home is not None else Path.home()

    explicit_path = environment.get("MCP_VARS_USER_DB_PATH")
    if explicit_path:
        return Path(explicit_path).expanduser().resolve()

    return _resolve_data_home(
        environment,
        user_home,
        prefer_home_fallback=home is not None,
    ) / "mcp-vars" / "variables.db"


def resolve_project_db_path(
    env: Mapping[str, str] | None = None,
    *,
    project_root: str | Path | None = None,
) -> Path:
    environment = env if env is not None else os.environ

    explicit_path = environment.get("MCP_VARS_PROJECT_DB_PATH")
    if explicit_path:
        return Path(explicit_path).expanduser().resolve()

    root = project_root if project_root is not None else environment.get("PROJECT_ROOT")
    if root is None:
        raise VariableValidationError(
            "Project scope requires project_root or PROJECT_ROOT to be set."
        )

    root_path = Path(root).expanduser().resolve()
    return root_path / ".mcp-vars" / "variables.db"


def initialize_user_storage(
    env: Mapping[str, str] | None = None,
    *,
    home: Path | None = None,
) -> InitializationResult:
    db_path = resolve_user_db_path(env=env, home=home)
    created = _ensure_parent_dir(db_path)
    return InitializationResult(
        scope="user",
        db_path=str(db_path),
        created=created,
        message=f"User storage ready at {db_path}.",
    )


def initialize_project_storage(
    env: Mapping[str, str] | None = None,
    *,
    project_root: str | Path | None = None,
) -> InitializationResult:
    db_path = resolve_project_db_path(env=env, project_root=project_root)
    created = _ensure_parent_dir(db_path)
    return InitializationResult(
        scope="project",
        db_path=str(db_path),
        created=created,
        message=f"Project storage ready at {db_path}.",
    )


def _resolve_data_home(
    environment: Mapping[str, str],
    user_home: Path,
    *,
    prefer_home_fallback: bool = False,
) -> Path:
    xdg_data_home = environment.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home).expanduser().resolve()

    return (user_home / ".local" / "share").resolve()


def _ensure_parent_dir(db_path: Path) -> bool:
    parent = db_path.parent
    existed = parent.exists()
    parent.mkdir(parents=True, exist_ok=True)
    return not existed
