from pathlib import Path

import json
import yaml

from src.install.installer import (
    detect_client_targets,
    install_configs,
)


def test_install_configs_updates_claude_json(tmp_path: Path) -> None:
    home = tmp_path
    claude_dir = home / ".claude"
    claude_dir.mkdir(parents=True)
    settings_path = claude_dir / "settings.json"
    settings_path.write_text(json.dumps({"hooks": {}, "mcpServers": {"other-server": {"command": "old"}}}))

    results = install_configs(clients=["claude"], home=home, repo_root=tmp_path / "repo", python_executable="/venv/bin/python")

    installed = json.loads(settings_path.read_text())
    assert results[0].status == "updated"
    assert installed["mcpServers"]["other-server"]["command"] == "old"
    assert installed["mcpServers"]["mcp-vars"]["command"] == "/venv/bin/python"
    assert installed["mcpServers"]["mcp-vars"]["args"] == ["-u", "-m", "src.main"]
    assert installed["mcpServers"]["mcp-vars"]["env"]["PROJECT_ROOT"] == str((tmp_path / "repo").resolve())


def test_install_configs_updates_hermes_yaml(tmp_path: Path) -> None:
    home = tmp_path
    hermes_dir = home / ".hermes"
    hermes_dir.mkdir(parents=True)
    config_path = hermes_dir / "config.yaml"
    config_path.write_text("model:\n  default: gpt-5.4\nmcp_servers:\n  other-server:\n    command: old\n")

    install_configs(clients=["hermes"], home=home, repo_root=tmp_path / "repo", python_executable="/venv/bin/python")

    installed = yaml.safe_load(config_path.read_text())
    assert installed["mcp_servers"]["other-server"]["command"] == "old"
    assert installed["mcp_servers"]["mcp-vars"]["command"] == "/venv/bin/python"
    assert installed["mcp_servers"]["mcp-vars"]["cwd"] == str((tmp_path / "repo").resolve())
    assert installed["mcp_servers"]["mcp-vars"]["env"]["PROJECT_ROOT"] == str((tmp_path / "repo").resolve())


def test_install_configs_updates_codex_toml_and_removes_legacy_block(tmp_path: Path) -> None:
    home = tmp_path
    codex_dir = home / ".codex"
    codex_dir.mkdir(parents=True)
    config_path = codex_dir / "config.toml"
    config_path.write_text(
        '#:schema https://developers.openai.com/codex/config-schema.json\n\n'
        '[mcp_servers.other-server]\n'
        'command = "/old/python"\n'
        'args = ["/old/main.py"]\n\n'
        '[mcp_servers.mcp-vars]\n'
        'command = "/old/python"\n'
        'args = ["/old/main.py"]\n\n'
        '[mcp_servers.mcp-vars.tools.list_files]\n'
        'approval_mode = "approve"\n'
    )

    install_configs(clients=["codex"], home=home, repo_root=tmp_path / "repo", python_executable="/venv/bin/python")

    installed = config_path.read_text()
    assert "[mcp_servers.other-server]" in installed
    assert "[mcp_servers.mcp-vars.tools.list_files]" not in installed
    assert "[mcp_servers.mcp-vars]" in installed
    assert 'command = "/venv/bin/python"' in installed
    assert 'args = ["-u", "-m", "src.main"]' in installed
    assert "startup_timeout_sec = 60" in installed
    assert "[mcp_servers.mcp-vars.env]" in installed
    assert f'PROJECT_ROOT = "{(tmp_path / "repo").resolve()}"' in installed


def test_detect_client_targets_only_returns_existing_client_dirs(tmp_path: Path) -> None:
    (tmp_path / ".claude").mkdir()
    (tmp_path / ".hermes").mkdir()

    targets = detect_client_targets(home=tmp_path)

    assert [target.name for target in targets] == ["claude", "hermes"]
