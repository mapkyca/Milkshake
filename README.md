# Milkshake – Sovereign, Local-First Task Manager

Milkshake is a Docker-first, local-first task management system designed to replace Remember The Milk for power users. It stores all user-owned task data in a local SQLite file and syncs dynamically with an Obsidian vault.

---

## Key Features

1. **Local-First Data Ownership**: All tasks are stored in a SQLite database on your host disk (`data/tasks.sqlite`).
2. **Obsidian Daily Note Integration**: Seamlessly syncs today's tasks directly into a task block in your daily notes (`vault/Daily/YYYY-MM-DD.md`) without touching surrounding content, reading back completions automatically.
3. **Powerful CLI**: Capture and manage tasks via standard CLI commands inside Docker.
4. **Information-Dense Web UI**: A dark, premium web app interface with Outfit / Plus Jakarta Sans typography, micro-animations, keyboard shortcuts, and slide-over task edit drawers.
5. **RFC 5545 Recurrence Support**: Full support for standard recurrence rules (e.g. `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO`) using a new-row spawning method to preserve completion history.
6. **Remember The Milk JSON Importer**: Idempotent database migrations from your RTM account exports.

---

## Quick Start

### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### 1. Set Up Environment
Copy `.env.example` to `.env` and adjust the variables to point to your Obsidian vault:
```bash
cp .env.example .env
```

`.env` details:
- `DATABASE_PATH`: Path to SQLite database (default: `./data/tasks.sqlite`)
- `VAULT_PATH`: Absolute path to your Obsidian vault
- `PORT`: Web server port (default: `3000`)
- `TZ`: User timezone (default: `Europe/London`)

### 2. Start Application
To build and start the Docker container containing both the Express API server and built Vite frontend:
```bash
docker compose up -d --build
```
Your web UI will be accessible at [http://localhost:3000](http://localhost:3000).

---

## CLI Reference

Milkshake provides a Commander-powered CLI tool. You can invoke it easily inside the running container:

```bash
docker compose run --rm app task <command> [options]
```

### Commands

#### 1. Add Task
```bash
docker compose run --rm app task add "Buy groceries" --list Personal --due tomorrow --priority 1 --tag shopping tags
```
- `--list <name>`: Target list (auto-creates list if it doesn't exist).
- `--due <date>`: Natural text due dates like `today`, `tomorrow`, or `YYYY-MM-DD`.
- `--priority <1|2|3>`: `1` for high, `2` for medium, `3` for low.
- `--tag <tag...>`: Repeatable tag keywords.

#### 2. List Tasks
```bash
docker compose run --rm app task list --today --list Personal
```
- `--today`: Show tasks due today or overdue.
- `--upcoming`: Show tasks due in the next 7 days.
- `--list <name>`: Filter by list name.
- `--tag <tag>`: Filter by tag.
- `--completed`: Show completed tasks.

#### 3. Complete Task
```bash
docker compose run --rm app task complete <task-id>
```
Marks a task as completed. If it has a recurrence rule, spawns the next occurrence automatically.

#### 4. Sync Obsidian
```bash
docker compose run --rm app task sync-obsidian --date 2026-05-31
```
Reads any checked off checkboxes in `vault/Daily/2026-05-31.md` and marks those tasks completed in the database, then overwrites the task block inside the note with the updated, refreshed list of tasks.

#### 5. Import RTM Backup
```bash
docker compose run --rm app task import-rtm /data/rtm_export.json --dry-run
```
Parses your exported RTM JSON backup. Supports `--dry-run` to preview imports without writing to SQLite and `--open-only` to skip importing completed historical tasks.

---

## Obsidian Integration details

Milkshake looks for a task block inside your daily note at `{VAULT_PATH}/Daily/YYYY-MM-DD.md`.
```markdown
# 2026-05-31

Any notes and thoughts you write here are preserved!

<!-- task-manager:start -->
- [ ] Walk the dog 📅 2026-05-31 <!-- task:cuid-1 -->
- [x] Buy milk 📅 2026-05-31 <!-- task:cuid-2 -->
<!-- task-manager:end -->

More of your custom markdown notes here.
```
When running the Obsidian sync, the system:
1. Parses any completed rows (e.g. `- [x]`) inside the block markers and marks them done in the database.
2. Refreshes the task list with active tasks due today (and overdue tasks).
3. Overwrites only the text between the `<!-- task-manager:start -->` and `<!-- task-manager:end -->` comments, leaving all surrounding document content untouched. If the block is not found in the note, it appends the block at the bottom of the file.

---

## Running Locally (Development)

To run the application locally without Docker:

```bash
# 1. Install dependencies
npm install

# 2. Start Express API and Vite React Web dev server concurrently
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Verification and Testing
We have built-in unit and integration tests using Vitest and an in-memory database:
```bash
npm test
```
