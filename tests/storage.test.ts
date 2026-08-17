import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoryStorage, FileStorage } from '../src/storage.js';
import { HabitStore } from '../src/types.js';

describe('Storage Adapters', () => {
  it('MemoryStorage loads and saves correctly', async () => {
    const memory = new MemoryStorage();
    const initial = await memory.load();
    expect(initial.habits).toEqual([]);

    const updated: HabitStore = {
      version: 1,
      habits: [
        {
          id: 'h-1',
          title: 'Test',
          frequency: 'daily',
          tags: [],
          createdAt: new Date().toISOString(),
          archived: false,
          history: [],
        },
      ],
    };

    await memory.save(updated);
    const reloaded = await memory.load();
    expect(reloaded.habits.length).toBe(1);
    expect(reloaded.habits[0].title).toBe('Test');

    await memory.clear();
    const cleared = await memory.load();
    expect(cleared.habits).toEqual([]);
  });

  describe('FileStorage', () => {
    const tmpFile = path.join(os.tmpdir(), `habit-cli-test-${Date.now()}.json`);

    afterEach(() => {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    });

    it('FileStorage persists to disk properly', async () => {
      const fileStorage = new FileStorage(tmpFile);
      const initial = await fileStorage.load();
      expect(initial.habits).toEqual([]);

      const updated: HabitStore = {
        version: 1,
        habits: [
          {
            id: 'h-1',
            title: 'File Test',
            frequency: 'daily',
            tags: ['test'],
            createdAt: new Date().toISOString(),
            archived: false,
            history: [],
          },
        ],
      };

      await fileStorage.save(updated);
      expect(fs.existsSync(tmpFile)).toBe(true);

      const reloaded = await fileStorage.load();
      expect(reloaded.habits[0].title).toBe('File Test');

      await fileStorage.clear();
      expect(fs.existsSync(tmpFile)).toBe(false);
    });
  });
});
