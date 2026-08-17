import { describe, it, expect } from 'vitest';
import { calculateStats } from '../src/core/stats.js';
import { createHabit, completeHabit } from '../src/core/habits.js';
import { HabitStore } from '../src/types.js';

describe('Stats Analytics', () => {
  it('should compute zero stats for empty store', () => {
    const store: HabitStore = { version: 1, habits: [] };
    const stats = calculateStats(store);

    expect(stats.totalHabits).toBe(0);
    expect(stats.activeHabits).toBe(0);
    expect(stats.completedToday).toBe(0);
    expect(stats.completionRateToday).toBe(0);
    expect(stats.totalCompletions).toBe(0);
    expect(stats.topStreaks).toEqual([]);
  });

  it('should compute accurate stats and rankings for active habits', () => {
    let store: HabitStore = { version: 1, habits: [] };
    const now = new Date('2026-08-17T12:00:00Z');
    const today = '2026-08-17';
    const yesterday = '2026-08-16';

    const h1 = createHabit(store, { title: 'Habit One' });
    store = h1.store;
    const h2 = createHabit(store, { title: 'Habit Two' });
    store = h2.store;

    // Complete habit 1 yesterday & today -> streak 2
    store = completeHabit(store, 'h-1', { date: yesterday }).store;
    store = completeHabit(store, 'h-1', { date: today }).store;

    // Complete habit 2 only today -> streak 1
    store = completeHabit(store, 'h-2', { date: today }).store;

    const stats = calculateStats(store, now);

    expect(stats.totalHabits).toBe(2);
    expect(stats.activeHabits).toBe(2);
    expect(stats.completedToday).toBe(2);
    expect(stats.completionRateToday).toBe(100);
    expect(stats.totalCompletions).toBe(3);
    expect(stats.topStreaks[0].title).toBe('Habit One');
    expect(stats.topStreaks[0].currentStreak).toBe(2);
    expect(stats.topStreaks[1].title).toBe('Habit Two');
    expect(stats.topStreaks[1].currentStreak).toBe(1);
  });
});
