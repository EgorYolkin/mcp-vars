import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSONValue, VariableRecord, VariableSetItem } from "../domain/models";
import { VariableStorageError } from "../domain/errors";
import { VariableStore } from "./store";

interface PersistedState {
  version: 1;
  records: Record<string, VariableRecord>;
}

const EMPTY_STATE: PersistedState = {
  version: 1,
  records: {},
};

export class JsonVariableStore implements VariableStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  async get(key: string): Promise<VariableRecord | null> {
    const state = this.loadState();
    return state.records[key] ?? null;
  }

  async set(
    key: string,
    value: JSONValue,
    expiresAt: string | null = null,
  ): Promise<VariableRecord> {
    const state = this.loadState();
    const now = new Date().toISOString();
    const existing = state.records[key];
    const record: VariableRecord = {
      key,
      value,
      expiresAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    state.records[key] = record;
    this.writeState(state);
    return record;
  }

  async delete(key: string): Promise<VariableRecord | null> {
    const state = this.loadState();
    const existing = state.records[key] ?? null;
    if (existing == null) {
      return null;
    }
    delete state.records[key];
    this.writeState(state);
    return existing;
  }

  async list(prefix?: string | null): Promise<VariableRecord[]> {
    const state = this.loadState();
    return Object.keys(state.records)
      .filter((key) => (prefix ? key.startsWith(prefix) : true))
      .sort((left, right) => left.localeCompare(right))
      .map((key) => state.records[key]);
  }

  async bulkSet(items: VariableSetItem[]): Promise<VariableRecord[]> {
    const records: VariableRecord[] = [];
    for (const item of items) {
      records.push(await this.set(item.key, item.value, item.expiresAt ?? null));
    }
    return records;
  }

  async bulkDelete(keys: string[]): Promise<string[]> {
    const deleted: string[] = [];
    for (const key of keys) {
      const result = await this.delete(key);
      if (result != null) {
        deleted.push(key);
      }
    }
    return deleted;
  }

  async exportSnapshot(): Promise<Record<string, JSONValue>> {
    const state = this.loadState();
    return Object.fromEntries(
      Object.entries(state.records).map(([key, record]) => [key, record.value]),
    );
  }

  async importSnapshot(data: Record<string, JSONValue>): Promise<Record<string, JSONValue>> {
    const nextState: PersistedState = {
      version: 1,
      records: {},
    };

    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(data)) {
      nextState.records[key] = {
        key,
        value,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      };
    }

    this.writeState(nextState);
    return Object.fromEntries(Object.entries(nextState.records).map(([key, record]) => [key, record.value]));
  }

  private loadState(): PersistedState {
    if (!existsSync(this.filePath)) {
      return structuredClone(EMPTY_STATE);
    }

    try {
      const raw = readFileSync(this.filePath, "utf8");
      if (!raw.trim()) {
        return structuredClone(EMPTY_STATE);
      }
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.version !== 1 || typeof parsed.records !== "object" || parsed.records == null) {
        throw new VariableStorageError(`Unexpected storage format in ${this.filePath}.`);
      }
      return {
        version: 1,
        records: parsed.records as Record<string, VariableRecord>,
      };
    } catch (error) {
      if (error instanceof VariableStorageError) {
        throw error;
      }
      throw new VariableStorageError(`Failed to load storage file ${this.filePath}: ${String(error)}`);
    }
  }

  private writeState(state: PersistedState): void {
    const parentDir = path.dirname(this.filePath);
    mkdirSync(parentDir, { recursive: true });
    const tempPath = path.join(
      parentDir,
      `.variables.${process.pid}.${Date.now()}.tmp`,
    );

    try {
      writeFileSync(tempPath, JSON.stringify(state, null, 2) + "\n", "utf8");
      renameSync(tempPath, this.filePath);
    } catch (error) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup failures.
      }
      throw new VariableStorageError(`Failed to write storage file ${this.filePath}: ${String(error)}`);
    }
  }
}
