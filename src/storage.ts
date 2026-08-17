import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HabitStore } from './types.js';

export interface StorageAdapter {
  load(): Promise<HabitStore>;
  save(store: HabitStore): Promise<void>;
  clear(): Promise<void>;
}

export const DEFAULT_STORE: HabitStore = {
  version: 1,
  habits: [],
};

export class FileStorage implements StorageAdapter {
  private filePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else if (process.env.HABIT_CLI_DATA_PATH) {
      this.filePath = process.env.HABIT_CLI_DATA_PATH;
    } else {
      const configDir = path.join(os.homedir(), '.config', 'habit-cli');
      this.filePath = path.join(configDir, 'data.json');
    }
  }

  getFilePath(): string {
    return this.filePath;
  }

  async load(): Promise<HabitStore> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return structuredClone(DEFAULT_STORE);
      }
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as HabitStore;
      return {
        version: parsed.version || 1,
        habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      };
    } catch {
      return structuredClone(DEFAULT_STORE);
    }
  }

  async save(store: HabitStore): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  async clear(): Promise<void> {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}

export class MemoryStorage implements StorageAdapter {
  private store: HabitStore;

  constructor(initialStore?: HabitStore) {
    this.store = initialStore ? structuredClone(initialStore) : structuredClone(DEFAULT_STORE);
  }

  async load(): Promise<HabitStore> {
    return structuredClone(this.store);
  }

  async save(store: HabitStore): Promise<void> {
    this.store = structuredClone(store);
  }

  async clear(): Promise<void> {
    this.store = structuredClone(DEFAULT_STORE);
  }
}
