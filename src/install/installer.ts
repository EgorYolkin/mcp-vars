import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import yaml from "js-yaml";

export const SUPPORTED_CLIENTS = ["codex", "claude", "hermes", "qwen"] as const;
export const MANAGED_SERVER_ALIASES = ["mcp-vars"] as const;
export const DEFAULT_SERVER_NAME = "mcp-vars";

export type SupportedClient = (typeof SUPPORTED_CLIENTS)[number];

export interface ClientConfigTarget {
  name: SupportedClient;
  configPath: string;
}

export interface InstallResult {
  client: string;
  configPath: string;
  status: "installed" | "updated" | "skipped" | "error";
  message: string;
}

interface ServerConfig {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export function detectClientTargets(home = os.homedir()): ClientConfigTarget[] {
  const targets: ClientConfigTarget[] = [
    { name: "codex", configPath: path.join(home, ".codex", "config.toml") },
    { name: "claude", configPath: path.join(home, ".claude", "settings.json") },
    { name: "hermes", configPath: path.join(home, ".hermes", "config.yaml") },
    { name: "qwen", configPath: path.join(home, ".qwen", "settings.json") },
  ];

  return targets.filter((target) => existsSync(path.dirname(target.configPath)));
}

export function installConfigs(options: {
  clients?: string[];
  home?: string;
  repoRoot?: string;
  serverName?: string;
} = {}): InstallResult[] {
  const selectedClients = new Set(options.clients ?? SUPPORTED_CLIENTS);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const serverName = options.serverName ?? DEFAULT_SERVER_NAME;
  const targets = detectClientTargets(options.home);
  const targetMap = new Map(targets.map((target) => [target.name, target]));
  const results: InstallResult[] = [];

  for (const clientName of SUPPORTED_CLIENTS) {
    if (!selectedClients.has(clientName)) {
      continue;
    }

    const target = targetMap.get(clientName);
    if (!target) {
      results.push({
        client: clientName,
        configPath: defaultConfigPath(clientName, options.home),
        status: "skipped",
        message: `${clientName} config directory was not found.`,
      });
      continue;
    }

    const configExisted = existsSync(target.configPath);
    const serverConfig = buildServerConfig(repoRoot);

    try {
      if (clientName === "codex") {
        installCodex(target.configPath, serverName, serverConfig);
      } else if (clientName === "claude") {
        installClaude(target.configPath, serverName, serverConfig);
      } else if (clientName === "hermes") {
        installHermes(target.configPath, serverName, serverConfig);
      } else if (clientName === "qwen") {
        installQwen(target.configPath, serverName, serverConfig);
      }

      results.push({
        client: clientName,
        configPath: target.configPath,
        status: configExisted ? "updated" : "installed",
        message: `Registered ${serverName} in ${clientName}.`,
      });
    } catch (error) {
      results.push({
        client: clientName,
        configPath: target.configPath,
        status: "error",
        message: String(error),
      });
    }
  }

  return results;
}

export function formatInstallReport(results: InstallResult[]): string {
  return results
    .map((result) => `[${result.status}] ${result.client}: ${result.message} (${result.configPath})`)
    .join("\n");
}

function buildServerConfig(repoRoot: string): ServerConfig {
  return {
    command: "npx",
    args: ["-y", "mcp-vars"],
    cwd: repoRoot,
    env: {
      PROJECT_ROOT: repoRoot,
    },
  };
}

function installClaude(configPath: string, serverName: string, serverConfig: ServerConfig): void {
  const data = loadJsonMapping(configPath);
  const mcpServers = (data.mcpServers ??= {});
  dropAliases(mcpServers, serverName);
  mcpServers[serverName] = serverConfig;
  atomicWriteText(configPath, `${JSON.stringify(data, null, 2)}\n`);
}

function installQwen(configPath: string, serverName: string, serverConfig: ServerConfig): void {
  const data = loadJsonMapping(configPath);
  const mcpServers = (data.mcpServers ??= {});
  dropAliases(mcpServers, serverName);
  mcpServers[serverName] = serverConfig;
  atomicWriteText(configPath, `${JSON.stringify(data, null, 2)}\n`);
}

function installHermes(configPath: string, serverName: string, serverConfig: ServerConfig): void {
  const data = loadYamlMapping(configPath);
  const mcpServers = (data.mcp_servers ??= {});
  dropAliases(mcpServers, serverName);
  mcpServers[serverName] = serverConfig;
  atomicWriteText(configPath, yaml.dump(data, { noRefs: true, sortKeys: false }));
}

function installCodex(configPath: string, serverName: string, serverConfig: ServerConfig): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  const original = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const cleaned = stripCodexServerTables(original, MANAGED_SERVER_ALIASES);
  const header =
    cleaned.trim().length === 0
      ? "#:schema https://developers.openai.com/codex/config-schema.json\n\n"
      : "";
  const normalized = cleaned.trim().length > 0 && !cleaned.endsWith("\n") ? `${cleaned}\n` : cleaned;
  const renderedBlock = renderCodexServerBlock(serverName, serverConfig);
  const nextText = `${header}${normalized}`.trimEnd() + "\n\n" + renderedBlock;
  atomicWriteText(configPath, nextText);
}

function stripCodexServerTables(text: string, aliases: readonly string[]): string {
  if (!text) {
    return text;
  }

  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const stripped = lines[index].trim();
    if (stripped.startsWith("[") && stripped.endsWith("]")) {
      const tableName = stripped.slice(1, -1).trim();
      const shouldDrop = aliases.some(
        (alias) =>
          tableName === `mcp_servers.${alias}` || tableName.startsWith(`mcp_servers.${alias}.`),
      );

      if (shouldDrop) {
        index += 1;
        while (index < lines.length) {
          const next = lines[index].trim();
          if (next.startsWith("[") && next.endsWith("]")) {
            index -= 1;
            break;
          }
          index += 1;
        }
        continue;
      }
    }

    cleaned.push(lines[index]);
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function renderCodexServerBlock(serverName: string, serverConfig: ServerConfig): string {
  const args = serverConfig.args.map((value) => tomlString(value)).join(", ");
  let rendered =
    `[mcp_servers.${serverName}]\n` +
    `command = ${tomlString(serverConfig.command)}\n` +
    `args = [${args}]\n` +
    `cwd = ${tomlString(serverConfig.cwd)}\n` +
    "startup_timeout_sec = 60\n";

  if (Object.keys(serverConfig.env).length > 0) {
    rendered += `\n[mcp_servers.${serverName}.env]\n`;
    for (const [key, value] of Object.entries(serverConfig.env)) {
      rendered += `${key} = ${tomlString(value)}\n`;
    }
  }

  return rendered;
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function dropAliases(mapping: Record<string, unknown>, keep: string): void {
  for (const alias of MANAGED_SERVER_ALIASES) {
    if (alias !== keep) {
      delete mapping[alias];
    }
  }
}

function loadJsonMapping(configPath: string): Record<string, any> {
  if (!existsSync(configPath)) {
    return {};
  }
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Expected JSON object in ${configPath}.`);
  }
  return raw;
}

function loadYamlMapping(configPath: string): Record<string, any> {
  if (!existsSync(configPath)) {
    return {};
  }
  const raw = yaml.load(readFileSync(configPath, "utf8"));
  if (raw == null) {
    return {};
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Expected YAML mapping in ${configPath}.`);
  }
  return raw as Record<string, any>;
}

function atomicWriteText(configPath: string, content: string): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  const tempPath = path.join(path.dirname(configPath), `.tmp.${process.pid}.${Date.now()}`);
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, configPath);
}

function defaultConfigPath(client: SupportedClient, home = os.homedir()): string {
  if (client === "codex") {
    return path.join(home, ".codex", "config.toml");
  }
  if (client === "claude") {
    return path.join(home, ".claude", "settings.json");
  }
  if (client === "hermes") {
    return path.join(home, ".hermes", "config.yaml");
  }
  return path.join(home, ".qwen", "settings.json");
}
