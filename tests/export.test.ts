import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { format, subDays } from 'date-fns';
import { buildExport, exportHabits, CSV_HEADERS } from '../src/core/export.js';
import { createHabit, completeHabit, deleteHabit } from '../src/core/habits.js';
import { MemoryStorage } from '../src/storage.js';
import { HabitStore } from '../src/types.js';

describe('Export Module', () => {
  describe('buildExport JSON', () => {
    it('exports empty store as JSON with empty habits array', () => {
      const store: HabitStore = { version: 1, habits: [] };
      const result = buildExport(store, { format: 'json' });
      const parsed = JSON.parse(result);
      expect(parsed.version).toBe(1);
      expect(typeof parsed.exportedAt).toBe('string');
      expect(parsed.habits).toEqual([]);
    });

    it('includes streak stats, history, and metadata for each habit', () => {
      const now = new Date('2026-08-17T12:00:00Z');
      const today = format(now, 'yyyy-MM-dd');
      const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');

      let store: HabitStore = { version: 1, habits: [] };
      const c1 = createHabit(store, { title: 'Read Book', tags: ['learning'] });
      store = c1.store;
      const c2 = completeHabit(store, 'h-1', { date: yesterday });
      store = c2.store;
      const c3 = completeHabit(store, 'h-1', { date: today });
      store = c3.store;

      const result = buildExport(store, { format: 'json', referenceDate: now });
      const parsed = JSON.parse(result);

      expect(parsed.habits.length).toBe(1);
      const habit = parsed.habits[0];
      expect(habit.id).toBe('h-1');
      expect(habit.title).toBe('Read Book');
      expect(habit.tags).toEqual(['learning']);
      expect(habit.frequency).toBe('daily');
      expect(habit.current_streak).toBe(2);
      expect(habit.longest_streak).toBe(2);
      expect(habit.total_completions).toBe(2);
      expect(habit.is_completed_today).toBe(true);
      expect(habit.history.length).toBe(2);
      expect(habit.history.map((h: { date: string }) => h.date)).toEqual([yesterday, today]);
    });

    it('defaults to JSON format when none specified', () => {
      const store: HabitStore = { version: 1, habits: [] };
      const result = buildExport(store);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.habits).toEqual([]);
    });

    it('includes description and archived flag in JSON payload', () => {
      let store: HabitStore = { version: 1, habits: [] };
      const c1 = createHabit(store, { title: 'Stretch', description: '10 min stretch' });
      store = c1.store;
      const archived = deleteHabit(store, 'h-1');

      const result = buildExport(archived.store, {
        format: 'json',
        showArchived: true,
      });
      const parsed = JSON.parse(result);

      expect(parsed.habits[0].description).toBe('10 min stretch');
      expect(parsed.habits[0].archived).toBe(true);
    });
  });

  describe('buildExport CSV', () => {
    it('emits the exact header row from the spec', () => {
      const store: HabitStore = { version: 1, habits: [] };
      const result = buildExport(store, { format: 'csv' });
      const firstLine = result.split('\r\n')[0];
      expect(firstLine).toBe(CSV_HEADERS.join(','));
      expect(firstLine).toBe('id,title,frequency,tags,current_streak,longest_streak,total_completions,created_at');
    });

    it('includes one data row per habit with expected values', () => {
      const now = new Date('2026-08-17T12:00:00Z');
      const today = format(now, 'yyyy-MM-dd');

      let store: HabitStore = { version: 1, habits: [] };
      const c1 = createHabit(store, { title: 'Read Book', tags: ['learning', 'fun'] });
      store = c1.store;
      const c2 = completeHabit(store, 'h-1', { date: today });
      store = c2.store;

      const result = buildExport(store, { format: 'csv', referenceDate: now });
      const lines = result.trim().split('\r\n');
      expect(lines.length).toBe(2);

      const dataRow = lines[1];
      const expectedPrefix = 'h-1,Read Book,daily,"learning,fun",1,1,1,';
      expect(dataRow.startsWith(expectedPrefix)).toBe(true);
    });

    it('escapes commas and double quotes in titles (RFC 4180)', () => {
      const store: HabitStore = { version: 1, habits: [] };
      const { store: withHabit } = createHabit(store, { title: 'Read, "The Book"' });
      const result = buildExport(withHabit, { format: 'csv' });
      const lines = result.trim().split('\r\n');
      expect(lines[1]).toContain('"Read, ""The Book"""');
    });

    it('handles titles containing newlines by quoting and escaping', () => {
      const store: HabitStore = { version: 1, habits: [] };
      const { store: withHabit } = createHabit(store, { title: 'Line1\nLine2' });
      const result = buildExport(withHabit, { format: 'csv' });
      const lines = result.split('\r\n');
      // The title is quoted and the embedded \n is preserved inside quotes
      expect(lines.some(l => l.includes('"Line1\nLine2"'))).toBe(true);
    });

    it('excludes archived habits by default', () => {
      let store: HabitStore = { version: 1, habits: [] };
      const c1 = createHabit(store, { title: 'Active' });
      let s = c1.store;
      const c2 = createHabit(s, { title: 'Archived' });
      s = c2.store;
      const archived = deleteHabit(s, 'h-2');

      const csv = buildExport(archived.store, { format: 'csv' });
      expect(csv).toContain('Active');
      expect(csv).not.toContain('Archived');

      const json = JSON.parse(buildExport(archived.store, { format: 'json' }));
      expect(json.habits.length).toBe(1);
    });

    it('includes archived habits when showArchived is true', () => {
      let store: HabitStore = { version: 1, habits: [] };
      const c1 = createHabit(store, { title: 'Active' });
      let s = c1.store;
      const c2 = createHabit(s, { title: 'Archived' });
      s = c2.store;
      const archived = deleteHabit(s, 'h-2');

      const csv = buildExport(archived.store, { format: 'csv', showArchived: true });
      expect(csv).toContain('Active');
      expect(csv).toContain('Archived');

      const json = JSON.parse(buildExport(archived.store, { format: 'json', showArchived: true }));
      expect(json.habits.length).toBe(2);
    });

    it('renders weekly habits with frequency=weekly', () => {
      const now = new Date('2026-08-17T12:00:00Z');
      let store: HabitStore = { version: 1, habits: [] };
      const c1 = createHabit(store, { title: 'Weekly Review', frequency: 'weekly' });
      store = c1.store;
      const c2 = completeHabit(store, 'h-1', { date: '2026-08-17' });
      store = c2.store;

      const result = buildExport(store, { format: 'csv', referenceDate: now });
      const dataRow = result.trim().split('\r\n')[1];
      expect(dataRow).toContain(',weekly,');
    });
  });

  describe('exportHabits file writing', () => {
    const tmpRoot = path.join(
      os.tmpdir(),
      `habit-export-test-${process.pid}-${Date.now()}`
    );
    const nestedJson = path.join(tmpRoot, 'nested', 'export.json');
    const flatCsv = path.join(tmpRoot, 'export.csv');
    let memory: MemoryStorage;

    beforeEach(async () => {
      memory = new MemoryStorage();
      const c1 = createHabit({ version: 1, habits: [] }, { title: 'Persisted Habit' });
      await memory.save(c1.store);
    });

    afterEach(() => {
      if (fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('writes JSON content to destination file and reports writtenTo', async () => {
      const result = await exportHabits(memory, { format: 'json', destination: flatCsv + '.json' });

      expect(result.writtenTo).toBe(flatCsv + '.json');
      expect(result.bytes).toBeGreaterThan(0);
      expect(fs.existsSync(result.writtenTo!)).toBe(true);

      const reloaded = JSON.parse(fs.readFileSync(result.writtenTo!, 'utf-8'));
      expect(reloaded.habits[0].title).toBe('Persisted Habit');
    });

    it('writes CSV content to destination file with correct headers', async () => {
      const result = await exportHabits(memory, { format: 'csv', destination: flatCsv });

      expect(result.writtenTo).toBe(flatCsv);
      expect(fs.existsSync(flatCsv)).toBe(true);

      const content = fs.readFileSync(flatCsv, 'utf-8');
      const firstLine = content.split('\r\n')[0];
      expect(firstLine).toBe('id,title,frequency,tags,current_streak,longest_streak,total_completions,created_at');
      expect(content).toContain('Persisted Habit');
    });

    it('creates missing intermediate directories automatically', async () => {
      const result = await exportHabits(memory, { format: 'json', destination: nestedJson });

      expect(result.writtenTo).toBe(nestedJson);
      expect(fs.existsSync(nestedJson)).toBe(true);
      expect(fs.statSync(path.dirname(nestedJson)).isDirectory()).toBe(true);
    });

    it('returns content and omits writtenTo when no destination is given', async () => {
      const result = await exportHabits(memory, { format: 'json' });

      expect(result.writtenTo).toBeUndefined();
      expect(result.content).toContain('Persisted Habit');
      expect(result.bytes).toBeGreaterThan(0);
      expect(result.bytes).toBe(Buffer.byteLength(result.content, 'utf-8'));
    });

    it('reports habitCount consistent with showArchived flag', async () => {
      const c2 = createHabit(
        (await memory.load()),
        { title: 'Archived Habit' }
      );
      await memory.save(c2.store);
      const archived = deleteHabit(await memory.load(), 'h-2');
      await memory.save(archived.store);

      const activeOnly = await exportHabits(memory, { format: 'json' });
      expect(activeOnly.habitCount).toBe(1);

      const withArchived = await exportHabits(memory, { format: 'json', showArchived: true });
      expect(withArchived.habitCount).toBe(2);
    });
  });
});