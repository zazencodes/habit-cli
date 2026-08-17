# Habit CLI (`@zazencodes/habit-cli`)

A clean, modular, and fast terminal habit tracker with streak analytics, daily/weekly frequency support, and persistent JSON storage.

---

## Features

- **Daily & Weekly Tracking**: Manage routines, daily habits, and weekly rituals.
- **Streak Calculation**: Real-time contiguous streaks and lifetime personal records.
- **14-Day Visual Timeline**: Clean terminal activity visualization for individual habits.
- **Stats Dashboard**: Track completion rates, active streaks, and leaderboard rankings.
- **Fast Test Runner**: Built with Vitest for sub-second test runs.

---

## Quick Start

### Installation

```bash
# Clone the repository
git clone git@github.com:zazencodes/habit-cli.git
cd habit-cli

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Usage

```bash
# Add a new daily habit
npx tsx bin/habit.ts add "Morning Meditation" -t health,mind

# Add a weekly habit
npx tsx bin/habit.ts add "Weekly Planning" -f weekly -t productivity

# List all active habits
npx tsx bin/habit.ts list

# Check off a habit for today
npx tsx bin/habit.ts done "h-1"

# View detailed stats and 14-day history
npx tsx bin/habit.ts show "h-1"

# View overall completion statistics
npx tsx bin/habit.ts stats

# Undo a check-in
npx tsx bin/habit.ts undo "h-1"

# Archive a habit
npx tsx bin/habit.ts delete "h-1"
```

---

## CLI Reference

| Command | Alias | Description | Options |
| :--- | :--- | :--- | :--- |
| `habit add <title>` | | Add a new habit | `-f, --frequency <daily\|weekly>`, `-d, --desc <text>`, `-t, --tag <tags...>` |
| `habit list` | `ls` | List active habits & streaks | `-a, --all`, `-t, --tag <tag>` |
| `habit done <id\|title>` | `complete`, `check` | Check off habit for today | `-d, --date <YYYY-MM-DD>`, `-n, --note <text>` |
| `habit undo <id\|title>` | | Undo check-in for a date | `-d, --date <YYYY-MM-DD>` |
| `habit show <id\|title>` | | View detailed habit stats | |
| `habit stats` | | Global analytics dashboard | |
| `habit delete <id\|title>` | `rm` | Archive / delete habit | `--hard` (permanent deletion) |

---

## Development & Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Build bundle
npm run build
```

---

## License

MIT © [ZazenCodes](https://github.com/zazencodes)
