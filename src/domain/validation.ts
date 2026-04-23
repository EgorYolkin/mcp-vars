import { JSONValue, StorageScope } from "./models";
import { VariableValidationError } from "./errors";

const KEY_PATTERN = /^[a-z0-9._-]+$/;
const VALID_SCOPES = new Set<StorageScope>(["project", "user"]);

export function validateScope(scope?: string | null): StorageScope {
  const resolved = (scope ?? "project") as StorageScope;
  if (!VALID_SCOPES.has(resolved)) {
    throw new VariableValidationError(
      `Invalid scope '${resolved}'. Use 'project' or 'user'.`,
    );
  }
  return resolved;
}

export function validateKey(key: string): string {
  if (!key) {
    throw new VariableValidationError("Key must not be empty.");
  }
  if (!KEY_PATTERN.test(key)) {
    throw new VariableValidationError(
      "Key must match pattern [a-z0-9._-] and use dot-notation only.",
    );
  }
  return key;
}

export function validateJsonValue(value: unknown): JSONValue {
  if (isJsonNative(value)) {
    return value;
  }
  throw new VariableValidationError(
    "Value must use JSON-native types only: string, number, boolean, null, array, object.",
  );
}

export function validateExpiresAt(expiresAt?: string | null): string | null {
  if (expiresAt == null) {
    return null;
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new VariableValidationError("expires_at must be timezone-aware.");
  }

  // Timezone-aware ISO strings always contain Z or an explicit offset.
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(expiresAt)) {
    throw new VariableValidationError("expires_at must be timezone-aware.");
  }

  return parsed.toISOString();
}

export function ensureObjectValue(
  value: JSONValue,
  operation: string,
): Record<string, JSONValue> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new VariableValidationError(
      `${operation} requires the current value to be an object.`,
    );
  }
  return value;
}

export function shallowMerge(
  current: Record<string, JSONValue>,
  patch: Record<string, JSONValue>,
): Record<string, JSONValue> {
  validateJsonValue(patch);
  return { ...current, ...patch };
}

function isJsonNative(value: unknown): value is JSONValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonNative(item));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).every(
      ([key, item]) => typeof key === "string" && isJsonNative(item),
    );
  }

  return false;
}
