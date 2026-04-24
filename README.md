# mcp-vars

[![Node.js](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-server-111111)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Scopes](https://img.shields.io/badge/scopes-user%20%7C%20project-4C1)](#scopes)
[![Runtime](https://img.shields.io/badge/runtime-npx%20%7C%20npm-CC3534?logo=npm&logoColor=white)](#installation)

Persistent working memory for CLI agents.

`mcp-vars` is a tiny MCP server that gives Codex, Claude, OpenClaw, Hermes, Qwen, and other local agent hosts a shared place to remember structured state between tool calls, sessions, and parallel agent runs.

Use it for the values agents usually lose:

- current task state
- repository goals and constraints
- counters and progress markers
- decisions made earlier in a session
- small structured handoff payloads between agents
- user-level preferences that should survive across projects

It is not a vector database, note-taking app, or document store. It is closer to persistent RAM: small JSON values addressed by predictable keys.

## Why

CLI agents are often stateless at the exact moment they need memory. They can read files, run commands, and call tools, but temporary reasoning state disappears unless they rewrite project docs or invent ad hoc scratch files.

`mcp-vars` gives agents a simple alternative:

```text
variable_set("task.current", { "phase": "review", "done": ["tests"] })
variable_get("task.current")
variable_patch("task.current", { "phase": "fixes" })
```

The state is persisted locally, scoped deliberately, and exposed through MCP tools.

## Quick Start

Run directly with `npx`:

```bash
npx -y mcp-vars
```

Install globally if you want a stable local binary:

```bash
npm install -g mcp-vars
mcp-vars
```

Run with explicit project scope:

```bash
PROJECT_ROOT=$PWD npx -y mcp-vars
```

## Installation

`mcp-vars` includes an installer for common local agent clients. It registers the server in clients whose config directories already exist.

Install into all detected clients:

```bash
npx -y mcp-vars install
```

Install only selected clients:

```bash
npx -y mcp-vars install --clients codex claude
```

Use a custom MCP server name:

```bash
npx -y mcp-vars install --server-name team-memory
```

Supported clients:

| Client | Config file |
|--------|-------------|
| Codex  | `~/.codex/config.toml` |
| Claude | `~/.claude/settings.json` |
| Hermes | `~/.hermes/config.yaml` |
| Qwen   | `~/.qwen/settings.json` |

Generated configs use:

- `command: "npx"`
- `args: ["-y", "mcp-vars"]`
- `cwd` set to the directory where `install` was run
- `PROJECT_ROOT` set to the same directory

## OpenClaw

OpenClaw can run `mcp-vars` as a local subprocess:

```json
{
  "vars": {
    "command": "npx",
    "args": ["-y", "mcp-vars"]
  }
}
```

If OpenClaw does not spawn the process from the workspace root, set `PROJECT_ROOT`:

```json
{
  "vars": {
    "command": "npx",
    "args": ["-y", "mcp-vars"],
    "env": {
      "PROJECT_ROOT": "/workspace"
    }
  }
}
```

## Tools

The server exposes MCP tools for single-value operations, batch operations, snapshots, TTL cleanup, optimistic concurrency, and common array/counter updates:

| Tool | Purpose |
|------|---------|
| `variable_get` | Load one value by key |
| `variable_set` | Create or replace one value; supports `expires_at`, `namespace`, `owner`, and `tags` |
| `variable_patch` | Shallow-merge fields into an existing object value |
| `variable_delete` | Delete one value by key |
| `variable_list` | List values, optionally filtered by key prefix, namespace, owner, or tag |
| `variable_bulk_set` | Create or replace several values in one call |
| `variable_bulk_delete` | Delete several values in one call |
| `variable_export` | Export non-expired project and user values as a JSON snapshot |
| `variable_import` | Replace project and user values from a JSON snapshot |
| `variable_cleanup_expired` | Delete expired values in one scope |
| `variable_set_if_version` | Replace a value only when `expected_revision` or `expected_updated_at` matches |
| `variable_patch_if_version` | Patch an object only when `expected_revision` or `expected_updated_at` matches |
| `variable_increment` | Increment a numeric value; missing values start at zero |
| `variable_append` | Append one JSON value to an array; missing values start as an empty array |
| `variable_remove_from_array` | Remove JSON-equal items from an array |

Typical result:

```json
{
  "status": "ok",
  "key": "project.goal",
  "value": "ship",
  "message": "Loaded variable 'project.goal'.",
  "scope": "project",
  "warnings": []
}
```

Tool responses include both text content and structured content. Values listed through `variable_list` include metadata such as `revision`, `updatedAt`, `expiresAt`, `namespace`, `owner`, and `tags`.

## Resources

The server also exposes read-only MCP resources:

| Resource | Purpose |
|----------|---------|
| `instructions://usage` | Usage guidance for agents |
| `vars://project` | JSON view of project-scope values |
| `vars://user` | JSON view of user-scope values |
| `vars://project/{prefix}` | JSON view of project-scope values filtered by key prefix |
| `vars://user/{prefix}` | JSON view of user-scope values filtered by key prefix |

## Scopes

Every value lives in one of two scopes:

| Scope | Use for | Storage |
|-------|---------|---------|
| `project` | Repo-local working memory, task state, project decisions | `${PROJECT_ROOT}/.mcp-vars/variables.json` |
| `user` | Personal defaults and cross-project preferences | `$XDG_DATA_HOME/mcp-vars/variables.json` or `~/.local/share/mcp-vars/variables.json` |

Use `project` for anything tied to the current repository. Use `user` only for state that should be visible across repositories.

Explicit storage overrides:

- `MCP_VARS_USER_DB_PATH`
- `MCP_VARS_PROJECT_DB_PATH`

## Data Model

Values must be JSON-native:

- string
- number
- boolean
- null
- array
- object

Keys must match:

```text
[a-z0-9._-]+
```

Good key examples:

- `task.current`
- `task.step`
- `review.findings`
- `agent.planner.handoff`
- `user.preference.test_runner`

`variable_patch` only works when the current value is an object. It performs a shallow merge, not a recursive merge.

Optional metadata:

- `expires_at`: timezone-aware ISO timestamp. Expired values are hidden from `get`, `list`, and `export`, and are deleted lazily.
- `namespace`: logical namespace. Defaults to `shared`.
- `owner`: client or agent owner identifier.
- `tags`: small labels for filtering.
- `revision`: monotonic record version returned by list/storage operations and used by compare-and-set tools.

## Secrets

Do not store API keys, passwords, access tokens, private keys, or other secrets in `mcp-vars`.

By default, writes are rejected when the key or value looks secret-like. If you deliberately need to bypass this guardrail for a controlled local workflow, set:

```bash
MCP_VARS_ALLOW_SECRET_LIKE_VALUES=true
```

## What To Store

Good fits:

- small objects under roughly 10 KB
- progress state
- short summaries
- structured handoffs
- values that multiple agents need to share
- state that should survive process restarts

Poor fits:

- secrets
- binary data
- large documents
- generated artifacts
- long-term human-facing documentation
- anything that belongs in source control

For team knowledge, architecture decisions, and runbooks, use the project's normal docs. Use `mcp-vars` for agent-operational state.

## Development

```bash
npm install
npm run dev
npm run build
npm test
```

## Docker

Docker is optional for development or controlled environments.

```bash
docker compose build
docker compose run --rm mcp-vars
```

---

## Русский

`mcp-vars` — персистентная оперативная память для CLI-агентов.

Это небольшой MCP-сервер, через который Codex, Claude, OpenClaw, Hermes, Qwen и другие локальные agent hosts могут хранить маленькое структурированное состояние между tool calls, сессиями и параллельными агентами.

Главная идея: агенту не нужно каждый раз заводить scratch-файлы, править README или держать все в контексте модели. Он может положить рабочее состояние в локальное JSON-хранилище и достать его позже.

Подходит для:

- текущего состояния задачи
- целей и ограничений проекта
- счетчиков и progress markers
- решений, принятых раньше в сессии
- коротких handoff-объектов между агентами
- пользовательских предпочтений между проектами

Не подходит для секретов, больших документов, бинарных данных и знаний, которые должны жить в проектной документации.

### Быстрый старт

Запуск через `npx`:

```bash
npx -y mcp-vars
```

Глобальная установка:

```bash
npm install -g mcp-vars
mcp-vars
```

Запуск с явным project scope:

```bash
PROJECT_ROOT=$PWD npx -y mcp-vars
```

### Установка в клиенты

Инсталлятор добавляет MCP-сервер в локальные конфиги поддерживаемых клиентов. Клиент пропускается, если его директория не существует.

```bash
npx -y mcp-vars install
```

Только выбранные клиенты:

```bash
npx -y mcp-vars install --clients codex claude
```

Под другим именем сервера:

```bash
npx -y mcp-vars install --server-name team-memory
```

Поддерживаемые клиенты:

| Клиент | Файл конфига |
|--------|-------------|
| Codex  | `~/.codex/config.toml` |
| Claude | `~/.claude/settings.json` |
| Hermes | `~/.hermes/config.yaml` |
| Qwen   | `~/.qwen/settings.json` |

### Инструменты

Публичная MCP-поверхность:

| Tool | Что делает |
|------|------------|
| `variable_get` | читает значение по ключу |
| `variable_set` | создает или заменяет значение |
| `variable_patch` | shallow-merge полей в существующий object |
| `variable_delete` | удаляет значение по ключу |
| `variable_list` | показывает значения, опционально по prefix |

### Scopes

| Scope | Для чего | Где хранится |
|-------|----------|--------------|
| `project` | состояние конкретного репозитория | `${PROJECT_ROOT}/.mcp-vars/variables.json` |
| `user` | персональное состояние между проектами | `$XDG_DATA_HOME/mcp-vars/variables.json` или `~/.local/share/mcp-vars/variables.json` |

Используйте `project` для всего, что относится к текущему репозиторию. Используйте `user` только для данных, которые должны переживать смену проекта.

Override-переменные:

- `MCP_VARS_USER_DB_PATH`
- `MCP_VARS_PROJECT_DB_PATH`

### Модель данных

Значения должны быть JSON-native: строки, числа, boolean, `null`, массивы и объекты.

Ключи должны соответствовать:

```text
[a-z0-9._-]+
```

Примеры ключей:

- `task.current`
- `review.findings`
- `agent.planner.handoff`
- `user.preference.test_runner`

`variable_patch` работает только с объектами и делает shallow merge.
