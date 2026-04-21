from pathlib import Path

from mcp_vars.domain.service import ScopedStores, VariableService
from mcp_vars.storage.sqlite_store import SQLiteVariableStore


def test_service_routes_project_scope_to_project_store(tmp_path: Path) -> None:
    project_store = SQLiteVariableStore(tmp_path / "project.db")
    user_store = SQLiteVariableStore(tmp_path / "user.db")
    service = VariableService(ScopedStores(project=project_store, user=user_store))

    response = service.set("project.goal", "ship", scope="project")

    assert response.status == "ok"
    assert response.scope == "project"
    assert project_store.get("project.goal") is not None
    assert user_store.get("project.goal") is None


def test_service_defaults_to_project_scope(tmp_path: Path) -> None:
    project_store = SQLiteVariableStore(tmp_path / "project.db")
    user_store = SQLiteVariableStore(tmp_path / "user.db")
    service = VariableService(ScopedStores(project=project_store, user=user_store))

    response = service.set("project.goal", "ship")

    assert response.status == "ok"
    assert response.scope == "project"
    assert project_store.get("project.goal") is not None


def test_service_uses_user_scope_when_requested(tmp_path: Path) -> None:
    project_store = SQLiteVariableStore(tmp_path / "project.db")
    user_store = SQLiteVariableStore(tmp_path / "user.db")
    service = VariableService(ScopedStores(project=project_store, user=user_store))

    response = service.set("user.name", "egor", scope="user")

    assert response.status == "ok"
    assert response.scope == "user"
    assert user_store.get("user.name") is not None
    assert project_store.get("user.name") is None


def test_service_returns_error_when_project_scope_is_uninitialized(tmp_path: Path) -> None:
    user_store = SQLiteVariableStore(tmp_path / "user.db")
    service = VariableService(ScopedStores(project=None, user=user_store))

    response = service.set("project.goal", "ship", scope="project")

    assert response.status == "error"
    assert response.scope == "project"
    assert response.message == "Project scope is not initialized. Run project initialization first."


def test_service_patch_shallow_merges_object(tmp_path: Path) -> None:
    project_store = SQLiteVariableStore(tmp_path / "project.db")
    user_store = SQLiteVariableStore(tmp_path / "user.db")
    service = VariableService(ScopedStores(project=project_store, user=user_store))
    service.set("project.meta", {"title": "ship", "done": False}, scope="project")

    response = service.patch("project.meta", {"done": True}, scope="project")

    assert response.status == "ok"
    assert response.value == {"title": "ship", "done": True}
