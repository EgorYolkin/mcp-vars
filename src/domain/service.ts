import {
  JSONValue,
  SnapshotData,
  StorageScope,
  ToolResponse,
  VariableDeleteItem,
  VariableListFilters,
  VariableListResult,
  VariableSetItem,
  VariableSetOptions,
} from "./models";
import { VariableError, VariableValidationError } from "./errors";
import {
  ensureObjectValue,
  shallowMerge,
  validateExpiresAt,
  validateJsonValue,
  validateKey,
  validateNamespace,
  validateOwner,
  validateScope,
  validateTags,
} from "./validation";
import { VariableStore } from "../storage/store";

export interface ScopedStores {
  user: VariableStore;
  project: VariableStore | null;
}

export interface VariableServiceOptions {
  allowSecretLikeValues?: boolean;
}

export class VariableService {
  private readonly stores: ScopedStores;
  private readonly allowSecretLikeValues: boolean;

  constructor(stores: ScopedStores, options: VariableServiceOptions = {}) {
    this.stores = stores;
    this.allowSecretLikeValues = options.allowSecretLikeValues ?? false;
  }

  async get(key: string, scope?: string | null): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const record = await this.storeFor(resolvedScope).get(resolvedKey);
      if (record == null || (await this.deleteIfExpired(resolvedScope, record))) {
        return {
          status: "not_found",
          key: resolvedKey,
          value: null,
          scope: resolvedScope,
          message: `Variable '${resolvedKey}' was not found in scope '${resolvedScope}'.`,
        };
      }
      return {
        status: "ok",
        key: resolvedKey,
        value: record.value,
        scope: resolvedScope,
        warnings: recordWarning(record),
        message: `Loaded variable '${resolvedKey}'.`,
      };
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async set(
    key: string,
    value: unknown,
    scope?: string | null,
    expiresAt?: string | null,
    metadata: Omit<VariableSetOptions, "expiresAt" | "expectedRevision" | "expectedUpdatedAt"> = {},
  ): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const validatedValue = validateJsonValue(value);
      const warnings = this.validateSecretGuard(resolvedKey, validatedValue);
      const record = await this.storeFor(resolvedScope).set(
        resolvedKey,
        validatedValue,
        this.validateSetOptions({ ...metadata, expiresAt }),
      );
      return {
        status: "ok",
        key: resolvedKey,
        value: record.value,
        scope: resolvedScope,
        warnings,
        message: `Stored variable '${resolvedKey}'.`,
      };
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async patch(
    key: string,
    patch: Record<string, JSONValue>,
    scope?: string | null,
  ): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const validatedPatch = ensureObjectValue(
        validateJsonValue(patch),
        "patch",
      );
      const store = this.storeFor(resolvedScope);
      const current = await store.get(resolvedKey);
      if (current == null || (await this.deleteIfExpired(resolvedScope, current))) {
        return {
          status: "not_found",
          key: resolvedKey,
          value: null,
          scope: resolvedScope,
          message: `Variable '${resolvedKey}' was not found in scope '${resolvedScope}'.`,
        };
      }
      const currentValue = ensureObjectValue(current.value, "patch");
      const mergedValue = shallowMerge(currentValue, validatedPatch);
      const updated = await store.set(resolvedKey, mergedValue, current);
      return {
        status: "ok",
        key: resolvedKey,
        value: updated.value,
        scope: resolvedScope,
        message: `Patched variable '${resolvedKey}'.`,
      };
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async delete(key: string, scope?: string | null): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const deleted = await this.storeFor(resolvedScope).delete(resolvedKey);
      if (deleted == null) {
        return {
          status: "not_found",
          key: resolvedKey,
          value: null,
          scope: resolvedScope,
          message: `Variable '${resolvedKey}' was not found in scope '${resolvedScope}'.`,
        };
      }
      return {
        status: "ok",
        key: resolvedKey,
        value: null,
        scope: resolvedScope,
        message: `Deleted variable '${resolvedKey}'.`,
      };
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async list(scope?: string | null, prefix?: string | null): Promise<ToolResponse> {
    return this.listFiltered(scope, { prefix });
  }

  async listFiltered(scope?: string | null, filters: VariableListFilters = {}): Promise<ToolResponse> {
    const resolvedScope = validateScope(scope);
    const resolvedPrefix = filters.prefix ? validateKey(filters.prefix) : null;
    const namespace = validateNamespace(filters.namespace);
    const owner = validateOwner(filters.owner);
    const tag = filters.tag ? validateTags([filters.tag])[0] : null;
    try {
      await this.storeFor(resolvedScope).cleanupExpired();
      const records = await this.storeFor(resolvedScope).list(resolvedPrefix);
      const filteredRecords = records.filter((record) => {
        if (namespace != null && (record.namespace ?? "shared") !== namespace) {
          return false;
        }
        if (owner != null && record.owner !== owner) {
          return false;
        }
        if (tag != null && !(record.tags ?? []).includes(tag)) {
          return false;
        }
        return true;
      });
      const payload: VariableListResult = {
        scope: resolvedScope,
        items: filteredRecords.map((record) => ({
          key: record.key,
          value: record.value,
          revision: record.revision,
          updatedAt: record.updatedAt,
          expiresAt: record.expiresAt,
          namespace: record.namespace ?? "shared",
          owner: record.owner ?? null,
          tags: [...(record.tags ?? [])],
        })),
      };
      return {
        status: "ok",
        key: resolvedPrefix,
        value: payload,
        scope: resolvedScope,
        message: `Listed ${filteredRecords.length} variable(s) in scope '${resolvedScope}'.`,
      };
    } catch (error) {
      return this.errorResponse(resolvedPrefix, resolvedScope, error);
    }
  }

  async bulkSet(items: VariableSetItem[]): Promise<ToolResponse> {
    const groupedItems: Record<StorageScope, VariableSetItem[]> = {
      project: [],
      user: [],
    };

    for (const item of items) {
      const value = validateJsonValue(item.value);
      this.validateSecretGuard(item.key, value);
      groupedItems[validateScope(item.scope)].push({
        scope: validateScope(item.scope),
        key: validateKey(item.key),
        value,
        expiresAt: validateExpiresAt(item.expiresAt),
        namespace: validateNamespace(item.namespace) ?? "shared",
        owner: validateOwner(item.owner),
        tags: validateTags(item.tags),
      });
    }

    try {
      const records = [];
      for (const scope of ["project", "user"] as const) {
        if (groupedItems[scope].length > 0) {
          records.push(...(await this.storeFor(scope).bulkSet(groupedItems[scope])));
        }
      }
      return {
        status: "ok",
        key: null,
        value: records,
        message: `Stored ${records.length} variable(s).`,
      };
    } catch (error) {
      return this.errorResponse(null, undefined, error);
    }
  }

  async bulkDelete(items: VariableDeleteItem[]): Promise<ToolResponse> {
    const groupedKeys: Record<StorageScope, string[]> = {
      project: [],
      user: [],
    };

    for (const item of items) {
      groupedKeys[validateScope(item.scope)].push(validateKey(item.key));
    }

    try {
      const deletedKeys = [];
      for (const scope of ["project", "user"] as const) {
        if (groupedKeys[scope].length > 0) {
          deletedKeys.push(...(await this.storeFor(scope).bulkDelete(groupedKeys[scope])));
        }
      }
      return {
        status: "ok",
        key: null,
        value: deletedKeys,
        message: `Deleted ${deletedKeys.length} variable(s).`,
      };
    } catch (error) {
      return this.errorResponse(null, undefined, error);
    }
  }

  async exportSnapshot(): Promise<ToolResponse> {
    try {
      if (this.stores.project) {
        await this.storeFor("project").cleanupExpired();
      }
      await this.storeFor("user").cleanupExpired();
      const snapshot: SnapshotData = {
        project: this.stores.project ? await this.storeFor("project").exportSnapshot() : {},
        user: await this.storeFor("user").exportSnapshot(),
      };
      return {
        status: "ok",
        key: null,
        value: snapshot,
        message: "Exported snapshot.",
      };
    } catch (error) {
      return this.errorResponse(null, undefined, error);
    }
  }

  async importSnapshot(data: SnapshotData): Promise<ToolResponse> {
    try {
      for (const [key, value] of Object.entries({ ...data.project, ...data.user })) {
        validateKey(key);
        this.validateSecretGuard(key, validateJsonValue(value));
      }
      const snapshot: SnapshotData = {
        project: this.stores.project
          ? await this.storeFor("project").importSnapshot(data.project)
          : {},
        user: await this.storeFor("user").importSnapshot(data.user),
      };
      return {
        status: "ok",
        key: null,
        value: snapshot,
        message: "Imported snapshot.",
      };
    } catch (error) {
      return this.errorResponse(null, undefined, error);
    }
  }

  async cleanupExpired(scope?: string | null): Promise<ToolResponse> {
    const resolvedScope = validateScope(scope);
    try {
      const deleted = await this.storeFor(resolvedScope).cleanupExpired();
      return {
        status: "ok",
        key: null,
        value: deleted,
        scope: resolvedScope,
        message: `Deleted ${deleted.length} expired variable(s) in scope '${resolvedScope}'.`,
      };
    } catch (error) {
      return this.errorResponse(null, resolvedScope, error);
    }
  }

  async setIfVersion(
    key: string,
    value: unknown,
    scope: string | null | undefined,
    expectedRevision?: number | null,
    expectedUpdatedAt?: string | null,
    expiresAt?: string | null,
    metadata: Omit<VariableSetOptions, "expiresAt" | "expectedRevision" | "expectedUpdatedAt"> = {},
  ): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const store = this.storeFor(resolvedScope);
      const current = await store.get(resolvedKey);
      if (current == null || (await this.deleteIfExpired(resolvedScope, current))) {
        return notFound(resolvedKey, resolvedScope);
      }
      const conflict = versionConflict(current, expectedRevision, expectedUpdatedAt);
      if (conflict) {
        return conflictResponse(resolvedKey, resolvedScope, conflict);
      }
      return this.set(resolvedKey, value, resolvedScope, expiresAt, metadata);
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async patchIfVersion(
    key: string,
    patch: Record<string, JSONValue>,
    scope: string | null | undefined,
    expectedRevision?: number | null,
    expectedUpdatedAt?: string | null,
  ): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const store = this.storeFor(resolvedScope);
      const current = await store.get(resolvedKey);
      if (current == null || (await this.deleteIfExpired(resolvedScope, current))) {
        return notFound(resolvedKey, resolvedScope);
      }
      const conflict = versionConflict(current, expectedRevision, expectedUpdatedAt);
      if (conflict) {
        return conflictResponse(resolvedKey, resolvedScope, conflict);
      }
      return this.patch(resolvedKey, patch, resolvedScope);
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async increment(key: string, delta = 1, scope?: string | null): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const store = this.storeFor(resolvedScope);
      const current = await store.get(resolvedKey);
      const expired = current != null && (await this.deleteIfExpired(resolvedScope, current));
      const currentValue = current == null || expired
        ? 0
        : current.value;
      if (typeof currentValue !== "number") {
        throw new VariableValidationError("increment requires a numeric current value.");
      }
      const updated = await store.set(resolvedKey, currentValue + delta, expired ? undefined : current ?? undefined);
      return ok(resolvedKey, resolvedScope, updated.value, `Incremented variable '${resolvedKey}'.`, updated);
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async append(key: string, item: unknown, scope?: string | null): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const store = this.storeFor(resolvedScope);
      const current = await store.get(resolvedKey);
      const expired = current != null && (await this.deleteIfExpired(resolvedScope, current));
      const currentValue = current == null || expired
        ? []
        : current.value;
      if (!Array.isArray(currentValue)) {
        throw new VariableValidationError("append requires the current value to be an array.");
      }
      const value = validateJsonValue(item);
      const updated = await store.set(resolvedKey, [...currentValue, value], expired ? undefined : current ?? undefined);
      return ok(resolvedKey, resolvedScope, updated.value, `Appended to variable '${resolvedKey}'.`, updated);
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  async removeFromArray(key: string, item: unknown, scope?: string | null): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const store = this.storeFor(resolvedScope);
      const current = await store.get(resolvedKey);
      if (current == null || (await this.deleteIfExpired(resolvedScope, current))) {
        return notFound(resolvedKey, resolvedScope);
      }
      if (!Array.isArray(current.value)) {
        throw new VariableValidationError("remove_from_array requires the current value to be an array.");
      }
      const value = validateJsonValue(item);
      const updatedValue = current.value.filter((entry) => JSON.stringify(entry) !== JSON.stringify(value));
      const updated = await store.set(resolvedKey, updatedValue, current);
      return ok(resolvedKey, resolvedScope, updated.value, `Removed item(s) from variable '${resolvedKey}'.`, updated);
    } catch (error) {
      return this.errorResponse(resolvedKey, resolvedScope, error);
    }
  }

  private validateIdentity(scope: string | null | undefined, key: string): [StorageScope, string] {
    return [validateScope(scope), validateKey(key)];
  }

  private storeFor(scope: StorageScope): VariableStore {
    if (scope === "project") {
      if (this.stores.project == null) {
        throw new VariableValidationError(
          "Project scope is not initialized. Run project initialization first.",
        );
      }
      return this.stores.project;
    }
    return this.stores.user;
  }

  private errorResponse(
    key: string | null,
    scope: StorageScope | undefined,
    error: unknown,
  ): ToolResponse {
    if (error instanceof VariableValidationError || error instanceof VariableError) {
      return {
        status: "error",
        key,
        value: null,
        scope,
        message: error.message,
      };
    }

    return {
      status: "error",
      key,
      value: null,
      scope,
      message: `Unexpected storage error: ${String(error)}`,
    };
  }

  private async deleteIfExpired(scope: StorageScope, record: { key: string; expiresAt?: string | null }): Promise<boolean> {
    if (record.expiresAt == null || new Date(record.expiresAt).getTime() > Date.now()) {
      return false;
    }
    await this.storeFor(scope).delete(record.key);
    return true;
  }

  private validateSetOptions(options: VariableSetOptions): VariableSetOptions {
    return {
      expiresAt: validateExpiresAt(options.expiresAt),
      namespace: validateNamespace(options.namespace) ?? "shared",
      owner: validateOwner(options.owner),
      tags: validateTags(options.tags),
    };
  }

  private validateSecretGuard(key: string, value: JSONValue): string[] {
    if (this.allowSecretLikeValues) {
      return [];
    }
    const haystack = `${key}\n${JSON.stringify(value)}`;
    if (SECRET_LIKE_PATTERN.test(haystack)) {
      throw new VariableValidationError(
        "Value looks like a secret. Store secrets in a secret manager, or set MCP_VARS_ALLOW_SECRET_LIKE_VALUES=true to bypass this guardrail.",
      );
    }
    return [];
  }
}

const SECRET_LIKE_PATTERN =
  /(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|private[_-]?key|sk-[a-z0-9_-]{16,}|ghp_[a-z0-9_]{16,})/i;

function recordWarning(record: { expiresAt?: string | null }): string[] | undefined {
  if (record.expiresAt == null) {
    return undefined;
  }
  return [`Variable expires at ${record.expiresAt}.`];
}

function ok(
  key: string,
  scope: StorageScope,
  value: unknown,
  message: string,
  record?: { revision?: number; updatedAt?: string | null },
): ToolResponse {
  return {
    status: "ok",
    key,
    value,
    scope,
    message,
    warnings: record?.revision ? [`revision=${record.revision}, updatedAt=${record.updatedAt}`] : undefined,
  };
}

function notFound(key: string, scope: StorageScope): ToolResponse {
  return {
    status: "not_found",
    key,
    value: null,
    scope,
    message: `Variable '${key}' was not found in scope '${scope}'.`,
  };
}

function versionConflict(
  record: { revision?: number; updatedAt?: string | null },
  expectedRevision?: number | null,
  expectedUpdatedAt?: string | null,
): string | null {
  if (expectedRevision != null && record.revision !== expectedRevision) {
    return `Expected revision ${expectedRevision}, found ${record.revision ?? 0}.`;
  }
  if (expectedUpdatedAt != null && record.updatedAt !== expectedUpdatedAt) {
    return `Expected updatedAt ${expectedUpdatedAt}, found ${record.updatedAt ?? null}.`;
  }
  return null;
}

function conflictResponse(key: string, scope: StorageScope, message: string): ToolResponse {
  return {
    status: "error",
    key,
    value: null,
    scope,
    message: `Version conflict for variable '${key}': ${message}`,
  };
}
