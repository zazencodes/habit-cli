import { Command } from 'commander';
import pc from 'picocolors';
import { FileStorage, StorageAdapter } from './storage.js';
import {
  createHabit,
  completeHabit,
  undoHabit,
  deleteHabit,
  getHabitsWithStreaks,
  findHabit,
  calculateStreak,
  freezeHabit,
  unfreezeHabit,
} from './core/habits.js';
import { calculateStats } from './core/stats.js';
import { exportHabits } from './core/export.js';
import {
  formatHabitList,
  formatHabitDetail,
  formatStats,
  formatSuccess,
  formatError,
  formatInfo,
  formatFrozenBadge,
} from './ui/formatters.js';
import { Frequency, Priority, PRIORITY_VALUES } from './types.js';

function parsePriority(raw: unknown): Priority {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if ((PRIORITY_VALUES as readonly string[]).includes(value)) {
    return value as Priority;
  }
  throw new Error(`Invalid priority "${raw}". Use one of: ${PRIORITY_VALUES.join(', ')}.`);
}

export function createCli(storage: StorageAdapter = new FileStorage()): Command {
  const program = new Command();

  program
    .name('habit')
    .description('A clean, fast CLI habit and task tracker')
    .version('0.1.0');

  // habit add <title>
  program
    .command('add <title>')
    .description('Add a new habit to track')
    .option('-f, --frequency <frequency>', 'Habit frequency: daily or weekly', 'daily')
    .option('-d, --desc <description>', 'Optional habit description')
    .option('-t, --tag <tags...>', 'Optional categorization tags')
    .option('-p, --priority <level>', `Habit priority: ${PRIORITY_VALUES.join(', ')}`, 'medium')
    .action(async (title: string, options) => {
      try {
        const store = await storage.load();
        const freq: Frequency = options.frequency === 'weekly' ? 'weekly' : 'daily';
        const priority = parsePriority(options.priority);
        const { habit, store: newStore } = createHabit(store, {
          title,
          description: options.desc,
          frequency: freq,
          priority,
          tags: options.tag,
        });
        await storage.save(newStore);
        console.log(formatSuccess(`Created habit ${pc.bold(habit.title)} [${habit.id}] (${habit.frequency})`));
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit list
  program
    .command('list')
    .alias('ls')
    .description('List all active habits and their current streaks')
    .option('-a, --all', 'Show all habits including archived ones', false)
    .option('-t, --tag <tag>', 'Filter habits by tag')
    .option('-p, --priority <level>', `Filter habits by priority: ${PRIORITY_VALUES.join(', ')}`)
    .action(async options => {
      try {
        const store = await storage.load();
        const priority = options.priority ? parsePriority(options.priority) : undefined;
        const habits = getHabitsWithStreaks(store, {
          showArchived: options.all,
          tag: options.tag,
          priority,
        });
        console.log(formatHabitList(habits));
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit done <id|title>
  program
    .command('done <query>')
    .alias('check')
    .alias('complete')
    .description('Mark a habit as completed for today (or a specific date)')
    .option('-d, --date <date>', 'Completion date in YYYY-MM-DD format')
    .option('-n, --note <note>', 'Optional check-in note')
    .action(async (query: string, options) => {
      try {
        const store = await storage.load();
        const { habit, store: newStore, alreadyCompleted } = completeHabit(store, query, {
          date: options.date,
          note: options.note,
        });
        await storage.save(newStore);

        if (alreadyCompleted) {
          console.log(formatInfo(`Habit "${habit.title}" was already completed for ${options.date || 'today'}.`));
        } else {
          const streakText = habit.streak.currentStreak > 1
            ? ` Streak: ${pc.yellow(`🔥 ${habit.streak.currentStreak} in a row!`)}`
            : '';
          console.log(formatSuccess(`Completed "${pc.bold(habit.title)}"!${streakText}`));
        }
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit undo <id|title>
  program
    .command('undo <query>')
    .description('Undo a habit check-in for today (or a specific date)')
    .option('-d, --date <date>', 'Target date in YYYY-MM-DD format')
    .action(async (query: string, options) => {
      try {
        const store = await storage.load();
        const { habit, store: newStore, removed } = undoHabit(store, query, options.date);
        await storage.save(newStore);

        if (removed) {
          console.log(formatSuccess(`Undid completion for "${pc.bold(habit.title)}" on ${options.date || 'today'}.`));
        } else {
          console.log(formatInfo(`No completion found to undo for "${habit.title}" on ${options.date || 'today'}.`));
        }
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit show <id|title>
  program
    .command('show <query>')
    .description('View detailed statistics and history for a habit')
    .action(async (query: string) => {
      try {
        const store = await storage.load();
        const habit = findHabit(store, query);
        if (!habit) {
          throw new Error(`Habit not found matching "${query}".`);
        }
        const habitWithStreak = {
          ...habit,
          streak: calculateStreak(habit),
        };
        console.log(formatHabitDetail(habitWithStreak));
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit stats
  program
    .command('stats')
    .description('Show overall completion statistics and streak leaderboards')
    .action(async () => {
      try {
        const store = await storage.load();
        const stats = calculateStats(store);
        console.log(formatStats(stats));
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit delete <id|title>
  program
    .command('delete <query>')
    .alias('rm')
    .description('Archive or permanently delete a habit')
    .option('--hard', 'Permanently delete the habit and all history', false)
    .action(async (query: string, options) => {
      try {
        const store = await storage.load();
        const { habit, store: newStore } = deleteHabit(store, query, options.hard);
        await storage.save(newStore);
        const actionStr = options.hard ? 'Deleted permanently' : 'Archived';
        console.log(formatSuccess(`${actionStr} habit "${pc.bold(habit.title)}".`));
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit freeze <id|all>
  program
    .command('freeze <target>')
    .description('Protect a habit streak from resetting (vacation / illness)')
    .option('-d, --days <count>', 'Number of days to freeze (default: 1)', '1')
    .option('-r, --reason <text>', 'Optional human-readable reason')
    .action(async (target: string, options) => {
      try {
        const store = await storage.load();
        const days = parseInt(options.days, 10);
        const { habits, store: newStore } = freezeHabit(store, target, {
          days,
          reason: options.reason,
        });
        await storage.save(newStore);

        for (const habit of habits) {
          const badge = formatFrozenBadge(habit.frozenUntil) ?? '';
          const reasonSuffix = options.reason ? ` (reason: ${options.reason})` : '';
          console.log(
            formatSuccess(`Froze ${pc.bold(habit.title)} for ${days} day(s)${reasonSuffix}. ${badge}`)
          );
        }
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit unfreeze <id|all>
  program
    .command('unfreeze <target>')
    .description('Remove the active streak freeze early')
    .action(async (target: string) => {
      try {
        const store = await storage.load();
        const { habits, store: newStore } = unfreezeHabit(store, target);
        await storage.save(newStore);

        for (const habit of habits) {
          console.log(formatSuccess(`Unfroze ${pc.bold(habit.title)}.`));
        }
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  // habit export [output-path] 
  program
    .command('export [output]')
    .description('Export habits to JSON or CSV (stdout by default)')
    .option('-f, --format <format>', 'Output format: json or csv', 'json')
    .option('-o, --out <filepath>', 'Write to file instead of stdout')
    .option('-a, --all', 'Include archived habits', false)
    .action(async (output: string | undefined, options) => {
      try {
        const destination = options.out || output;
        const result = await exportHabits(storage, {
          format: options.format === 'csv' ? 'csv' : 'json',
          showArchived: options.all,
          destination,
        });

        if (result.writtenTo) {
          console.log(
            formatSuccess(
              `Exported ${result.habitCount} habit(s) (${result.bytes} bytes) to ${result.writtenTo}`
            )
          );
        } else {
          process.stdout.write(result.content);
        }
      } catch (err: any) {
        console.error(formatError(err.message));
        process.exitCode = 1;
      }
    });

  return program;
}

export * from './types.js';
export * from './storage.js';
export * from './core/habits.js';
export * from './core/stats.js';
export * from './core/export.js';
export * from './ui/formatters.js';
