import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  initializeProjectStorage,
  initializeUserStorage,
  resolveDbPath,
  resolveProjectDbPath,
  resolveUserDbPath,
} from "../../src/storage/path-resolver";

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

describe("path resolver", () => {
  it("prefers explicit user path override", () => {
    const dir = tempDir();
    const resolved = resolveUserDbPath({
      MCP_VARS_USER_DB_PATH: path.join(dir, "custom.json"),
    });
    expect(resolved).toBe(path.resolve(dir, "custom.json"));
  });

  it("prefers explicit project path override", () => {
    const dir = tempDir();
    const resolved = resolveProjectDbPath({
      MCP_VARS_PROJECT_DB_PATH: path.join(dir, "project.json"),
    });
    expect(resolved).toBe(path.resolve(dir, "project.json"));
  });

  it("uses PROJECT_ROOT for project scope", () => {
    const dir = tempDir();
    const resolved = resolveProjectDbPath({ PROJECT_ROOT: path.join(dir, "project") });
    expect(resolved).toBe(path.resolve(dir, "project", ".mcp-vars", "variables.json"));
  });

  it("falls back to current working directory for project scope", () => {
    const dir = tempDir();
    const previous = process.cwd();
    process.chdir(dir);
    try {
      const resolved = resolveProjectDbPath({});
      expect(resolved.endsWith(path.join(".mcp-vars", "variables.json"))).toBe(true);
    } finally {
      process.chdir(previous);
    }
  });

  it("falls back to xdg data home for user scope", () => {
    const dir = tempDir();
    const resolved = resolveUserDbPath({ XDG_DATA_HOME: path.join(dir, "xdg-data") });
    expect(resolved).toBe(path.resolve(dir, "xdg-data", "mcp-vars", "variables.json"));
  });

  it("routes scope-specific path resolution", () => {
    const dir = tempDir();
    const resolved = resolveDbPath("project", { PROJECT_ROOT: path.join(dir, "project") });
    expect(resolved).toBe(path.resolve(dir, "project", ".mcp-vars", "variables.json"));
  });

  it("creates parent directory for user storage", () => {
    const dir = tempDir();
    const result = initializeUserStorage({ XDG_DATA_HOME: path.join(dir, "xdg") });
    expect(result.scope).toBe("user");
    expect(result.created).toBe(true);
  });

  it("creates parent directory for project storage", () => {
    const dir = tempDir();
    const result = initializeProjectStorage({}, path.join(dir, "project"));
    expect(result.scope).toBe("project");
    expect(result.created).toBe(true);
  });
});
