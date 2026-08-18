export type Frequency = 'daily' | 'weekly';

export interface HabitLog {
  date: string; // YYYY-MM-DD
  completedAt: string; // ISO timestamp
  note?: string;
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: Frequency;
  tags: string[];
  createdAt: string; // ISO timestamp
  archived: boolean;
  history: HabitLog[];
  freezesUsed: number;
  frozenUntil?: string; // YYYY-MM-DD, last day included in the freeze window
}

export interface HabitStore {
  version: number;
  habits: Habit[];
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  isCompletedToday: boolean;
}

export interface HabitWithStreak extends Habit {
  streak: StreakInfo;
}

export interface HabitStats {
  totalHabits: number;
  activeHabits: number;
  completedToday: number;
  completionRateToday: number;
  totalCompletions: number;
  topStreaks: {
    habitId: string;
    title: string;
    currentStreak: number;
    longestStreak: number;
  }[];
}
