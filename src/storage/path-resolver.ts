import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { InitializationResult, StorageScope } from "../domain/models";
import { VariableValidationError } from "../domain/errors";

type EnvMap = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function resolveDbPath(
  scope: StorageScope,
  env: EnvMap = process.env,
  projectRoot?: string | null,
): string {
  return scope === "user"
    ? resolveUserDbPath(env)
    : resolveProjectDbPath(env, projectRoot);
}

export function resolveUserDbPath(env: EnvMap = process.env): string {
  const explicitPath = env.MCP_VARS_USER_DB_PATH;
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  return path.join(resolveDataHome(env), "mcp-vars", "variables.json");
}

export function resolveProjectDbPath(
  env: EnvMap = process.env,
  projectRoot?: string | null,
): string {
  const explicitPath = env.MCP_VARS_PROJECT_DB_PATH;
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  const root = projectRoot ?? env.PROJECT_ROOT ?? process.cwd();
  if (!root) {
    throw new VariableValidationError(
      "Project scope requires project_root, PROJECT_ROOT, or a valid working directory.",
    );
  }

  return path.join(path.resolve(root), ".mcp-vars", "variables.json");
}

export function initializeUserStorage(env: EnvMap = process.env): InitializationResult {
  const dbPath = resolveUserDbPath(env);
  const created = ensureParentDir(dbPath);
  return {
    scope: "user",
    dbPath,
    created,
    message: `User storage ready at ${dbPath}.`,
  };
}

export function initializeProjectStorage(
  env: EnvMap = process.env,
  projectRoot?: string | null,
): InitializationResult {
  const dbPath = resolveProjectDbPath(env, projectRoot);
  const created = ensureParentDir(dbPath);
  return {
    scope: "project",
    dbPath,
    created,
    message: `Project storage ready at ${dbPath}.`,
  };
}

function resolveDataHome(env: EnvMap): string {
  if (env.XDG_DATA_HOME) {
    return path.resolve(env.XDG_DATA_HOME);
  }

  return path.resolve(os.homedir(), ".local", "share");
}

function ensureParentDir(dbPath: string): boolean {
  const parent = path.dirname(dbPath);
  const existed = existsSync(parent);
  mkdirSync(parent, { recursive: true });
  return !existed;
}
