from src.storage.lazy_store import LazyVariableStore


class DummyStore:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def get(self, key: str):  # type: ignore[no-untyped-def]
        self.calls.append(key)
        return None


def test_lazy_store_defers_factory_until_first_call() -> None:
    created = {"count": 0}

    def factory() -> DummyStore:
        created["count"] += 1
        return DummyStore()

    store = LazyVariableStore(factory)

    assert created["count"] == 0

    store.get("project.goal")

    assert created["count"] == 1
