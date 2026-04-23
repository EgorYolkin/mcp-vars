# mcp-vars

[![Node.js](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-server-111111)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Scopes](https://img.shields.io/badge/scopes-user%20%7C%20project-4C1)](#english)
[![Runtime](https://img.shields.io/badge/runtime-npx%20%7C%20npm-CC3534?logo=npm&logoColor=white)](#english)

[English](#english) | [Русский](#russian)

## English

`mcp-vars` is a persistent MCP server for small JSON-native state. It runs through `npx`, which makes it practical for hosts such as OpenClaw that spawn MCP servers as local subprocesses.

### Quick Start

Run directly with `npx`:

```bash
npx -y mcp-vars
```

Install globally if you prefer a fixed local binary:

```bash
npm install -g mcp-vars
mcp-vars
```

Run with explicit project scope:

```bash
PROJECT_ROOT=$PWD npx -y mcp-vars
```

### Features

- `stdio` MCP server for local subprocess spawning.
- Two scopes:
  - `user` for shared personal state
  - `project` for repo-local state
- JSON-native values only.
- Persistent file-backed storage with atomic writes.
- Tool surface:
  - `variable_get`
  - `variable_set`
  - `variable_patch`
  - `variable_delete`
  - `variable_list`
- Client installer for Codex, Claude, Hermes, and Qwen.

Typical tool result:

```json
{
  "status": "ok",
  "key": "project.goal",
  "value": "ship",
  "message": "Loaded variable 'project.goal'.",
  "scope": "project"
}
```

### Storage

`user` scope defaults to:
- `$XDG_DATA_HOME/mcp-vars/variables.json`
- or `~/.local/share/mcp-vars/variables.json`

`project` scope defaults to:
- `${PROJECT_ROOT}/.mcp-vars/variables.json`
- or `${cwd}/.mcp-vars/variables.json` when `PROJECT_ROOT` is not set

Explicit overrides:
- `MCP_VARS_USER_DB_PATH`
- `MCP_VARS_PROJECT_DB_PATH`

### Client Installation

The `install` subcommand writes MCP server config into supported local clients. It auto-detects which clients are installed by checking their config directories.

Install into all detected clients:

```bash
npx -y mcp-vars install
```

Install only for selected clients:

```bash
npx -y mcp-vars install --clients codex claude
```

Use a custom server name:

```bash
npx -y mcp-vars install --server-name team-vars
```

Supported clients and their config files:

| Client | Config file |
|--------|------------|
| Codex  | `~/.codex/config.toml` |
| Claude | `~/.claude/settings.json` |
| Hermes | `~/.hermes/config.yaml` |
| Qwen   | `~/.qwen/settings.json` |

The installer skips a client if its config directory does not exist.

Generated configs use:
- `command: "npx"`
- `args: ["-y", "mcp-vars"]`
- `cwd` and `PROJECT_ROOT` set to the current working directory at install time

### OpenClaw

OpenClaw should run `mcp-vars` as a local subprocess:

```json
{
  "vars": {
    "command": "npx",
    "args": ["-y", "mcp-vars"]
  }
}
```

If OpenClaw does not spawn from the workspace root, set `PROJECT_ROOT` explicitly:

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

### Development

```bash
npm install       # install dependencies
npm run dev       # run from source via tsx
npm run build     # compile to dist/
npm test          # run tests
```

### Docker

Docker is optional for development or controlled environments.

```bash
docker compose build
docker compose run --rm mcp-vars
```

### Notes

- Keys must match `[a-z0-9._-]+`.
- `variable_patch` only works when the current value is an object.
- `project` scope returns a validation error when it cannot resolve a usable root.

---

## Russian

`mcp-vars` — MCP-сервер для хранения небольшого JSON-native состояния. Основной способ запуска — через `npx`, что делает его совместимым с OpenClaw и другими хостами, запускающими MCP-серверы как локальные подпроцессы.

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

Запуск с явным `project` scope:

```bash
PROJECT_ROOT=$PWD npx -y mcp-vars
```

### Возможности

- `stdio` MCP-сервер для локального subprocess-spawn.
- Два scope:
  - `user` — общее персональное состояние
  - `project` — состояние конкретного репозитория
- Только JSON-native значения.
- Постоянное файловое хранилище с атомарной записью.
- Набор инструментов:
  - `variable_get`
  - `variable_set`
  - `variable_patch`
  - `variable_delete`
  - `variable_list`
- Инсталлятор конфигов для Codex, Claude, Hermes и Qwen.

Типичный ответ:

```json
{
  "status": "ok",
  "key": "project.goal",
  "value": "ship",
  "message": "Loaded variable 'project.goal'.",
  "scope": "project"
}
```

### Хранилище

`user` scope:
- `$XDG_DATA_HOME/mcp-vars/variables.json`
- или `~/.local/share/mcp-vars/variables.json`

`project` scope:
- `${PROJECT_ROOT}/.mcp-vars/variables.json`
- или `${cwd}/.mcp-vars/variables.json`, если `PROJECT_ROOT` не задан

Явные override-переменные:
- `MCP_VARS_USER_DB_PATH`
- `MCP_VARS_PROJECT_DB_PATH`

### Установка в клиенты

Подкоманда `install` записывает конфиг MCP-сервера в поддерживаемые локальные клиенты. Клиенты определяются автоматически по наличию их директорий.

Установка во все обнаруженные клиенты:

```bash
npx -y mcp-vars install
```

Только для выбранных клиентов:

```bash
npx -y mcp-vars install --clients codex claude
```

Под другим именем сервера:

```bash
npx -y mcp-vars install --server-name team-vars
```

Поддерживаемые клиенты и их конфиги:

| Клиент | Файл конфига |
|--------|-------------|
| Codex  | `~/.codex/config.toml` |
| Claude | `~/.claude/settings.json` |
| Hermes | `~/.hermes/config.yaml` |
| Qwen   | `~/.qwen/settings.json` |

Клиент пропускается, если его директория не существует.

В сгенерированные конфиги записывается:
- `command: "npx"`
- `args: ["-y", "mcp-vars"]`
- `cwd` и `PROJECT_ROOT` — текущая директория на момент запуска install

### OpenClaw

Целевой конфиг:

```json
{
  "vars": {
    "command": "npx",
    "args": ["-y", "mcp-vars"]
  }
}
```

Если OpenClaw запускает процесс не из корня workspace:

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

### Разработка

```bash
npm install       # установка зависимостей
npm run dev       # запуск из исходников через tsx
npm run build     # сборка в dist/
npm test          # тесты
```

### Docker

Docker — опциональный путь для разработки или контролируемых окружений.

```bash
docker compose build
docker compose run --rm mcp-vars
```

### Примечания

- Ключи должны соответствовать шаблону `[a-z0-9._-]+`.
- `variable_patch` работает только если текущее значение — объект.
- Если `project` scope не может определить корректный root, сервер возвращает validation error.
