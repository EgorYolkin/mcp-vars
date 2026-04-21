from pathlib import Path

from mcp_vars.domain.errors import VariableValidationError
from mcp_vars.storage.path_resolver import (
    initialize_project_storage,
    initialize_user_storage,
    resolve_db_path,
    resolve_project_db_path,
    resolve_user_db_path,
)


def test_resolve_user_db_path_prefers_explicit_env_override(tmp_path: Path) -> None:
    db_path = tmp_path / "custom.db"

    resolved = resolve_user_db_path({"MCP_VARS_USER_DB_PATH": str(db_path)})

    assert resolved == db_path.resolve()


def test_resolve_project_db_path_prefers_explicit_env_override(tmp_path: Path) -> None:
    db_path = tmp_path / "project.db"

    resolved = resolve_project_db_path({"MCP_VARS_PROJECT_DB_PATH": str(db_path)})

    assert resolved == db_path.resolve()


def test_resolve_project_db_path_uses_project_root(tmp_path: Path) -> None:
    project_root = tmp_path / "project"

    resolved = resolve_project_db_path({"PROJECT_ROOT": str(project_root)})

    assert resolved == (project_root / ".mcp-vars" / "variables.db").resolve()


def test_resolve_project_db_path_requires_project_root() -> None:
    try:
        resolve_project_db_path({})
    except VariableValidationError as exc:
        assert str(exc) == "Project scope requires project_root or PROJECT_ROOT to be set."
    else:  # pragma: no cover
        raise AssertionError("Expected VariableValidationError for missing project root.")


def test_resolve_user_db_path_falls_back_to_xdg_data_home(tmp_path: Path) -> None:
    xdg_data_home = tmp_path / "xdg-data"

    resolved = resolve_user_db_path({"XDG_DATA_HOME": str(xdg_data_home)})

    assert resolved == (xdg_data_home / "mcp-vars" / "variables.db").resolve()


def test_resolve_user_db_path_falls_back_to_local_share_without_xdg(tmp_path: Path) -> None:
    resolved = resolve_user_db_path({}, home=tmp_path)

    assert (
        resolved
        == (tmp_path / ".local" / "share" / "mcp-vars" / "variables.db").resolve()
    )


def test_resolve_db_path_routes_to_user_scope(tmp_path: Path) -> None:
    db_path = tmp_path / "user.db"

    resolved = resolve_db_path("user", {"MCP_VARS_USER_DB_PATH": str(db_path)})

    assert resolved == db_path.resolve()


def test_resolve_db_path_routes_to_project_scope(tmp_path: Path) -> None:
    project_root = tmp_path / "project"

    resolved = resolve_db_path("project", {"PROJECT_ROOT": str(project_root)})

    assert resolved == (project_root / ".mcp-vars" / "variables.db").resolve()


def test_initialize_user_storage_creates_parent_directory(tmp_path: Path) -> None:
    result = initialize_user_storage({"XDG_DATA_HOME": str(tmp_path / "xdg")})

    assert result.scope == "user"
    assert result.created is True
    assert Path(result.db_path).parent.is_dir()


def test_initialize_project_storage_creates_project_directory(tmp_path: Path) -> None:
    project_root = tmp_path / "project"

    result = initialize_project_storage(project_root=project_root)

    assert result.scope == "project"
    assert result.created is True
    assert Path(result.db_path).parent == (project_root / ".mcp-vars").resolve()
    assert Path(result.db_path).parent.is_dir()
