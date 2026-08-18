import { describe, it, expect } from 'vitest';
import { format, subDays, parseISO, addDays } from 'date-fns';
import {
  createHabit,
  completeHabit,
  undoHabit,
  deleteHabit,
  findHabit,
  calculateStreak,
  getHabitsWithStreaks,
  freezeHabit,
  unfreezeHabit,
  isHabitFrozen,
  getActiveFrozenDates,
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

    // Reproduces GitHub issue #1: streak should evaluate correctly even when
    // check-ins were inserted in a non-chronological order.
    it('should calculate active streak regardless of non-chronological insertions', () => {
      const habit: Habit = {
        id: 'h-1',
        title: 'Drink Water',
        frequency: 'daily',
        tags: [],
        createdAt: now.toISOString(),
        archived: false,
        // Insertion order: yesterday, 3 days ago, 2 days ago (not chronological).
        history: [
          { date: yesterday, completedAt: '' },
          { date: threeDaysAgo, completedAt: '' },
          { date: twoDaysAgo, completedAt: '' },
        ],
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(3);
      expect(streak.isCompletedToday).toBe(false);
    });

    it('should calculate active streak when insertions are fully reverse-chronological', () => {
      const habit: Habit = {
        id: 'h-1',
        title: 'Drink Water',
        frequency: 'daily',
        tags: [],
        createdAt: now.toISOString(),
        archived: false,
        // Insertion order: today, yesterday, 2 days ago, 3 days ago (reverse).
        history: [
          { date: today, completedAt: '' },
          { date: yesterday, completedAt: '' },
          { date: twoDaysAgo, completedAt: '' },
          { date: threeDaysAgo, completedAt: '' },
        ],
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(4);
      expect(streak.longestStreak).toBe(4);
      expect(streak.isCompletedToday).toBe(true);
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

  describe('Streak Freeze / Vacation Mode', () => {
    const now = new Date('2026-08-17T12:00:00Z');
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');

    const makeHabitWithHistory = (historyDates: string[]): Habit => ({
      id: 'h-1',
      title: 'Workout',
      frequency: 'daily',
      tags: [],
      createdAt: now.toISOString(),
      archived: false,
      history: historyDates.map(date => ({ date, completedAt: '' })),
      freezesUsed: 0,
      frozenUntil: undefined,
    });

    it('freezeHabit sets frozenUntil and increments freezesUsed', () => {
      const { store } = createHabit(initialStore, { title: 'Read Book' });
      const frozen = freezeHabit(store, 'h-1', { days: 3 }, now);

      expect(frozen.store.habits[0].frozenUntil).toBe(format(addDays(now, 2), 'yyyy-MM-dd'));
      expect(frozen.store.habits[0].freezesUsed).toBe(1);
      expect(frozen.habits[0].frozenUntil).toBe(frozen.store.habits[0].frozenUntil);
    });

    it('freezeHabit defaults to 1 day when days omitted', () => {
      const { store } = createHabit(initialStore, { title: 'Read Book' });
      const frozen = freezeHabit(store, 'h-1', {}, now);
      expect(frozen.store.habits[0].frozenUntil).toBe(today);
      expect(frozen.store.habits[0].freezesUsed).toBe(1);
    });

    it('freezeHabit rejects days counts below 1', () => {
      const { store } = createHabit(initialStore, { title: 'Read Book' });
      expect(() => freezeHabit(store, 'h-1', { days: 0 }, now)).toThrow(/at least 1/);
      expect(() => freezeHabit(store, 'h-1', { days: -2 }, now)).toThrow(/at least 1/);
    });

    it('freezeHabit throws when no habit matches', () => {
      const { store } = createHabit(initialStore, { title: 'Read Book' });
      expect(() => freezeHabit(store, 'nope', {}, now)).toThrow(/Habit not found/);
    });

    it('freezeHabit applies to every active habit when target is "all"', () => {
      let store: HabitStore = { version: 1, habits: [] };
      store = createHabit(store, { title: 'Habit One' }).store;
      store = createHabit(store, { title: 'Habit Two' }).store;
      const archived = deleteHabit(store, 'h-2');

      const frozen = freezeHabit(archived.store, 'all', { days: 2 }, now);
      expect(frozen.store.habits.length).toBe(2);
      expect(frozen.store.habits[0].frozenUntil).toBe(format(addDays(now, 1), 'yyyy-MM-dd'));
      expect(frozen.store.habits[1].archived).toBe(true); // archived untouched
      expect(frozen.store.habits[1].frozenUntil).toBeUndefined();
      expect(frozen.habits.length).toBe(1); // only active habits reported back
    });

    it('unfreezeHabit clears frozenUntil but keeps freezesUsed counter', () => {
      const { store } = createHabit(initialStore, { title: 'Read Book' });
      const frozen = freezeHabit(store, 'h-1', { days: 5 }, now);
      const unfrozen = unfreezeHabit(frozen.store, 'h-1', now);

      expect(unfrozen.store.habits[0].frozenUntil).toBeUndefined();
      expect(unfrozen.store.habits[0].freezesUsed).toBe(1);
    });

    it('unfreezeHabit "all" only touches currently frozen habits', () => {
      let store: HabitStore = { version: 1, habits: [] };
      store = createHabit(store, { title: 'Frozen' }).store;
      store = createHabit(store, { title: 'Not Frozen' }).store;
      store = freezeHabit(store, 'h-1', { days: 3 }, now).store;

      const result = unfreezeHabit(store, 'all', now);
      expect(result.store.habits[0].frozenUntil).toBeUndefined();
      expect(result.store.habits[0].freezesUsed).toBe(1);
      expect(result.store.habits[1].frozenUntil).toBeUndefined();
      expect(result.store.habits[1].freezesUsed).toBe(0);
      expect(result.habits.length).toBe(1);
    });

    it('isHabitFrozen reports true only while frozenUntil is in the future', () => {
      const habit = makeHabitWithHistory([]);
      expect(isHabitFrozen(habit, now)).toBe(false);

      const frozen: Habit = { ...habit, frozenUntil: today };
      expect(isHabitFrozen(frozen, now)).toBe(true);

      const expired: Habit = { ...habit, frozenUntil: yesterday };
      expect(isHabitFrozen(expired, now)).toBe(false);
    });

    it('getActiveFrozenDates returns today through frozenUntil inclusive', () => {
      const habit: Habit = {
        ...makeHabitWithHistory([]),
        frozenUntil: format(addDays(now, 2), 'yyyy-MM-dd'),
      };
      expect(getActiveFrozenDates(habit, now)).toEqual([
        today,
        format(addDays(now, 1), 'yyyy-MM-dd'),
        format(addDays(now, 2), 'yyyy-MM-dd'),
      ]);
    });

    it('streak survives a single-day freeze with no check-in today', () => {
      // User completed yesterday + 3 earlier days. They forgot today and froze it.
      const habit: Habit = {
        ...makeHabitWithHistory([
          format(subDays(now, 3), 'yyyy-MM-dd'),
          format(subDays(now, 2), 'yyyy-MM-dd'),
          yesterday,
        ]),
        frozenUntil: today,
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(4); // 3 history entries + frozen today bridges
      expect(streak.isCompletedToday).toBe(false); // no actual log
    });

    it('multi-day freeze window still bridges today when earliest entry is yesterday', () => {
      // 5 history entries ending yesterday, then a 3-day freeze window
      // (today...today+2). The back-walk only benefits from today being
      // frozen; the future frozen days cannot pre-cast completion.
      const habit: Habit = {
        ...makeHabitWithHistory([
          format(subDays(now, 4), 'yyyy-MM-dd'),
          format(subDays(now, 3), 'yyyy-MM-dd'),
          format(subDays(now, 2), 'yyyy-MM-dd'),
          yesterday,
          format(addDays(now, 1), 'yyyy-MM-dd'), // also logged for tomorrow
        ]),
        frozenUntil: format(addDays(now, 2), 'yyyy-MM-dd'),
      };

      const streak = calculateStreak(habit, now);
      // today (frozen ✓) → yesterday (history ✓) → 2 days ago (history ✓) →
      // 3 days ago (history ✓) → 4 days ago (history ✓) = 5 days; tomorrow is
      // not in the back-walk path.
      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(5);
    });

    it('multi-freeze habit: re-freezing covers tomorrow too via longer window', () => {
      // 3 history days ending today, freeze window starts today and continues
      // 2 more days. Today counts as a "frozen + completed" day in the
      // back-walk and the streak drops after walking into yesterday.
      const habit: Habit = {
        ...makeHabitWithHistory([
          format(subDays(now, 3), 'yyyy-MM-dd'),
          format(subDays(now, 2), 'yyyy-MM-dd'),
          yesterday,
          today,
        ]),
        frozenUntil: format(addDays(now, 2), 'yyyy-MM-dd'),
      };

      const streak = calculateStreak(habit, now);
      expect(streak.currentStreak).toBe(4); // today + 3 prior days
      expect(streak.longestStreak).toBe(4);
    });

    it('streak breaks once the freeze window passes', () => {
      // Freeze was active until yesterday. Today it's over and no check-in recorded.
      const threeDaysAgo = format(subDays(now, 3), 'yyyy-MM-dd');
      const habit: Habit = {
        ...makeHabitWithHistory([
          threeDaysAgo,
          format(subDays(now, 2), 'yyyy-MM-dd'),
          yesterday,
        ]),
        frozenUntil: yesterday,
      };

      const streak = calculateStreak(habit, now);
      // Yesterday is real, walk back to two-days-ago (real) and three-days-ago
      // (real) — that's the anchored streak because today is no longer frozen.
      expect(streak.currentStreak).toBe(3);
    });

    it('freeze does not retroactively patch historical gaps', () => {
      // Two completed days three days apart. Freeze is currently active and
      // cannot bridge the historical gap (those days are not in the freeze
      // window anymore).
      const oldDate = format(subDays(now, 10), 'yyyy-MM-dd');
      const habit: Habit = {
        ...makeHabitWithHistory([oldDate]),
        frozenUntil: today,
      };

      const streak = calculateStreak(habit, now);
      // today (frozen) + yesterday..oldDate? No: yesterday is not in history
      // and not in the freeze window starting today. So streak = 1 (only today).
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
    });

    it('getHabitsWithStreaks honors freeze without exposing internal state', () => {
      let store: HabitStore = { version: 1, habits: [] };
      const created = createHabit(store, { title: 'Walking' });
      store = created.store;
      const yesterdayEntry = completeHabit(store, 'h-1', { date: yesterday });
      store = yesterdayEntry.store;
      const frozen = freezeHabit(store, 'h-1', { days: 2 }, now);

      const habits = getHabitsWithStreaks(frozen.store, undefined, now);
      const walking = habits.find(h => h.id === 'h-1')!;
      expect(walking.streak.currentStreak).toBe(2); // yesterday + frozen today
      // Sanity: there is no break in the existing API surface.
      expect(walking.streak.isCompletedToday).toBe(false);
    });

    it('CLI-side idempotency: refreezing extends the window and bumps the counter', () => {
      const { store } = createHabit(initialStore, { title: 'Meditate' });
      const first = freezeHabit(store, 'h-1', { days: 1 }, now);
      const second = freezeHabit(first.store, 'h-1', { days: 4 }, now);
      // frozenUntil is recomputed to today + 3, freezing 4 days total.
      expect(second.store.habits[0].frozenUntil).toBe(format(addDays(now, 3), 'yyyy-MM-dd'));
      expect(second.store.habits[0].freezesUsed).toBe(2);
    });
  });
});
