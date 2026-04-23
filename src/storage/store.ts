import {
  JSONValue,
  InitializationResult,
  VariableRecord,
  VariableSetItem,
} from "../domain/models";

export interface VariableStore {
  get(key: string): Promise<VariableRecord | null>;
  set(key: string, value: JSONValue, expiresAt?: string | null): Promise<VariableRecord>;
  delete(key: string): Promise<VariableRecord | null>;
  list(prefix?: string | null): Promise<VariableRecord[]>;
  bulkSet(items: VariableSetItem[]): Promise<VariableRecord[]>;
  bulkDelete(keys: string[]): Promise<string[]>;
  exportSnapshot(): Promise<Record<string, JSONValue>>;
  importSnapshot(data: Record<string, JSONValue>): Promise<Record<string, JSONValue>>;
}

export interface StorageInitializer {
  initializeUserStorage(): Promise<InitializationResult>;
  initializeProjectStorage(projectRoot?: string | null): Promise<InitializationResult>;
}
