from pathlib import Path

from src.domain.service import ScopedStores, VariableService
from src.server.tools.variable_tools import register_tools
from src.storage.sqlite_store import SQLiteVariableStore


def test_register_tools_allows_basic_project_round_trip(tmp_path: Path) -> None:
    project_store = SQLiteVariableStore(tmp_path / "project.db")
    user_store = SQLiteVariableStore(tmp_path / "user.db")
    service = VariableService(ScopedStores(project=project_store, user=user_store))

    class DummyMCP:
        def __init__(self) -> None:
            self.tools: dict[str, object] = {}

        def tool(self, fn):  # type: ignore[no-untyped-def]
            self.tools[fn.__name__] = fn
            return fn

    mcp = DummyMCP()
    register_tools(mcp, service)

    set_response = mcp.tools["variable_set"]("project.goal", "ship", "project")
    get_response = mcp.tools["variable_get"]("project.goal", "project")
    list_response = mcp.tools["variable_list"]("project.", "project")

    assert set_response["status"] == "ok"
    assert get_response["status"] == "ok"
    assert get_response["value"] == "ship"
    assert list_response["status"] == "ok"
    assert list_response["value"]["items"][0]["key"] == "project.goal"
