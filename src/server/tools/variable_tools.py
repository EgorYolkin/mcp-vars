from typing import Any

from fastmcp import FastMCP

from src.domain.service import VariableService


def register_resources(mcp: FastMCP) -> None:
    @mcp.resource("instructions://usage")
    def usage_instructions() -> str:
        return """
          Use mcp-vars when you need to:
          - Track values across multiple steps (counters, state,
      progress)
          - Remember data between tool calls in a session
          - Share state between parallel agents
          - Avoid rewriting memory files

          Do NOT use for: large blobs (>10KB), binary data, or one-shot
       computations.

          Key format: dot-notation, e.g. "task.step" or
      "session.counter"
          Default namespace: "shared" (visible to all clients)
        """


def register_tools(mcp: FastMCP, service: VariableService) -> None:
    @mcp.tool
    def variable_get(key: str, scope: str = "project") -> dict[str, Any]:
        """Load one variable. Use variable_list to discover keys when you do not know the exact key."""
        return service.get(key=key, scope=scope).model_dump(mode="json")

    @mcp.tool
    def variable_set(
        key: str,
        value: Any,
        scope: str = "project",
    ) -> dict[str, Any]:
        """Create or overwrite a variable. Use variable_patch to update object fields without replacing the value."""
        return service.set(key=key, value=value, scope=scope).model_dump(mode="json")

    @mcp.tool
    def variable_patch(
        key: str,
        patch: dict[str, Any],
        scope: str = "project",
    ) -> dict[str, Any]:
        """Shallow-merge fields into an existing object value. Use variable_set when you want full replacement."""
        return service.patch(key=key, patch=patch, scope=scope).model_dump(mode="json")

    @mcp.tool
    def variable_delete(key: str, scope: str = "project") -> dict[str, Any]:
        """Delete one variable by exact key. Use variable_bulk_delete only when removing several keys at once."""
        return service.delete(key=key, scope=scope).model_dump(mode="json")

    @mcp.tool
    def variable_list(
        prefix: str | None = None, scope: str = "project"
    ) -> dict[str, Any]:
        """List keys in one scope. Use variable_get for a known key; list is for discovery and prefix filtering."""
        return service.list(scope=scope, prefix=prefix).model_dump(mode="json")
