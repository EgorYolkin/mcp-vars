import os from "node:os";
import path from "node:path";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { detectClientTargets, installConfigs } from "../../src/install/installer";

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mcp-vars-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("installer", () => {
  it("updates claude config with npx launch", () => {
    const home = tempDir();
    const claudeDir = path.join(home, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, "settings.json");
    writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: {}, mcpServers: { "other-server": { command: "old" } } }),
      "utf8",
    );

    const results = installConfigs({
      clients: ["claude"],
      home,
      repoRoot: path.join(home, "repo"),
    });

    const installed = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(results[0].status).toBe("updated");
    expect(installed.mcpServers["other-server"].command).toBe("old");
    expect(installed.mcpServers["mcp-vars"].command).toBe("npx");
    expect(installed.mcpServers["mcp-vars"].args).toEqual(["-y", "mcp-vars"]);
    expect(installed.mcpServers["mcp-vars"].env.PROJECT_ROOT).toBe(path.resolve(home, "repo"));
  });

  it("updates hermes yaml config", () => {
    const home = tempDir();
    const hermesDir = path.join(home, ".hermes");
    mkdirSync(hermesDir, { recursive: true });
    const configPath = path.join(hermesDir, "config.yaml");
    writeFileSync(
      configPath,
      "model:\n  default: gpt-5.4\nmcp_servers:\n  other-server:\n    command: old\n",
      "utf8",
    );

    installConfigs({
      clients: ["hermes"],
      home,
      repoRoot: path.join(home, "repo"),
    });

    const installed = readFileSync(configPath, "utf8");
    expect(installed).toContain("other-server:");
    expect(installed).toContain('command: npx');
    expect(installed).toContain('- mcp-vars');
  });

  it("updates codex toml config and strips managed blocks", () => {
    const home = tempDir();
    const codexDir = path.join(home, ".codex");
    mkdirSync(codexDir, { recursive: true });
    const configPath = path.join(codexDir, "config.toml");
    writeFileSync(
      configPath,
      '#:schema https://developers.openai.com/codex/config-schema.json\n\n' +
        '[mcp_servers.other-server]\n' +
        'command = "old"\n\n' +
        '[mcp_servers.mcp-vars]\n' +
        'command = "old"\n\n' +
        '[mcp_servers.mcp-vars.tools.list_files]\n' +
        'approval_mode = "approve"\n',
      "utf8",
    );

    installConfigs({
      clients: ["codex"],
      home,
      repoRoot: path.join(home, "repo"),
    });

    const installed = readFileSync(configPath, "utf8");
    expect(installed).toContain("[mcp_servers.other-server]");
    expect(installed).not.toContain("[mcp_servers.mcp-vars.tools.list_files]");
    expect(installed).toContain("[mcp_servers.mcp-vars]");
    expect(installed).toContain('command = "npx"');
    expect(installed).toContain('args = ["-y", "mcp-vars"]');
    expect(installed).toContain(`[mcp_servers.mcp-vars.env]`);
  });

  it("detects only existing config directories", () => {
    const home = tempDir();
    mkdirSync(path.join(home, ".claude"));
    mkdirSync(path.join(home, ".hermes"));

    const targets = detectClientTargets(home);

    expect(targets.map((target) => target.name)).toEqual(["claude", "hermes"]);
  });
});
