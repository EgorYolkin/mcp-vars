from pathlib import Path

from mcp_vars.domain.models import VariableSetItem
from mcp_vars.storage.sqlite_store import SQLiteVariableStore


def test_store_initializes_database_file(tmp_path: Path) -> None:
    db_path = tmp_path / "vars.db"

    store = SQLiteVariableStore(db_path)

    assert store.db_path == db_path.resolve()
    assert db_path.exists()


def test_set_and_get_round_trip_value(tmp_path: Path) -> None:
    store = SQLiteVariableStore(tmp_path / "vars.db")
    store.set("project.goal", {"title": "ship", "done": False})

    record = store.get("project.goal")

    assert record is not None
    assert record.key == "project.goal"
    assert record.value == {"title": "ship", "done": False}


def test_delete_returns_previous_record_and_removes_value(tmp_path: Path) -> None:
    store = SQLiteVariableStore(tmp_path / "vars.db")
    store.set("session.counter", 3)

    deleted = store.delete("session.counter")

    assert deleted is not None
    assert deleted.key == "session.counter"
    assert store.get("session.counter") is None


def test_list_supports_prefix_filter(tmp_path: Path) -> None:
    store = SQLiteVariableStore(tmp_path / "vars.db")
    store.set("project.goal", "ship")
    store.set("project.owner", "egor")
    store.set("session.counter", 2)

    records = store.list(prefix="project.")

    assert [record.key for record in records] == ["project.goal", "project.owner"]


def test_bulk_set_and_bulk_delete_operate_on_multiple_keys(tmp_path: Path) -> None:
    store = SQLiteVariableStore(tmp_path / "vars.db")

    store.bulk_set(
        [
            VariableSetItem(key="project.goal", value="ship"),
            VariableSetItem(key="user.name", value="egor"),
        ]
    )
    deleted = store.bulk_delete(["project.goal", "user.name"])

    assert deleted == ["project.goal", "user.name"]
    assert store.get("project.goal") is None
    assert store.get("user.name") is None


def test_export_and_import_snapshot_round_trip(tmp_path: Path) -> None:
    source = SQLiteVariableStore(tmp_path / "source.db")
    source.set("project.goal", {"title": "ship"})
    source.set("user.name", "egor")
    snapshot = source.export_snapshot()

    target = SQLiteVariableStore(tmp_path / "target.db")
    imported = target.import_snapshot(snapshot)

    assert imported == {"project.goal": {"title": "ship"}, "user.name": "egor"}
