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

describe("service integration", () => {
  it("round-trips project and user scopes", async () => {
    const dir = tempDir();
    const service = new VariableService({
      project: new JsonVariableStore(path.join(dir, "project.json")),
      user: new JsonVariableStore(path.join(dir, "user.json")),
    });

    const setProject = await service.set("project.goal", "ship", "project");
    const setUser = await service.set("profile.language", "ru", "user");
    const listProject = await service.list("project");
    const listUser = await service.list("user");

    expect(setProject.status).toBe("ok");
    expect(setUser.status).toBe("ok");
    expect(listProject.value).toEqual({
      scope: "project",
      items: [{ key: "project.goal", value: "ship" }],
    });
    expect(listUser.value).toEqual({
      scope: "user",
      items: [{ key: "profile.language", value: "ru" }],
    });
  });
});
