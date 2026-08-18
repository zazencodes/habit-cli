import { format, subDays, differenceInCalendarDays, parseISO, startOfWeek, isSameWeek } from 'date-fns';
import { Habit, HabitLog, HabitStore, HabitWithStreak, Frequency, StreakInfo } from '../types.js';

export interface CreateHabitOptions {
  title: string;
  description?: string;
  frequency?: Frequency;
  tags?: string[];
}

export function generateHabitId(store: HabitStore): string {
  const existingNumbers = store.habits
    .map(h => {
      const match = h.id.match(/^h-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));

  const max = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  return `h-${max + 1}`;
}

export function createHabit(
  store: HabitStore,
  options: CreateHabitOptions
): { habit: Habit; store: HabitStore } {
  const title = options.title.trim();
  if (!title) {
    throw new Error('Habit title cannot be empty.');
  }

  const existing = store.habits.find(
    h => !h.archived && h.title.toLowerCase() === title.toLowerCase()
  );
  if (existing) {
    throw new Error(`A habit named "${title}" already exists.`);
  }

  const habit: Habit = {
    id: generateHabitId(store),
    title,
    description: options.description?.trim() || undefined,
    frequency: options.frequency || 'daily',
    tags: (options.tags || [])
      .flatMap(t => t.split(','))
      .map(t => t.trim().toLowerCase())
      .filter(Boolean),
    createdAt: new Date().toISOString(),
    archived: false,
    history: [],
  };

  const updatedStore: HabitStore = {
    ...store,
    habits: [...store.habits, habit],
  };

  return { habit, store: updatedStore };
}

export function findHabit(store: HabitStore, query: string): Habit | undefined {
  const q = query.trim().toLowerCase();
  // Try exact ID match first
  const byId = store.habits.find(h => h.id.toLowerCase() === q);
  if (byId) return byId;

  // Try title match
  return store.habits.find(
    h => !h.archived && h.title.toLowerCase() === q
  ) || store.habits.find(
    h => !h.archived && h.title.toLowerCase().includes(q)
  );
}

export function calculateStreak(habit: Habit, referenceDate = new Date()): StreakInfo {
  const todayStr = format(referenceDate, 'yyyy-MM-dd');

  // Normalize: deduplicate and sort unique history dates chronologically
  // (ascending), regardless of the order check-ins were inserted. localeCompare
  // is used as an explicit comparator so the sort remains stable and correct
  // even if the history contains entries written out of order (issue #1).
  const uniqueDatesAscending = Array.from(
    new Set(habit.history.map(h => h.date))
  ).sort((a, b) => a.localeCompare(b));
  const uniqueDatesDescending = [...uniqueDatesAscending].reverse();

  const isCompletedToday = uniqueDatesDescending.includes(todayStr);

  if (uniqueDatesAscending.length === 0) {
    return { currentStreak: 0, longestStreak: 0, isCompletedToday: false };
  }

  if (habit.frequency === 'weekly') {
    return calculateWeeklyStreak(habit.history, referenceDate, isCompletedToday);
  }

  // Daily streak calculation
  const yesterdayStr = format(subDays(referenceDate, 1), 'yyyy-MM-dd');
  const hasToday = isCompletedToday;
  const hasYesterday = uniqueDatesDescending.includes(yesterdayStr);

  let currentStreak = 0;
  if (hasToday || hasYesterday) {
    let checkDate = hasToday ? referenceDate : subDays(referenceDate, 1);
    while (true) {
      const checkStr = format(checkDate, 'yyyy-MM-dd');
      if (uniqueDatesDescending.includes(checkStr)) {
        currentStreak += 1;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  }

  // Longest streak calculation across ascending dates
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of uniqueDatesAscending) {
    const d = parseISO(dateStr);
    if (!prevDate) {
      runningStreak = 1;
    } else {
      const diff = differenceInCalendarDays(d, prevDate);
      if (diff === 1) {
        runningStreak += 1;
      } else if (diff > 1) {
        runningStreak = 1;
      }
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDate = d;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    isCompletedToday,
  };
}

function calculateWeeklyStreak(history: HabitLog[], referenceDate: Date, isCompletedToday: boolean): StreakInfo {
  if (history.length === 0) {
    return { currentStreak: 0, longestStreak: 0, isCompletedToday: false };
  }

  // Group completions into ISO week start timestamps
  const weekSet = new Set<number>();
  for (const log of history) {
    const d = parseISO(log.date);
    const weekStart = startOfWeek(d, { weekStartsOn: 1 }).getTime();
    weekSet.add(weekStart);
  }

  const sortedWeeks = Array.from(weekSet).sort((a, b) => b - a);
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }).getTime();
  const lastWeekStart = startOfWeek(subDays(referenceDate, 7), { weekStartsOn: 1 }).getTime();

  let currentStreak = 0;
  const hasCurrentWeek = sortedWeeks.includes(currentWeekStart);
  const hasLastWeek = sortedWeeks.includes(lastWeekStart);

  if (hasCurrentWeek || hasLastWeek) {
    let checkWeek = hasCurrentWeek ? currentWeekStart : lastWeekStart;
    while (sortedWeeks.includes(checkWeek)) {
      currentStreak += 1;
      checkWeek = startOfWeek(subDays(new Date(checkWeek), 7), { weekStartsOn: 1 }).getTime();
    }
  }

  return {
    currentStreak,
    longestStreak: currentStreak,
    isCompletedToday,
  };
}

export function completeHabit(
  store: HabitStore,
  query: string,
  options?: { date?: string; note?: string }
): { habit: HabitWithStreak; store: HabitStore; alreadyCompleted: boolean } {
  const habit = findHabit(store, query);
  if (!habit) {
    throw new Error(`Habit not found matching "${query}".`);
  }

  const targetDate = options?.date || format(new Date(), 'yyyy-MM-dd');
  const alreadyCompleted = habit.history.some(log => log.date === targetDate);

  let updatedHistory = [...habit.history];
  if (!alreadyCompleted) {
    const newLog: HabitLog = {
      date: targetDate,
      completedAt: new Date().toISOString(),
      note: options?.note,
    };
    updatedHistory.push(newLog);
  }

  const updatedHabit: Habit = {
    ...habit,
    history: updatedHistory,
  };

  const updatedStore: HabitStore = {
    ...store,
    habits: store.habits.map(h => (h.id === habit.id ? updatedHabit : h)),
  };

  const streak = calculateStreak(updatedHabit);

  return {
    habit: { ...updatedHabit, streak },
    store: updatedStore,
    alreadyCompleted,
  };
}

export function undoHabit(
  store: HabitStore,
  query: string,
  targetDate?: string
): { habit: HabitWithStreak; store: HabitStore; removed: boolean } {
  const habit = findHabit(store, query);
  if (!habit) {
    throw new Error(`Habit not found matching "${query}".`);
  }

  const date = targetDate || format(new Date(), 'yyyy-MM-dd');
  const hadCompletion = habit.history.some(log => log.date === date);

  const updatedHabit: Habit = {
    ...habit,
    history: habit.history.filter(log => log.date !== date),
  };

  const updatedStore: HabitStore = {
    ...store,
    habits: store.habits.map(h => (h.id === habit.id ? updatedHabit : h)),
  };

  const streak = calculateStreak(updatedHabit);

  return {
    habit: { ...updatedHabit, streak },
    store: updatedStore,
    removed: hadCompletion,
  };
}

export function deleteHabit(
  store: HabitStore,
  query: string,
  permanent = false
): { habit: Habit; store: HabitStore } {
  const habit = findHabit(store, query);
  if (!habit) {
    throw new Error(`Habit not found matching "${query}".`);
  }

  let updatedHabits: Habit[];
  let returnedHabit: Habit;
  if (permanent) {
    returnedHabit = habit;
    updatedHabits = store.habits.filter(h => h.id !== habit.id);
  } else {
    returnedHabit = { ...habit, archived: true };
    updatedHabits = store.habits.map(h =>
      h.id === habit.id ? returnedHabit : h
    );
  }

  return {
    habit: returnedHabit,
    store: {
      ...store,
      habits: updatedHabits,
    },
  };
}

export function getHabitsWithStreaks(
  store: HabitStore,
  options?: { showArchived?: boolean; tag?: string },
  referenceDate = new Date()
): HabitWithStreak[] {
  let list = store.habits;

  if (!options?.showArchived) {
    list = list.filter(h => !h.archived);
  }

  if (options?.tag) {
    const t = options.tag.toLowerCase();
    list = list.filter(h => h.tags.includes(t));
  }

  return list.map(habit => ({
    ...habit,
    streak: calculateStreak(habit, referenceDate),
  }));
}
