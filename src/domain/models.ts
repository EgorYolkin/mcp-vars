export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

export type StorageScope = "project" | "user";
export type ToolStatus = "ok" | "not_found" | "error";

export interface ToolResponse {
  status: ToolStatus;
  key: string | null;
  value: unknown;
  message: string;
  scope?: StorageScope;
}

export interface InitializationResult {
  scope: StorageScope;
  dbPath: string;
  created: boolean;
  message: string;
}

export interface VariableRecord {
  key: string;
  value: JSONValue;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface VariableSetItem {
  scope: StorageScope;
  key: string;
  value: JSONValue;
  expiresAt?: string | null;
}

export interface VariableDeleteItem {
  scope: StorageScope;
  key: string;
}

export interface VariableListItem {
  key: string;
  value: JSONValue | null;
}

export interface VariableListResult {
  scope: StorageScope;
  items: VariableListItem[];
}

export interface SnapshotData {
  project: Record<string, JSONValue>;
  user: Record<string, JSONValue>;
}
