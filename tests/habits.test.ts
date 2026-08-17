import { describe, it, expect } from 'vitest';
import { format, subDays, parseISO } from 'date-fns';
import {
  createHabit,
  completeHabit,
  undoHabit,
  deleteHabit,
  findHabit,
  calculateStreak,
  getHabitsWithStreaks,
} from '../src/core/habits.js';
import { HabitStore, Habit } from '../src/types.js';

describe('Habits Core Logic', () => {
  const initialStore: HabitStore = {
    version: 1,
    habits: [],
  };

  it('should create a new habit with auto-generated id', () => {
    const { habit, store } = createHabit(initialStore, {
      title: 'Morning Meditation',
      description: '10 minutes of mindfulness',
      tags: ['health', 'mind'],
    });

    expect(habit.id).toBe('h-1');
    expect(habit.title).toBe('Morning Meditation');
    expect(habit.frequency).toBe('daily');
    expect(habit.tags).toEqual(['health', 'mind']);
    expect(store.habits.length).toBe(1);
  });

  it('should reject empty habit title', () => {
    expect(() => {
      createHabit(initialStore, { title: '   ' });
    }).toThrow('Habit title cannot be empty.');
  });

  it('should reject duplicate active habit titles', () => {
    const { store } = createHabit(initialStore, { title: 'Read Book' });
    expect(() => {
      createHabit(store, { title: 'read book' });
    }).toThrow('already exists');
  });

  it('should find habits by id or case-insensitive title', () => {
    const { habit, store } = createHabit(initialStore, { title: 'Daily Coding' });

    expect(findHabit(store, 'h-1')?.id).toBe(habit.id);
    expect(findHabit(store, 'daily coding')?.id).toBe(habit.id);
    expect(findHabit(store, 'coding')?.id).toBe(habit.id);
    expect(findHabit(store, 'nonexistent')).toBeUndefined();
  });

  describe('Streak Calculation (Daily)', () => {
    const now = new Date('2026-08-17T12:00:00Z');
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
    const twoDaysAgo = format(subDays(now, 2), 'yyyy-MM-dd');
    const threeDaysAgo = format(subDays(now, 3), 'yyyy-MM-dd');
    const fiveDaysAgo = format(subDays(now, 5), 'yyyy-MM-dd');

    it('should return 0 streak for empty history', () => {
      const habit: Habit = {
        id: 'h-1',
        title: 'Workout',
        frequency: 'daily',
        tags: [],
        createdAt: now.toISOString(),
        archived: false,
        history: [],
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.isCompletedToday).toBe(false);
    });

    it('should calculate active streak when completed today', () => {
      const habit: Habit = {
        id: 'h-1',
        title: 'Workout',
        frequency: 'daily',
        tags: [],
        createdAt: now.toISOString(),
        archived: false,
        history: [
          { date: threeDaysAgo, completedAt: '' },
          { date: twoDaysAgo, completedAt: '' },
          { date: yesterday, completedAt: '' },
          { date: today, completedAt: '' },
        ],
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(4);
      expect(streak.longestStreak).toBe(4);
      expect(streak.isCompletedToday).toBe(true);
    });

    it('should preserve streak if completed yesterday but not yet today', () => {
      const habit: Habit = {
        id: 'h-1',
        title: 'Workout',
        frequency: 'daily',
        tags: [],
        createdAt: now.toISOString(),
        archived: false,
        history: [
          { date: twoDaysAgo, completedAt: '' },
          { date: yesterday, completedAt: '' },
        ],
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(2);
      expect(streak.longestStreak).toBe(2);
      expect(streak.isCompletedToday).toBe(false);
    });

    it('should reset current streak to 0 if yesterday was missed', () => {
      const habit: Habit = {
        id: 'h-1',
        title: 'Workout',
        frequency: 'daily',
        tags: [],
        createdAt: now.toISOString(),
        archived: false,
        history: [
          { date: fiveDaysAgo, completedAt: '' },
          { date: threeDaysAgo, completedAt: '' },
          { date: twoDaysAgo, completedAt: '' },
        ],
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(2);
      expect(streak.isCompletedToday).toBe(false);
    });
  });

  describe('Completion & Undo Operations', () => {
    it('should complete habit and be idempotent for the same date', () => {
      const { store } = createHabit(initialStore, { title: 'Drink Water' });
      
      const first = completeHabit(store, 'h-1', { date: '2026-08-17' });
      expect(first.alreadyCompleted).toBe(false);
      expect(first.habit.history.length).toBe(1);

      const second = completeHabit(first.store, 'h-1', { date: '2026-08-17' });
      expect(second.alreadyCompleted).toBe(true);
      expect(second.habit.history.length).toBe(1);
    });

    it('should undo habit completion', () => {
      const { store } = createHabit(initialStore, { title: 'Drink Water' });
      const completed = completeHabit(store, 'h-1', { date: '2026-08-17' });
      
      const undone = undoHabit(completed.store, 'h-1', '2026-08-17');
      expect(undone.removed).toBe(true);
      expect(undone.habit.history.length).toBe(0);

      const undoneAgain = undoHabit(undone.store, 'h-1', '2026-08-17');
      expect(undoneAgain.removed).toBe(false);
    });

    it('should archive or permanently delete habits', () => {
      const { store } = createHabit(initialStore, { title: 'Stretch' });
      
      const archived = deleteHabit(store, 'h-1', false);
      expect(archived.habit.archived).toBe(true);
      expect(getHabitsWithStreaks(archived.store, { showArchived: false }).length).toBe(0);
      expect(getHabitsWithStreaks(archived.store, { showArchived: true }).length).toBe(1);

      const permanent = deleteHabit(archived.store, 'h-1', true);
      expect(permanent.store.habits.length).toBe(0);
    });
  });
});
