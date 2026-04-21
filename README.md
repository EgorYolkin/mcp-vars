# mcp-vars

[![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![MCP](https://img.shields.io/badge/MCP-server-111111)](https://modelcontextprotocol.io/)
[![FastMCP](https://img.shields.io/badge/FastMCP-2.9.2-0A7B83)](https://github.com/prefecthq/fastmcp)
[![SQLite](https://img.shields.io/badge/storage-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/index.html)
[![Scopes](https://img.shields.io/badge/scopes-user%20%7C%20project-4C1)](#english)
[![Clients](https://img.shields.io/badge/clients-Codex%20%7C%20Claude%20%7C%20Hermes%20%7C%20Qwen-6A5ACD)](#english)

[English](#english) | [Русский](#russian)

## English

`mcp-vars` is a persistent variable store for MCP agents. It keeps small JSON-native values in SQLite and exposes them through simple tools so agents can preserve state across tool calls, sessions, and parallel runs.

### Quick Start

Choose one of two setup paths.

#### Option A. Docker Compose

Build the image:

```bash
docker compose build
```

Run the MCP server:

```bash
docker compose run --rm mcp-vars
```

This starts `mcp-vars` as a `stdio` MCP process with:
- the repository mounted to `/app`
- `PROJECT_ROOT=/app`
- persistent user-scope storage in a Docker volume

Important: `mcp-vars` is a `stdio` MCP server, so `docker compose run --rm mcp-vars` is the correct workflow. `docker compose up -d` is not the primary usage mode.

#### Option B. Local Python Environment

Create a virtual environment and install the package:

```bash
python3 -m venv .env
. .env/bin/activate
pip install .
```

If you are installing from local source inside a restricted container image, use:

```bash
pip install . --no-build-isolation
```

Register the server in supported clients:

```bash
mcp-vars install
```

Run the server:

```bash
mcp-vars
```

If you want editable local development instead of a regular install:

```bash
pip install -e .
```

If you want `project` scope outside the installer, run with `PROJECT_ROOT`:

```bash
PROJECT_ROOT=$PWD mcp-vars
```

You can also install it with `pipx`:

```bash
pipx install .
```

`project` scope requires `PROJECT_ROOT` or `MCP_VARS_PROJECT_DB_PATH`.
`user` scope defaults to:
- `$XDG_DATA_HOME/mcp-vars/variables.db`
- or `~/.local/share/mcp-vars/variables.db`

### Features

- Persistent storage in SQLite instead of in-memory state.
- Two scopes: `user` for shared personal state and `project` for repository-local state.
- JSON-native values only: strings, numbers, booleans, `null`, arrays, and objects.
- Small tool surface: `variable_get`, `variable_set`, `variable_patch`, `variable_delete`, `variable_list`.
- Shallow patching for object values.
- Dot-notation key validation such as `project.goal` or `session.counter`.
- Installer support for Codex, Claude, Hermes, and Qwen.
- MCP resource `instructions://usage` for lightweight usage guidance.

Typical response:

```json
{
  "status": "ok",
  "key": "project.goal",
  "value": "ship",
  "message": "Loaded variable 'project.goal'.",
  "scope": "project"
}
```

Tool overview:

| Tool | Description |
| --- | --- |
| `variable_get` | Read one value by key |
| `variable_set` | Create or overwrite a value |
| `variable_patch` | Shallow-merge object fields |
| `variable_delete` | Remove one key |
| `variable_list` | List keys, optionally by prefix |

### Use Cases

#### 1. Development Workflow Memory

Store working context that agents should not ask for on every step.

Example keys:
- `project.current_ticket`
- `project.default_branch`
- `project.release.target`
- `project.feature_flags`

Example value:

```json
{
  "current_ticket": "LIN-142",
  "default_branch": "main",
  "staging_url": "https://staging.example.com"
}
```

#### 2. Personal Assistant State

Use `user` scope for durable preferences and personal context.

Example keys:
- `profile.preferred_language`
- `profile.timezone`
- `profile.work_hours`
- `shopping.current_list`
- `planning.weekly_goal`

Example value:

```json
{
  "preferred_language": "ru",
  "timezone": "Asia/Yekaterinburg",
  "response_style": "direct"
}
```

#### 3. Cross-Agent Coordination

Parallel agents can exchange lightweight state through shared keys instead of rewriting files.

Example keys:
- `session.plan.status`
- `session.research.completed`
- `session.review.blockers`
- `session.counter`

#### 4. Project-Local Automation

Use `project` scope for repository-specific values that must not leak into other projects.

Example keys:
- `deploy.target`
- `figma.file_key`
- `tests.demo_account`
- `db.last_migration`

#### 5. What `mcp-vars` Is Not For

Do not use this server for:
- secrets and API keys
- large blobs or binary data
- long documents and logs
- analytics workloads
- replacing a real database

### Client Installation

The installer updates existing client config directories only. If a client directory does not exist, it is skipped.

Supported config targets:
- Codex: `~/.codex/config.toml`
- Claude: `~/.claude/settings.json`
- Hermes: `~/.hermes/config.yaml`
- Qwen: `~/.qwen/settings.json`

Install for all detected clients:

```bash
mcp-vars install
```

Install for selected clients only:

```bash
mcp-vars install --clients codex claude
```

Register under a custom server name:

```bash
mcp-vars install --server-name team-vars
```

The generated config includes `PROJECT_ROOT`, so `project` scope works after installation without extra manual setup.

### Docker

Included files:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `docker-entrypoint.sh`

Recommended commands:

```bash
docker compose build
docker compose run --rm mcp-vars
```

The Compose service mounts the current repository into the container and stores `user` scope in the `mcp_vars_user_data` volume.

Equivalent direct `docker run` command:

```bash
docker run --rm -i \
  -e PROJECT_ROOT=/app \
  -e MCP_VARS_USER_DB_PATH=/data/user/variables.db \
  -v "$PWD":/app \
  -v mcp_vars_user_data:/data/user \
  mcp-vars:local
```

### OpenClaw Integration

If OpenClaw launches MCP servers as local subprocesses, the clean setup is to install `mcp-vars` inside the same OpenClaw image instead of trying to call Docker or SSH from inside OpenClaw.

Files prepared for this flow:
- `deploy/openclaw/Dockerfile`
- `deploy/openclaw/openclaw-mcp-vars.sh`
- `deploy/openclaw/mcp-config.json`

What they do:
- install Python and `mcp-vars` into the OpenClaw image
- expose a wrapper command at `/usr/local/bin/openclaw-mcp-vars`
- auto-populate `PROJECT_ROOT` from `OPENCLAW_WORKSPACE`, `WORKSPACE_DIR`, or current working directory
- default `MCP_VARS_USER_DB_PATH` to `/var/lib/mcp-vars/user/variables.db`

Build an OpenClaw image with `mcp-vars` embedded:

```bash
docker build -f deploy/openclaw/Dockerfile -t openclaw-with-mcp-vars .
```

Use this MCP config in OpenClaw:

```json
{
  "vars": {
    "command": "/usr/local/bin/openclaw-mcp-vars",
    "args": []
  }
}
```

This is the intended production path for `stdio` usage in OpenClaw. It avoids Docker-in-Docker, SSH wrappers, and remote workspace coupling.

### Development

Run tests:

```bash
make test
make test-unit
make test-integration
```

Main entry points:
- `mcp-vars`
- `mcp-vars install`

### Notes

- Keys must match `[a-z0-9._-]+`.
- `variable_patch` works only when the current value is an object.
- If `project` scope is unavailable, the server returns a validation error instead of silently falling back to `user`.

## Russian

`mcp-vars` — это MCP-сервер с постоянным хранилищем переменных для агентов. Он сохраняет небольшие JSON-совместимые значения в SQLite и отдаёт их через простой набор инструментов, чтобы агент мог сохранять состояние между вызовами tools, сессиями и параллельными запусками.

### Быстрый старт

Выберите один из двух способов запуска.

#### Вариант A. Docker Compose

Соберите образ:

```bash
docker compose build
```

Запустите MCP-сервер:

```bash
docker compose run --rm mcp-vars
```

Такой запуск стартует `mcp-vars` как `stdio` MCP-процесс:
- репозиторий монтируется в `/app`
- выставляется `PROJECT_ROOT=/app`
- `user` scope хранится в постоянном Docker volume

Важно: `mcp-vars` работает как `stdio` MCP-сервер, поэтому правильный сценарий запуска через Compose — `docker compose run --rm mcp-vars`. `docker compose up -d` здесь не основной режим работы.

#### Вариант B. Локальное Python-окружение

Создайте виртуальное окружение и установите пакет:

```bash
python3 -m venv .env
. .env/bin/activate
pip install .
```

Если пакет ставится из локального исходника внутри ограниченного контейнера, используйте:

```bash
pip install . --no-build-isolation
```

Зарегистрируйте сервер в поддерживаемых клиентах:

```bash
mcp-vars install
```

Запустите сервер:

```bash
mcp-vars
```

Если нужен editable-режим для локальной разработки:

```bash
pip install -e .
```

Если нужен `project` scope вне инсталлятора, запускайте с `PROJECT_ROOT`:

```bash
PROJECT_ROOT=$PWD mcp-vars
```

Также можно установить пакет через `pipx`:

```bash
pipx install .
```

Для `project` scope нужен `PROJECT_ROOT` или `MCP_VARS_PROJECT_DB_PATH`.
`user` scope по умолчанию хранится в:
- `$XDG_DATA_HOME/mcp-vars/variables.db`
- или `~/.local/share/mcp-vars/variables.db`

### Возможности

- Постоянное хранение данных в SQLite вместо памяти процесса.
- Два scope: `user` для общего персонального состояния и `project` для состояния конкретного репозитория.
- Поддерживаются только JSON-native значения: строки, числа, булевы значения, `null`, массивы и объекты.
- Небольшой набор инструментов: `variable_get`, `variable_set`, `variable_patch`, `variable_delete`, `variable_list`.
- Частичное обновление объектов через shallow merge.
- Валидация ключей в формате dot-notation, например `project.goal` или `session.counter`.
- Установка в конфиги Codex, Claude, Hermes и Qwen.
- MCP-ресурс `instructions://usage` с краткими правилами использования.

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

Обзор инструментов:

| Tool | Назначение |
| --- | --- |
| `variable_get` | Прочитать одно значение по ключу |
| `variable_set` | Создать или перезаписать значение |
| `variable_patch` | Частично обновить поля объекта |
| `variable_delete` | Удалить один ключ |
| `variable_list` | Показать ключи, при необходимости по префиксу |

### Юзкейсы

#### 1. Память для процесса разработки

Храните рабочий контекст, который агенту нужен постоянно и который не должен каждый раз заново извлекаться из чата, тикетов или файлов.

Примеры ключей:
- `project.current_ticket`
- `project.default_branch`
- `project.release.target`
- `project.feature_flags`

Пример значения:

```json
{
  "current_ticket": "LIN-142",
  "default_branch": "main",
  "staging_url": "https://staging.example.com"
}
```

#### 2. Состояние персонального ассистента

Используйте `user` scope для предпочтений и долгоживущего персонального контекста.

Примеры ключей:
- `profile.preferred_language`
- `profile.timezone`
- `profile.work_hours`
- `shopping.current_list`
- `planning.weekly_goal`

Пример значения:

```json
{
  "preferred_language": "ru",
  "timezone": "Asia/Yekaterinburg",
  "response_style": "direct"
}
```

#### 3. Координация между агентами

Параллельные агенты могут обмениваться небольшим состоянием через общие ключи, не создавая и не переписывая промежуточные файлы.

Примеры ключей:
- `session.plan.status`
- `session.research.completed`
- `session.review.blockers`
- `session.counter`

#### 4. Автоматизация внутри проекта

`project` scope подходит для данных конкретного репозитория, которые не должны пересекаться с другими проектами.

Примеры ключей:
- `deploy.target`
- `figma.file_key`
- `tests.demo_account`
- `db.last_migration`

#### 5. Для чего `mcp-vars` не подходит

Не используйте сервер для:
- секретов и API-ключей
- больших blob-данных и бинарных файлов
- длинных документов и логов
- аналитических нагрузок
- замены полноценной базы данных

### Установка в клиенты

Инсталлятор обновляет только уже существующие директории конфигурации клиентов. Если директория клиента не найдена, этот клиент пропускается.

Поддерживаемые конфиги:
- Codex: `~/.codex/config.toml`
- Claude: `~/.claude/settings.json`
- Hermes: `~/.hermes/config.yaml`
- Qwen: `~/.qwen/settings.json`

Установка во все найденные клиенты:

```bash
mcp-vars install
```

Установка только в выбранные клиенты:

```bash
mcp-vars install --clients codex claude
```

Регистрация под другим именем:

```bash
mcp-vars install --server-name team-vars
```

Сгенерированный конфиг автоматически включает `PROJECT_ROOT`, поэтому `project` scope после установки работает без дополнительной ручной настройки.

### Docker

В репозитории уже есть:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `docker-entrypoint.sh`

Рекомендуемые команды:

```bash
docker compose build
docker compose run --rm mcp-vars
```

Compose-сервис монтирует текущий репозиторий внутрь контейнера и хранит `user` scope в volume `mcp_vars_user_data`.

Эквивалентная команда `docker run`:

```bash
docker run --rm -i \
  -e PROJECT_ROOT=/app \
  -e MCP_VARS_USER_DB_PATH=/data/user/variables.db \
  -v "$PWD":/app \
  -v mcp_vars_user_data:/data/user \
  mcp-vars:local
```

### Интеграция с OpenClaw

Если OpenClaw запускает MCP-серверы как локальные подпроцессы, правильный путь — установить `mcp-vars` внутрь того же образа OpenClaw, а не пытаться вызывать Docker или SSH изнутри OpenClaw.

Для этого уже подготовлены файлы:
- `deploy/openclaw/Dockerfile`
- `deploy/openclaw/openclaw-mcp-vars.sh`
- `deploy/openclaw/mcp-config.json`

Что они делают:
- устанавливают Python и `mcp-vars` внутрь образа OpenClaw
- добавляют wrapper-команду `/usr/local/bin/openclaw-mcp-vars`
- автоматически выставляют `PROJECT_ROOT` из `OPENCLAW_WORKSPACE`, `WORKSPACE_DIR` или текущей рабочей директории
- по умолчанию используют `MCP_VARS_USER_DB_PATH=/var/lib/mcp-vars/user/variables.db`

Сборка образа OpenClaw с уже встроенным `mcp-vars`:

```bash
docker build -f deploy/openclaw/Dockerfile -t openclaw-with-mcp-vars .
```

Конфиг MCP для OpenClaw:

```json
{
  "vars": {
    "command": "/usr/local/bin/openclaw-mcp-vars",
    "args": []
  }
}
```

Это и есть правильный production-сценарий для `stdio` режима в OpenClaw. Он не требует Docker-in-Docker, SSH-обёрток и общего remote workspace.

### Разработка

Запуск тестов:

```bash
make test
make test-unit
make test-integration
```

Основные точки входа:
- `mcp-vars`
- `mcp-vars install`

### Примечания

- Ключи должны соответствовать шаблону `[a-z0-9._-]+`.
- `variable_patch` работает только если текущее значение является объектом.
- Если `project` scope недоступен, сервер вернёт ошибку валидации, а не будет молча переключаться на `user`.
