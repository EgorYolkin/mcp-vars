import {
  JSONValue,
  SnapshotData,
  StorageScope,
  ToolResponse,
  VariableDeleteItem,
  VariableListResult,
  VariableSetItem,
} from "./models";
import { VariableError, VariableValidationError } from "./errors";
import {
  ensureObjectValue,
  shallowMerge,
  validateExpiresAt,
  validateJsonValue,
  validateKey,
  validateScope,
} from "./validation";
import { VariableStore } from "../storage/store";

export interface ScopedStores {
  user: VariableStore;
  project: VariableStore | null;
}

export class VariableService {
  private readonly stores: ScopedStores;

  constructor(stores: ScopedStores) {
    this.stores = stores;
  }

  async get(key: string, scope?: string | null): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const record = await this.storeFor(resolvedScope).get(resolvedKey);
      if (record == null) {
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
  ): Promise<ToolResponse> {
    const [resolvedScope, resolvedKey] = this.validateIdentity(scope, key);
    try {
      const record = await this.storeFor(resolvedScope).set(
        resolvedKey,
        validateJsonValue(value),
        validateExpiresAt(expiresAt),
      );
      return {
        status: "ok",
        key: resolvedKey,
        value: record.value,
        scope: resolvedScope,
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
      if (current == null) {
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
      const updated = await store.set(
        resolvedKey,
        mergedValue,
        current.expiresAt,
      );
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
    const resolvedScope = validateScope(scope);
    const resolvedPrefix = prefix ? validateKey(prefix) : null;
    try {
      const records = await this.storeFor(resolvedScope).list(resolvedPrefix);
      const payload: VariableListResult = {
        scope: resolvedScope,
        items: records.map((record) => ({ key: record.key, value: record.value })),
      };
      return {
        status: "ok",
        key: resolvedPrefix,
        value: payload,
        scope: resolvedScope,
        message: `Listed ${records.length} variable(s) in scope '${resolvedScope}'.`,
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
      groupedItems[validateScope(item.scope)].push({
        scope: validateScope(item.scope),
        key: validateKey(item.key),
        value: validateJsonValue(item.value),
        expiresAt: validateExpiresAt(item.expiresAt),
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
}
