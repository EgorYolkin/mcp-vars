import { JSONValue, VariableRecord, VariableSetItem } from "../domain/models";
import { VariableStore } from "./store";

export class LazyVariableStore implements VariableStore {
  private readonly factory: () => VariableStore;
  private store: VariableStore | null = null;

  constructor(factory: () => VariableStore) {
    this.factory = factory;
  }

  async get(key: string): Promise<VariableRecord | null> {
    return this.getStore().get(key);
  }

  async set(
    key: string,
    value: JSONValue,
    expiresAt?: string | null,
  ): Promise<VariableRecord> {
    return this.getStore().set(key, value, expiresAt);
  }

  async delete(key: string): Promise<VariableRecord | null> {
    return this.getStore().delete(key);
  }

  async list(prefix?: string | null): Promise<VariableRecord[]> {
    return this.getStore().list(prefix);
  }

  async bulkSet(items: VariableSetItem[]): Promise<VariableRecord[]> {
    return this.getStore().bulkSet(items);
  }

  async bulkDelete(keys: string[]): Promise<string[]> {
    return this.getStore().bulkDelete(keys);
  }

  async exportSnapshot(): Promise<Record<string, JSONValue>> {
    return this.getStore().exportSnapshot();
  }

  async importSnapshot(data: Record<string, JSONValue>): Promise<Record<string, JSONValue>> {
    return this.getStore().importSnapshot(data);
  }

  private getStore(): VariableStore {
    if (this.store == null) {
      this.store = this.factory();
    }
    return this.store;
  }
}
