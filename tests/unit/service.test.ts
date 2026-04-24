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

  it("hides expired variables and cleans them lazily", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });
    await service.set("session.temp", "gone", "project", "2000-01-01T00:00:00Z");

    const response = await service.get("session.temp", "project");
    const list = await service.list("project");

    expect(response.status).toBe("not_found");
    expect(await projectStore.get("session.temp")).toBeNull();
    expect(list.value).toMatchObject({ scope: "project", items: [] });
  });

  it("does not patch expired variables", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });
    await service.set("session.temp", { done: false }, "project", "2000-01-01T00:00:00Z");

    const response = await service.patch("session.temp", { done: true }, "project");

    expect(response.status).toBe("not_found");
    expect(await projectStore.get("session.temp")).toBeNull();
  });

  it("supports compare-and-set by revision", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });
    await service.set("project.goal", "ship", "project");

    const conflict = await service.setIfVersion("project.goal", "oops", "project", 99);
    const updated = await service.setIfVersion("project.goal", "done", "project", 1);

    expect(conflict.status).toBe("error");
    expect(conflict.message).toContain("Version conflict");
    expect(updated.status).toBe("ok");
    expect((await projectStore.get("project.goal"))?.revision).toBe(2);
  });

  it("supports increment and array helpers", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });

    const incremented = await service.increment("session.counter", 2, "project");
    await service.append("session.items", "a", "project");
    await service.append("session.items", "b", "project");
    const removed = await service.removeFromArray("session.items", "a", "project");

    expect(incremented.value).toBe(2);
    expect(removed.value).toEqual(["b"]);
  });

  it("filters variables by namespace owner and tag", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });
    await service.set("task.one", "x", "project", null, {
      namespace: "agent",
      owner: "codex",
      tags: ["active"],
    });
    await service.set("task.two", "y", "project", null, { namespace: "other" });

    const response = await service.listFiltered("project", {
      namespace: "agent",
      owner: "codex",
      tag: "active",
    });

    expect(response.value).toMatchObject({
      scope: "project",
      items: [{ key: "task.one", value: "x", namespace: "agent", owner: "codex", tags: ["active"] }],
    });
  });

  it("blocks secret-like values by default", async () => {
    const dir = tempDir();
    const projectStore = new JsonVariableStore(path.join(dir, "project.json"));
    const userStore = new JsonVariableStore(path.join(dir, "user.json"));
    const service = new VariableService({ project: projectStore, user: userStore });

    const response = await service.set("openai.api_key", "sk-proj-not-real-value", "project");

    expect(response.status).toBe("error");
    expect(response.message).toContain("looks like a secret");
  });
});
