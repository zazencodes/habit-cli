import { HabitStore, HabitStats } from '../types.js';
import { getHabitsWithStreaks } from './habits.js';

export function calculateStats(store: HabitStore, referenceDate = new Date()): HabitStats {
  const activeHabits = getHabitsWithStreaks(store, { showArchived: false }, referenceDate);
  const totalHabits = store.habits.length;

  const completedToday = activeHabits.filter(h => h.streak.isCompletedToday).length;
  const completionRateToday = activeHabits.length > 0
    ? Math.round((completedToday / activeHabits.length) * 100)
    : 0;

  const totalCompletions = store.habits.reduce(
    (acc, h) => acc + h.history.length,
    0
  );

  const topStreaks = [...activeHabits]
    .map(h => ({
      habitId: h.id,
      title: h.title,
      currentStreak: h.streak.currentStreak,
      longestStreak: h.streak.longestStreak,
    }))
    .sort((a, b) => b.currentStreak - a.currentStreak)
    .slice(0, 5);

  return {
    totalHabits,
    activeHabits: activeHabits.length,
    completedToday,
    completionRateToday,
    totalCompletions,
    topStreaks,
  };
}
