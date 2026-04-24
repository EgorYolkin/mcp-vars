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
  warnings?: string[];
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
  revision?: number;
  namespace?: string | null;
  owner?: string | null;
  tags?: string[];
}

export interface VariableSetItem {
  scope: StorageScope;
  key: string;
  value: JSONValue;
  expiresAt?: string | null;
  namespace?: string | null;
  owner?: string | null;
  tags?: string[];
}

export interface VariableDeleteItem {
  scope: StorageScope;
  key: string;
}

export interface VariableListItem {
  key: string;
  value: JSONValue | null;
  revision?: number;
  updatedAt?: string | null;
  expiresAt?: string | null;
  namespace?: string | null;
  owner?: string | null;
  tags?: string[];
}

export interface VariableListResult {
  scope: StorageScope;
  items: VariableListItem[];
}

export interface VariableListFilters {
  prefix?: string | null;
  namespace?: string | null;
  owner?: string | null;
  tag?: string | null;
}

export interface VariableSetOptions {
  expiresAt?: string | null;
  namespace?: string | null;
  owner?: string | null;
  tags?: string[];
  expectedRevision?: number | null;
  expectedUpdatedAt?: string | null;
}

export interface SnapshotData {
  project: Record<string, JSONValue>;
  user: Record<string, JSONValue>;
}
