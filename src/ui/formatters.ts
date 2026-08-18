import pc from 'picocolors';
import { format, subDays } from 'date-fns';
import { HabitWithStreak, HabitStats, Habit, Priority } from '../types.js';

export function formatHeader(text: string): string {
  return pc.bold(pc.cyan(`\n  ✦ ${text}\n`));
}

export function formatSuccess(msg: string): string {
  return `${pc.green('✔')} ${msg}`;
}

export function formatError(msg: string): string {
  return `${pc.red('✖')} ${pc.red(msg)}`;
}

export function formatInfo(msg: string): string {
  return `${pc.blue('ℹ')} ${msg}`;
}

export function formatFrozenBadge(frozenUntil: string | undefined, referenceDate = new Date()): string | null {
  if (!frozenUntil) return null;
  const todayStr = format(referenceDate, 'yyyy-MM-dd');
  if (frozenUntil < todayStr) return null;
  return pc.cyan(`🧊 FROZEN (until ${frozenUntil})`);
}

export function formatPriorityBadge(priority: Priority | undefined): string {
  switch (priority) {
    case 'high':
      return pc.bold(pc.red('[HIGH]'));
    case 'medium':
      return pc.yellow('[MED]');
    case 'low':
      return pc.dim(pc.gray('[LOW]'));
    default:
      return pc.gray(pc.dim('[---]'));
  }
}

export function formatHabitList(habits: HabitWithStreak[]): string {
  if (habits.length === 0) {
    return pc.gray('\n  No habits found. Run `habit add <title>` to create your first habit!\n');
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(pc.bold(pc.cyan('  HABIT TRACKER')));
  lines.push(pc.gray('  ' + '─'.repeat(58)));

  for (const habit of habits) {
    const isDone = habit.streak.isCompletedToday;
    const isFrozen = formatFrozenBadge(habit.frozenUntil) !== null;
    const statusIcon = isFrozen ? pc.cyan('🧊') : (isDone ? pc.green('✔') : pc.gray('○'));
    const titleText = isDone ? pc.strikethrough(pc.gray(habit.title)) : pc.bold(habit.title);
    const idBadge = pc.gray(`[${habit.id}]`);
    const priorityBadge = formatPriorityBadge(habit.priority);

    // Streak badge
    let streakBadge = pc.gray('0d');
    if (habit.streak.currentStreak > 0) {
      streakBadge = pc.yellow(`🔥 ${habit.streak.currentStreak}${habit.frequency === 'weekly' ? 'w' : 'd'}`);
    }

    const freqBadge = habit.frequency === 'weekly' ? pc.magenta('weekly') : pc.dim('daily');
    const tags = habit.tags.length > 0 ? pc.blue(habit.tags.map(t => `#${t}`).join(' ')) : '';
    const frozenBadge = formatFrozenBadge(habit.frozenUntil) ?? '';

    lines.push(
      `  ${statusIcon}  ${idBadge.padEnd(8)} ${priorityBadge} ${titleText.padEnd(24)} ${streakBadge.padEnd(12)} ${freqBadge.padEnd(10)} ${frozenBadge} ${tags}`
    );
  }

  lines.push(pc.gray('  ' + '─'.repeat(58)));
  const completedCount = habits.filter(h => h.streak.isCompletedToday).length;
  lines.push(
    pc.dim(`  Progress: ${completedCount}/${habits.length} completed today (${Math.round((completedCount / habits.length) * 100)}%)\n`)
  );

  return lines.join('\n');
}

export function formatHabitDetail(habit: HabitWithStreak): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(pc.bold(pc.cyan(`  ✦ HABIT: ${habit.title.toUpperCase()}`)));
  lines.push(pc.gray('  ' + '─'.repeat(45)));
  lines.push(`  ${pc.dim('ID:')}          ${habit.id}`);
  lines.push(`  ${pc.dim('Frequency:')}   ${habit.frequency}`);
  lines.push(`  ${pc.dim('Priority:')}    ${formatPriorityBadge(habit.priority)}`);
  lines.push(`  ${pc.dim('Created:')}     ${format(new Date(habit.createdAt), 'yyyy-MM-dd')}`);
  if (habit.description) {
    lines.push(`  ${pc.dim('Description:')} ${habit.description}`);
  }
  if (habit.tags.length > 0) {
    lines.push(`  ${pc.dim('Tags:')}        ${habit.tags.map(t => `#${t}`).join(', ')}`);
  }

  const streak = habit.streak;
  lines.push('');
  lines.push(pc.bold('  Streaks & Performance:'));
  lines.push(`  - Current Streak: ${streak.currentStreak > 0 ? pc.yellow(`🔥 ${streak.currentStreak} ${habit.frequency === 'weekly' ? 'weeks' : 'days'}`) : '0'}`);
  lines.push(`  - Longest Streak: ${pc.green(`${streak.longestStreak} ${habit.frequency === 'weekly' ? 'weeks' : 'days'}`)}`);
  lines.push(`  - Total Checks:   ${habit.history.length}`);
  lines.push(`  - Status Today:   ${streak.isCompletedToday ? pc.green('Completed ✔') : pc.yellow('Pending ○')}`);

  const frozenBadge = formatFrozenBadge(habit.frozenUntil);
  if (frozenBadge) {
    lines.push('');
    lines.push(pc.bold('  Vacation Mode:'));
    lines.push(`  - Status:       ${frozenBadge}`);
    lines.push(`  - Freezes Used: ${pc.cyan((habit.freezesUsed ?? 0).toString())}`);
  } else if ((habit.freezesUsed ?? 0) > 0) {
    lines.push('');
    lines.push(pc.bold('  Vacation Mode:'));
    lines.push(`  - Status:       ${pc.dim('Not currently frozen')}`);
    lines.push(`  - Freezes Used: ${pc.cyan((habit.freezesUsed ?? 0).toString())}`);
  }

  // Last 14 days activity graph
  lines.push('');
  lines.push(pc.dim('  Last 14 Days:'));
  const historyDates = new Set(habit.history.map(h => h.date));
  const graphBlocks: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const dStr = format(d, 'yyyy-MM-dd');
    if (historyDates.has(dStr)) {
      graphBlocks.push(pc.green('■'));
    } else {
      graphBlocks.push(pc.gray('□'));
    }
  }
  lines.push(`  [ ${graphBlocks.join(' ')} ]`);
  lines.push(pc.gray(`  ${format(subDays(new Date(), 13), 'MM/dd')} → ${format(new Date(), 'MM/dd')}\n`));

  return lines.join('\n');
}

export function formatStats(stats: HabitStats): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(pc.bold(pc.cyan('  ✦ HABIT TRACKER STATISTICS')));
  lines.push(pc.gray('  ' + '─'.repeat(45)));
  lines.push(`  ${pc.dim('Total Habits:')}        ${pc.bold(stats.totalHabits.toString())}`);
  lines.push(`  ${pc.dim('Active Habits:')}       ${pc.bold(stats.activeHabits.toString())}`);
  lines.push(`  ${pc.dim('Completed Today:')}     ${pc.green(stats.completedToday.toString())} / ${stats.activeHabits}`);
  lines.push(`  ${pc.dim('Today Completion:')}    ${pc.cyan(`${stats.completionRateToday}%`)}`);
  lines.push(`  ${pc.dim('Total Lifetime Logs:')} ${pc.bold(stats.totalCompletions.toString())}`);

  if (stats.topStreaks.length > 0) {
    lines.push('');
    lines.push(pc.bold('  Top Active Streaks:'));
    for (const item of stats.topStreaks) {
      lines.push(
        `  ${pc.yellow('🔥')} ${pc.bold(item.title.padEnd(20))} ${pc.yellow(`${item.currentStreak} streak`)} ${pc.dim(`(best: ${item.longestStreak})`)}`
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}
