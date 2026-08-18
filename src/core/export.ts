import fs from 'node:fs';
import path from 'node:path';
import { HabitStore, HabitWithStreak } from '../types.js';
import { getHabitsWithStreaks } from './habits.js';
import { StorageAdapter } from '../storage.js';

export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
  format?: ExportFormat;
  showArchived?: boolean;
  referenceDate?: Date;
}

export interface ExportResult {
  format: ExportFormat;
  content: string;
  habitCount: number;
  bytes: number;
  writtenTo?: string;
}

export const CSV_HEADERS = [
  'id',
  'title',
  'frequency',
  'tags',
  'current_streak',
  'longest_streak',
  'total_completions',
  'created_at',
] as const;

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildJson(habits: HabitWithStreak[]): string {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    habits: habits.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description ?? null,
      frequency: h.frequency,
      tags: h.tags,
      createdAt: h.createdAt,
      archived: h.archived,
      current_streak: h.streak.currentStreak,
      longest_streak: h.streak.longestStreak,
      total_completions: h.history.length,
      is_completed_today: h.streak.isCompletedToday,
      history: h.history,
    })),
  };
  return JSON.stringify(payload, null, 2) + '\n';
}

function buildCsv(habits: HabitWithStreak[]): string {
  const rows: string[] = [];
  rows.push(CSV_HEADERS.join(','));
  for (const h of habits) {
    const fields: (string | number)[] = [
      h.id,
      h.title,
      h.frequency,
      h.tags.join(','),
      h.streak.currentStreak,
      h.streak.longestStreak,
      h.history.length,
      h.createdAt,
    ];
    rows.push(fields.map(escapeCsvField).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}

/**
 * Pure data transformation: HabitStore → export string (JSON or CSV).
 * No I/O. No side effects.
 */
export function buildExport(store: HabitStore, options: ExportOptions = {}): string {
  const format: ExportFormat = options.format === 'csv' ? 'csv' : 'json';
  const habits = getHabitsWithStreaks(
    store,
    { showArchived: options.showArchived },
    options.referenceDate ?? new Date()
  );
  return format === 'csv' ? buildCsv(habits) : buildJson(habits);
}

/**
 * Orchestrator: loads store via storage adapter, builds export content,
 * and writes it to a destination file (if provided) or returns it for stdout.
 */
export async function exportHabits(
  storage: StorageAdapter,
  options: ExportOptions & { destination?: string } = {}
): Promise<ExportResult> {
  const format: ExportFormat = options.format === 'csv' ? 'csv' : 'json';
  const store = await storage.load();
  const content = buildExport(store, options);
  const habitCount = store.habits.filter(
    h => options.showArchived || !h.archived
  ).length;
  const bytes = Buffer.byteLength(content, 'utf-8');

  if (options.destination) {
    const dir = path.dirname(options.destination);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(options.destination, content, 'utf-8');
    return { format, content, habitCount, bytes, writtenTo: options.destination };
  }

  return { format, content, habitCount, bytes };
}