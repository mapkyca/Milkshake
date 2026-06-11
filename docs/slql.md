# Smart List Query Language (SLQL)

Smart lists are saved task queries. They do not own tasks — they display tasks matching a filter expression. This document describes the SLQL syntax, supported fields, date semantics, and CLI/API usage.

---

## Basic Syntax

### Field:Value Terms

The basic query form is:

```
field:value
```

Examples:

```
tag:finance
list:Inbox
status:incomplete
priority:1
due:today
```

### Quoted Values

Values containing spaces must be quoted with double quotes:

```
tag:"house admin"
list:"Lake Farm"
text:"tax return"
dueWithin:"1 week"
```

### Plain Text Search

Unqualified words are treated as `text:` searches (title + description):

```
insurance
```

is equivalent to:

```
text:insurance
```

---

## Boolean Operators

All operators are **case-insensitive** (`AND`, `and`, `And` are all valid).

| Operator | Description |
|---|---|
| `and` | Both conditions must be true |
| `or` | Either condition must be true |
| `not` | Negate a condition |

Examples:

```
tag:finance and status:incomplete
tag:wait or tag:waiting
not tag:someday
```

### Implicit AND

Adjacent terms without an explicit operator are treated as `and`:

```
tag:finance due:this-week status:incomplete
```

is equivalent to:

```
tag:finance and due:this-week and status:incomplete
```

### Operator Precedence

From highest to lowest:

1. Parentheses `()`
2. `not`
3. Implicit `and` and explicit `and`
4. `or`

Example:

```
not tag:someday and due:today or priority:1
```

is evaluated as:

```
((not tag:someday) and due:today) or priority:1
```

### Parentheses for Grouping

```
status:incomplete and (tag:finance or tag:tax)
```

---

## Comparison Operators

For numeric and date fields:

| Operator | Meaning |
|---|---|
| `<` | Less than |
| `<=` | Less than or equal |
| `>` | Greater than |
| `>=` | Greater than or equal |
| `=` | Equal |

Examples:

```
priority<=2
due>2026-06-17
due<=2026-12-31
due=2026-06-17
```

---

## Supported Fields

### `status`

```
status:incomplete
status:completed
status:any
```

**Default behaviour:** If `status` is not mentioned in a filter, `status:incomplete` is implied automatically. If any `completed*` date field is used, `status:completed` is implied instead.

### `priority`

```
priority:1      (high)
priority:2      (medium)
priority:3      (low)
priority:none   (no priority)
priority:any    (any non-none priority)
priority<=2     (high or medium)
priority>=2     (medium or low)
```

> [!NOTE]
> `none` does not match numeric comparisons. `priority:none` must be specified explicitly.

### `list`

```
list:Inbox
list:"House - DIY"
not list:Archive
```

List matching is case-insensitive.

### `tag`

```
tag:finance
tag:"house admin"
not tag:someday
hasTag:finance   (alias → tag:finance)
```

Tag matching is case-insensitive.

### `due` — Due Date

**Shortcut keywords:**

```
due:today
due:tomorrow
due:yesterday
due:this-week
due:next-week
due:this-month
due:next-month
due:overdue       (before today, and incomplete)
due:never         (no due date set)
due:any           (any due date is present)
```

**Exact date literals (YYYY-MM-DD):**

```
due:2026-06-17
due<2026-06-17
due<=2026-06-17
due>2026-06-17
due>=2026-06-17
due=2026-06-17
```

**Aliases (normalized automatically):**

```
dueBefore:2026-06-17    →  due<2026-06-17
dueAfter:2026-06-17     →  due>2026-06-17
dueOn:2026-06-17        →  due=2026-06-17
```

### `dueWithin` — Relative Due Window

Tasks due from today through the end of the window:

```
dueWithin:"1 day"
dueWithin:"7 days"
dueWithin:"1 week"
dueWithin:"1 month"
dueWithin:"1 day of today"
dueWithin:"1 week of today"
```

### `added` — Added (Created) Date

```
added:today
added:this-week
added:this-month
addedWithin:"1 month"
addedBefore:2026-06-01    →  added<2026-06-01
addedAfter:2026-06-01     →  added>2026-06-01
added<2026-06-01
added>=2026-06-01
```

### `completed` — Completion Date

```
completed:today
completed:yesterday
completed:this-week
completedWithin:"7 days"
completedBefore:2026-06-01
completedAfter:2026-06-01
```

### `created` / `updated`

```
created:this-week
updatedWithin:"3 days"
```

Follow the same date-window semantics as `added`.

### `repeat` — Recurrence

```
repeat:any    (task has a recurrence rule)
repeat:none   (task has no recurrence rule)
is:repeating  (alias → repeat:any)
```

### `has` / `is` — Special Conditions

```
has:subtasks        (task has child subtasks)
is:subtask          (this task is itself a subtask)
parent:any          (task has a parent)
parent:none         (top-level task; no parent)
```

> [!NOTE]
> By default, smart-list views only show top-level tasks. Subtasks are nested under their parent. To explicitly include subtasks, use `is:subtask` or `parent:any`.

### `text` / `title` / `description` — Text Search

```
text:"tax return"       (search title + description)
title:insurance         (search title only)
description:"policy"    (search description/notes only)
```

All text matching is case-insensitive.

---

## Default Behaviour

| Situation | Implied Behaviour |
|---|---|
| No `status` field mentioned | `status:incomplete` is added |
| Any `completed:*` or `completedWithin:*` field used | `status:completed` is added |
| `status:any` explicit | No status filter added |
| Subtasks | Excluded unless `is:subtask`, `parent:any`, or `has:subtasks` is queried |

---

## Date Semantics

All dates are evaluated relative to an explicit evaluation context:

```ts
{
  now: Date;
  timezone: string;          // Default: "Europe/London"
  startOfWeek: "monday" | "sunday";  // Default: "monday"
}
```

Date-only task due dates (e.g. `2026-06-17`) match against local calendar days in the specified timezone. A task due on `2026-06-17` matches `due:today` for the entire local calendar day of `2026-06-17` in `Europe/London`.

---

## Example Smart List Filters

| Filter | Description |
|---|---|
| `due:today` | Tasks due today or overdue |
| `due:overdue` | Overdue incomplete tasks |
| `priority:1 and due:this-week` | High-priority tasks due this week |
| `tag:finance and status:incomplete` | Incomplete finance tasks |
| `tag:wait or tag:waiting` | Waiting tasks |
| `tag:someday` | Someday/maybe list |
| `status:incomplete and not tag:someday and not tag:waiting and (due:any or priority<=2)` | Next actions |
| `due:never` | Tasks without a due date |
| `completedWithin:"7 days"` | Recently completed tasks |
| `list:"House - DIY" and dueWithin:"7 days"` | DIY tasks due soon |
| `tag:finance status:incomplete` | (Implicit AND) Finance incomplete tasks |

---

## CLI Usage

```bash
# List all smart lists
task smart-list list

# Show smart list details
task smart-list show <id>

# Create a smart list
task smart-list create "High priority this week" --filter 'priority:1 and due:this-week'

# Update an existing smart list
task smart-list update <id> --filter 'tag:finance due:this-week'

# Validate a filter expression (non-destructive)
task smart-list validate 'status:incomplete and not tag:someday'

# Preview tasks matching a filter (non-destructive)
task smart-list preview 'due:today'
```

---

## API Endpoints

All endpoints are under `/api/v1/smart-lists`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/smart-lists` | List all smart lists |
| `GET` | `/api/v1/smart-lists/:id` | Get a single smart list |
| `POST` | `/api/v1/smart-lists` | Create a smart list |
| `PATCH` | `/api/v1/smart-lists/:id` | Update a smart list |
| `DELETE` | `/api/v1/smart-lists/:id` | Delete/archive a smart list |
| `POST` | `/api/v1/smart-lists/validate` | Validate a filter (non-destructive) |
| `POST` | `/api/v1/smart-lists/preview` | Preview matching tasks |

### Create Smart List (POST /api/v1/smart-lists)

```json
{
  "name": "High priority this week",
  "filter": "priority:1 and due:this-week",
  "sortSettings": ["priority", "due"]
}
```

### Validate Filter (POST /api/v1/smart-lists/validate)

```json
{ "filter": "priority:urgent" }
```

Response:

```json
{
  "data": {
    "valid": false,
    "error": "Invalid priority \"urgent\". Expected 1, 2, 3, none, or any.",
    "type": "ValidationError",
    "line": null,
    "column": null
  }
}
```

### Preview Filter (POST /api/v1/smart-lists/preview)

```json
{ "filter": "due:today" }
```

Response:

```json
{
  "data": {
    "valid": true,
    "count": 3,
    "tasks": [
      { "id": "...", "title": "Call accountant", "dueDate": "2026-06-11", "priority": 1, "isCompleted": false }
    ]
  }
}
```

---

## Remember The Milk Import

When importing RTM backup data, smart lists are automatically detected and translated:

| RTM Filter | SLQL Filter |
|---|---|
| `tag:name` | `tag:name` |
| `not tag:name` | `not tag:name` |
| `status:incomplete` | `status:incomplete` |
| `status:completed` | `status:completed` |
| `status:open` | `status:incomplete` |
| `due:today` | `due:today` |
| `due:tomorrow` | `due:tomorrow` |
| `due:never` | `due:never` |
| `dueBefore:now` | `due:overdue` |
| `dueBefore:today` | `due:overdue` |
| `dueWithin:"1 day of today"` | `dueWithin:"1 day of today"` |
| `addedWithin:"1 month"` | `addedWithin:"1 month"` |
| `completed:today` | `completed:today` |

### Unsupported RTM Filters

If a smart list filter cannot be safely translated:

- The smart list is imported as **draft** (`isEnabled: false`)
- The original RTM filter string is preserved in `rtmFilter`
- A warning is appended to the import summary
- The user can edit the filter manually in the web UI

---

## Validation Errors

Common validation error messages:

| Query | Error |
|---|---|
| `frobnicate:yes` | `Unknown smart-list field "frobnicate"` |
| `priority:urgent` | `Invalid priority "urgent". Expected 1, 2, 3, none, or any.` |
| `status:open` | `Invalid status "open". Expected incomplete, completed, any.` |
| `tag:finance and (due:today` | `Expected closing parenthesis matching '(' at line 1, column 19` |
| `due<today` | `Comparison operators require a YYYY-MM-DD date. Found "today"` |
| `dueWithin:"5 years"` | `Invalid relative window "5 years". Expected format like "1 day", "7 days"...` |

---

## Grammar Reference

```
query          := expression
expression     := orExpr
orExpr         := andExpr (OR andExpr)*
andExpr        := notExpr ((AND)? notExpr)*
notExpr        := NOT notExpr | primary
primary        := term | "(" expression ")"
term           := fieldTerm | comparisonTerm | bareText
fieldTerm      := field ":" value
comparisonTerm := field comparisonOp value
comparisonOp   := "<" | "<=" | ">" | ">=" | "="
field          := identifier
value          := identifier | quotedString | dateLiteral
bareText       := identifier | quotedString
```

Reserved words (`and`, `or`, `not`) can be used as values when quoted: `tag:"not"`.
