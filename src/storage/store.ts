import {
  JSONValue,
  InitializationResult,
  VariableRecord,
  VariableSetItem,
  VariableSetOptions,
} from "../domain/models";

export interface VariableStore {
  get(key: string): Promise<VariableRecord | null>;
  set(key: string, value: JSONValue, options?: VariableSetOptions): Promise<VariableRecord>;
  delete(key: string): Promise<VariableRecord | null>;
  list(prefix?: string | null): Promise<VariableRecord[]>;
  bulkSet(items: VariableSetItem[]): Promise<VariableRecord[]>;
  bulkDelete(keys: string[]): Promise<string[]>;
  exportSnapshot(): Promise<Record<string, JSONValue>>;
  importSnapshot(data: Record<string, JSONValue>): Promise<Record<string, JSONValue>>;
  cleanupExpired(now?: Date): Promise<string[]>;
}

export interface StorageInitializer {
  initializeUserStorage(): Promise<InitializationResult>;
  initializeProjectStorage(projectRoot?: string | null): Promise<InitializationResult>;
}
