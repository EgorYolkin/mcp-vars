import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

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

describe("json variable store", () => {
  it("sets and gets values", async () => {
    const dir = tempDir();
    const store = new JsonVariableStore(path.join(dir, "vars.json"));
    await store.set("project.goal", { title: "ship", done: false });

    const record = await store.get("project.goal");

    expect(record?.key).toBe("project.goal");
    expect(record?.value).toEqual({ title: "ship", done: false });
  });

  it("deletes values", async () => {
    const dir = tempDir();
    const store = new JsonVariableStore(path.join(dir, "vars.json"));
    await store.set("session.counter", 3);

    const deleted = await store.delete("session.counter");

    expect(deleted?.key).toBe("session.counter");
    expect(await store.get("session.counter")).toBeNull();
  });

  it("lists values by prefix", async () => {
    const dir = tempDir();
    const store = new JsonVariableStore(path.join(dir, "vars.json"));
    await store.set("project.goal", "ship");
    await store.set("project.owner", "egor");
    await store.set("session.counter", 2);

    const records = await store.list("project.");

    expect(records.map((record) => record.key)).toEqual(["project.goal", "project.owner"]);
  });

  it("exports and imports snapshots", async () => {
    const dir = tempDir();
    const source = new JsonVariableStore(path.join(dir, "source.json"));
    const target = new JsonVariableStore(path.join(dir, "target.json"));
    await source.set("project.goal", { title: "ship" });
    await source.set("user.name", "egor");

    const snapshot = await source.exportSnapshot();
    const imported = await target.importSnapshot(snapshot);

    expect(imported).toEqual({
      "project.goal": { title: "ship" },
      "user.name": "egor",
    });
  });

  it("throws on malformed persisted file", async () => {
    const dir = tempDir();
    const filePath = path.join(dir, "vars.json");
    writeFileSync(filePath, "nope", "utf8");
    const store = new JsonVariableStore(filePath);

    await expect(store.get("x")).rejects.toThrow(/Failed to load storage file/);
  });
});
