from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Literal

import yaml

SUPPORTED_CLIENTS = ("codex", "claude", "hermes", "qwen")
MANAGED_SERVER_ALIASES = ("mcp-vars",)
DEFAULT_SERVER_NAME = "mcp-vars"


@dataclass(frozen=True)
class ClientConfigTarget:
    name: Literal["codex", "claude", "hermes", "qwen"]
    config_path: Path


@dataclass(frozen=True)
class InstallResult:
    client: str
    config_path: str
    status: Literal["installed", "updated", "skipped", "error"]
    message: str


def detect_client_targets(home: Path | None = None) -> list[ClientConfigTarget]:
    base_home = home if home is not None else Path.home()
    targets = [
        ClientConfigTarget("codex", base_home / ".codex" / "config.toml"),
        ClientConfigTarget("claude", base_home / ".claude" / "settings.json"),
        ClientConfigTarget("hermes", base_home / ".hermes" / "config.yaml"),
        ClientConfigTarget("qwen", base_home / ".qwen" / "settings.json"),
    ]
    return [target for target in targets if target.config_path.parent.exists()]


def install_configs(
    clients: list[str] | None = None,
    *,
    home: Path | None = None,
    repo_root: Path | None = None,
    python_executable: str | None = None,
    server_name: str = DEFAULT_SERVER_NAME,
) -> list[InstallResult]:
    selected_clients = set(clients or SUPPORTED_CLIENTS)
    project_root = repo_root if repo_root is not None else Path(__file__).resolve().parents[2]
    executable = python_executable or sys.executable
    targets = detect_client_targets(home=home)
    target_map = {target.name: target for target in targets}
    results: list[InstallResult] = []

    for client_name in SUPPORTED_CLIENTS:
        if client_name not in selected_clients:
            continue

        target = target_map.get(client_name)
        if target is None:
            results.append(
                InstallResult(
                    client=client_name,
                    config_path=str(_default_config_path(client_name, home=home)),
                    status="skipped",
                    message=f"{client_name} config directory was not found.",
                )
            )
            continue

        config_existed = target.config_path.exists()
        server_config = _build_server_config(project_root, executable)
        try:
            if client_name == "codex":
                _install_codex(target.config_path, server_name, server_config)
            elif client_name == "claude":
                _install_claude(target.config_path, server_name, server_config)
            elif client_name == "hermes":
                _install_hermes(target.config_path, server_name, server_config)
            elif client_name == "qwen":
                _install_qwen(target.config_path, server_name, server_config)
            else:  # pragma: no cover
                raise ValueError(f"Unsupported client '{client_name}'.")
        except Exception as exc:
            results.append(
                InstallResult(
                    client=client_name,
                    config_path=str(target.config_path),
                    status="error",
                    message=str(exc),
                )
            )
            continue

        results.append(
            InstallResult(
                client=client_name,
                config_path=str(target.config_path),
                status="updated" if config_existed else "installed",
                message=f"Registered {server_name} in {client_name}.",
            )
        )

    return results


def format_install_report(results: list[InstallResult]) -> str:
    lines = []
    for result in results:
        lines.append(
            f"[{result.status}] {result.client}: {result.message} ({result.config_path})"
        )
    return "\n".join(lines)


def _build_server_config(repo_root: Path, python_executable: str) -> dict[str, Any]:
    resolved_root = str(repo_root.resolve())
    command, args = _resolve_launch_command(python_executable)
    return {
        "command": command,
        "args": args,
        "cwd": resolved_root,
        "env": {
            "PYTHONWARNINGS": "ignore::DeprecationWarning",
            "PROJECT_ROOT": resolved_root,
        },
    }


def _resolve_launch_command(python_executable: str) -> tuple[str, list[str]]:
    script_candidate = Path(python_executable).resolve().with_name("mcp-vars")
    if script_candidate.exists():
        return str(script_candidate), []

    return python_executable, ["-u", "-m", "mcp_vars.main"]


def _install_claude(config_path: Path, server_name: str, server_config: dict[str, Any]) -> None:
    data = _load_json_mapping(config_path)
    mcp_servers = data.setdefault("mcpServers", {})
    _drop_aliases(mcp_servers, keep=server_name)
    mcp_servers[server_name] = server_config
    _atomic_write_text(config_path, json.dumps(data, indent=2) + "\n")


def _install_qwen(config_path: Path, server_name: str, server_config: dict[str, Any]) -> None:
    data = _load_json_mapping(config_path)
    mcp_servers = data.setdefault("mcpServers", {})
    _drop_aliases(mcp_servers, keep=server_name)
    mcp_servers[server_name] = server_config
    _atomic_write_text(config_path, json.dumps(data, indent=2) + "\n")


def _install_hermes(config_path: Path, server_name: str, server_config: dict[str, Any]) -> None:
    data = _load_yaml_mapping(config_path)
    mcp_servers = data.setdefault("mcp_servers", {})
    _drop_aliases(mcp_servers, keep=server_name)
    mcp_servers[server_name] = server_config
    rendered = yaml.safe_dump(data, sort_keys=False, allow_unicode=False)
    _atomic_write_text(config_path, rendered)


def _install_codex(config_path: Path, server_name: str, server_config: dict[str, Any]) -> None:
    config_path.parent.mkdir(parents=True, exist_ok=True)
    original = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    cleaned = _strip_codex_server_tables(original, MANAGED_SERVER_ALIASES)
    header = ""
    if not cleaned.strip():
        header = "#:schema https://developers.openai.com/codex/config-schema.json\n\n"
    elif not cleaned.endswith("\n"):
        cleaned += "\n"

    rendered_block = _render_codex_server_block(server_name, server_config)
    new_text = f"{header}{cleaned}".rstrip() + "\n\n" + rendered_block
    _atomic_write_text(config_path, new_text)


def _strip_codex_server_tables(text: str, aliases: tuple[str, ...]) -> str:
    if not text:
        return text

    lines = text.splitlines(keepends=True)
    cleaned: list[str] = []
    index = 0
    patterns = tuple(
        f"mcp_servers.{alias}" for alias in aliases
    )

    while index < len(lines):
        stripped = lines[index].strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            table_name = stripped[1:-1].strip()
            if any(
                table_name == pattern or table_name.startswith(f"{pattern}.")
                for pattern in patterns
            ):
                index += 1
                while index < len(lines):
                    next_stripped = lines[index].strip()
                    if next_stripped.startswith("[") and next_stripped.endswith("]"):
                        break
                    index += 1
                continue

        cleaned.append(lines[index])
        index += 1

    cleaned_text = "".join(cleaned)
    cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text).rstrip() + "\n"
    return cleaned_text


def _render_codex_server_block(server_name: str, server_config: dict[str, Any]) -> str:
    args = ", ".join(_toml_string(value) for value in server_config["args"])
    rendered = (
        f"[mcp_servers.{server_name}]\n"
        f"command = {_toml_string(server_config['command'])}\n"
        f"args = [{args}]\n"
        f"cwd = {_toml_string(server_config['cwd'])}\n"
        f"startup_timeout_sec = 60\n"
    )
    env_items = server_config.get("env", {})
    if env_items:
        rendered += "\n"
        rendered += f"[mcp_servers.{server_name}.env]\n"
        for key, value in env_items.items():
            rendered += f"{key} = {_toml_string(value)}\n"
    return rendered


def _toml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _drop_aliases(mapping: dict[str, Any], *, keep: str) -> None:
    for alias in MANAGED_SERVER_ALIASES:
        if alias != keep:
            mapping.pop(alias, None)


def _load_json_mapping(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"Expected JSON object in {path}.")
    return raw


def _load_yaml_mapping(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError(f"Expected YAML mapping in {path}.")
    return raw


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", delete=False, dir=str(path.parent), encoding="utf-8") as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    os.replace(temp_path, path)


def _default_config_path(client: str, home: Path | None = None) -> Path:
    base_home = home if home is not None else Path.home()
    if client == "codex":
        return base_home / ".codex" / "config.toml"
    if client == "claude":
        return base_home / ".claude" / "settings.json"
    if client == "hermes":
        return base_home / ".hermes" / "config.yaml"
    if client == "qwen":
        return base_home / ".qwen" / "settings.json"
    raise ValueError(f"Unsupported client '{client}'.")
