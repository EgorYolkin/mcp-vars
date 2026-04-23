import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { VariableService } from "../../src/domain/service";
import { JsonVariableStore } from "../../src/storage/json-store";

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

describe("variable service", () => {
  it("routes project scope to project store", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });

    const response = await service.set("project.goal", "ship", "project");

    expect(response.status).toBe("ok");
    expect(response.scope).toBe("project");
    expect(await projectStore.get("project.goal")).not.toBeNull();
    expect(await userStore.get("project.goal")).toBeNull();
  });

  it("defaults to project scope", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });

    const response = await service.set("project.goal", "ship");

    expect(response.status).toBe("ok");
    expect(response.scope).toBe("project");
  });

  it("uses user scope when requested", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });

    const response = await service.set("user.name", "egor", "user");

    expect(response.status).toBe("ok");
    expect(response.scope).toBe("user");
    expect(await userStore.get("user.name")).not.toBeNull();
  });

  it("returns an error when project scope is uninitialized", async () => {
    const dir = tempDir();
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: null, user: userStore });

    const response = await service.set("project.goal", "ship", "project");

    expect(response.status).toBe("error");
    expect(response.message).toBe(
      "Project scope is not initialized. Run project initialization first.",
    );
  });

  it("shallow merges patch objects", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });
    await service.set("project.meta", { title: "ship", done: false }, "project");

    const response = await service.patch("project.meta", { done: true }, "project");

    expect(response.status).toBe("ok");
    expect(response.value).toEqual({ title: "ship", done: true });
  });
});
