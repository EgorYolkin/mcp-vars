# mcp-vars

[![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![MCP](https://img.shields.io/badge/MCP-server-111111)](https://modelcontextprotocol.io/)
[![FastMCP](https://img.shields.io/badge/FastMCP-2.9.2-0A7B83)](https://github.com/prefecthq/fastmcp)
[![SQLite](https://img.shields.io/badge/storage-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/index.html)
[![Scopes](https://img.shields.io/badge/scopes-user%20%7C%20project-4C1)](#features--vozmozhnosti)
[![Clients](https://img.shields.io/badge/clients-Codex%20%7C%20Claude%20%7C%20Hermes%20%7C%20Qwen-6A5ACD)](#quick-start--bystraya-ustanovka)

Persistent variable store for MCP agents. `mcp-vars` provides a small, durable JSON-native state layer on top of SQLite so agents can remember values between tool calls, sessions, and parallel runs.

`mcp-vars` — это MCP-сервер с постоянным хранилищем переменных для агентов. Он сохраняет небольшие JSON-совместимые значения в SQLite и отдаёт их через простые инструменты для `project` и `user` scope.

## Quick Start / Быстрая установка

### English

1. Create a virtual environment and install dependencies:

```bash
python3 -m venv .env
. .env/bin/activate
pip install -r requirements.txt
```

2. Register the server in supported clients:

```bash
make install-mcp
```

This installs `mcp-vars` into detected client configs for:
- Codex
- Claude
- Hermes
- Qwen

3. Run the server:

```bash
make run
```

4. Enable `project` scope when you want repository-local storage:

```bash
make run-project
```

`project` scope requires `PROJECT_ROOT` or `MCP_VARS_PROJECT_DB_PATH`.  
`user` scope always works and defaults to:
- `$XDG_DATA_HOME/mcp-vars/variables.db`
- or `~/.local/share/mcp-vars/variables.db`

### Русский

1. Создайте виртуальное окружение и установите зависимости:

```bash
python3 -m venv .env
. .env/bin/activate
pip install -r requirements.txt
```

2. Зарегистрируйте сервер в поддерживаемых клиентах:

```bash
make install-mcp
```

Команда добавляет `mcp-vars` в найденные конфиги:
- Codex
- Claude
- Hermes
- Qwen

3. Запустите сервер:

```bash
make run
```

4. Для локального хранения на уровне репозитория запускайте сервер с `project` scope:

```bash
make run-project
```

Для `project` scope нужен `PROJECT_ROOT` или `MCP_VARS_PROJECT_DB_PATH`.  
`user` scope работает всегда и по умолчанию хранит данные в:
- `$XDG_DATA_HOME/mcp-vars/variables.db`
- или `~/.local/share/mcp-vars/variables.db`

## Features / Возможности

### English

- Persistent storage in SQLite instead of ephemeral in-memory state.
- Two scopes:
  `user` for shared personal state and `project` for repository-local state.
- JSON-native values only: string, number, boolean, `null`, arrays, and objects.
- Simple tool surface:
  `variable_get`, `variable_set`, `variable_patch`, `variable_delete`, `variable_list`.
- Safe partial updates through shallow object patching.
- Key validation with dot-notation style keys such as `project.goal` or `session.counter`.
- Automatic client config installation for Codex, Claude, Hermes, and Qwen.
- MCP resource `instructions://usage` for lightweight usage guidance.

Typical response shape:

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

| Tool | What it does |
| --- | --- |
| `variable_get` | Read one value by key |
| `variable_set` | Create or overwrite a value |
| `variable_patch` | Shallow-merge object fields |
| `variable_delete` | Remove one key |
| `variable_list` | Discover keys, optionally by prefix |

### Русский

- Данные хранятся в SQLite, а не в памяти процесса.
- Два уровня изоляции:
  `user` для персонального общего состояния и `project` для состояния конкретного репозитория.
- Поддерживаются только JSON-native значения: строка, число, булево значение, `null`, массивы и объекты.
- Небольшой и понятный набор инструментов:
  `variable_get`, `variable_set`, `variable_patch`, `variable_delete`, `variable_list`.
- Частичные обновления объектов через shallow merge.
- Проверка ключей с dot-notation, например `project.goal` или `session.counter`.
- Автоматическая регистрация сервера в Codex, Claude, Hermes и Qwen.
- MCP-ресурс `instructions://usage` с краткими правилами использования.

Типичный ответ инструмента:

```json
{
  "status": "ok",
  "key": "project.goal",
  "value": "ship",
  "message": "Loaded variable 'project.goal'.",
  "scope": "project"
}
```

Инструменты:

| Tool | Назначение |
| --- | --- |
| `variable_get` | Прочитать значение по ключу |
| `variable_set` | Создать или перезаписать значение |
| `variable_patch` | Частично обновить объект |
| `variable_delete` | Удалить один ключ |
| `variable_list` | Посмотреть ключи, при необходимости по префиксу |

## Use Cases / Юзкейсы

### 1. Development workflow memory / Память для разработки

**English**

Store working context that agents should not ask for on every step:

```json
{
  "current_ticket": "LIN-142",
  "default_branch": "main",
  "staging_url": "https://staging.example.com"
}
```

Good keys:
- `project.current_ticket`
- `project.default_branch`
- `project.release.target`
- `project.feature_flags`

**Русский**

Храните рабочий контекст, который агенту нужен постоянно, но который не должен жить в коде:

```json
{
  "current_ticket": "LIN-142",
  "default_branch": "main",
  "staging_url": "https://staging.example.com"
}
```

Подходящие ключи:
- `project.current_ticket`
- `project.default_branch`
- `project.release.target`
- `project.feature_flags`

### 2. Personal assistant state / Состояние персонального ассистента

**English**

Use `user` scope for preferences and durable personal context:

```json
{
  "preferred_language": "ru",
  "timezone": "Asia/Yekaterinburg",
  "response_style": "direct"
}
```

Good keys:
- `profile.preferred_language`
- `profile.timezone`
- `profile.work_hours`
- `shopping.current_list`
- `planning.weekly_goal`

**Русский**

Используйте `user` scope для предпочтений и устойчивого персонального контекста:

```json
{
  "preferred_language": "ru",
  "timezone": "Asia/Yekaterinburg",
  "response_style": "direct"
}
```

Подходящие ключи:
- `profile.preferred_language`
- `profile.timezone`
- `profile.work_hours`
- `shopping.current_list`
- `planning.weekly_goal`

### 3. Cross-agent coordination / Координация между агентами

**English**

Parallel agents can exchange lightweight state through shared keys instead of rewriting files:
- `session.plan.status`
- `session.research.completed`
- `session.review.blockers`
- `session.counter`

This is useful when one agent collects data and another agent consumes or updates it later.

**Русский**

Параллельные агенты могут обмениваться небольшим состоянием через общие ключи, не переписывая файлы:
- `session.plan.status`
- `session.research.completed`
- `session.review.blockers`
- `session.counter`

Это удобно, когда один агент собирает данные, а другой затем читает или обновляет их.

### 4. Project-local automation / Автоматизация внутри проекта

**English**

`project` scope is useful for repository-specific values that must not leak into other projects:
- deployment target
- local MCP file keys
- test accounts
- migration checkpoints
- generated artifact metadata

Example keys:
- `deploy.target`
- `figma.file_key`
- `tests.demo_account`
- `db.last_migration`

**Русский**

`project` scope подходит для данных конкретного репозитория, которые не должны пересекаться с другими проектами:
- цель деплоя
- локальные ключи MCP и Figma
- тестовые аккаунты
- контрольные точки миграций
- метаданные сгенерированных артефактов

Примеры ключей:
- `deploy.target`
- `figma.file_key`
- `tests.demo_account`
- `db.last_migration`

### 5. What this server is not for / Для чего сервер не подходит

**English**

Do not use `mcp-vars` for:
- secrets and API keys
- large blobs or binary data
- long documents and logs
- analytics queries
- replacing a real database

**Русский**

Не используйте `mcp-vars` для:
- секретов и API-ключей
- больших blob-данных и бинарных файлов
- длинных документов и логов
- аналитических запросов
- замены полноценной базы данных

## Client Installation Details / Детали установки для клиентов

### English

The installer patches existing config directories only. If a client directory does not exist, that client is skipped.

Supported config targets:
- Codex: `~/.codex/config.toml`
- Claude: `~/.claude/settings.json`
- Hermes: `~/.hermes/config.yaml`
- Qwen: `~/.qwen/settings.json`

You can limit installation to specific clients:

```bash
python -m src.main install --clients codex claude
```

You can also rename the registered server:

```bash
python -m src.main install --server-name team-vars
```

### Русский

Инсталлятор изменяет только уже существующие каталоги конфигурации. Если каталог клиента не найден, этот клиент пропускается.

Поддерживаемые пути конфигов:
- Codex: `~/.codex/config.toml`
- Claude: `~/.claude/settings.json`
- Hermes: `~/.hermes/config.yaml`
- Qwen: `~/.qwen/settings.json`

Можно установить сервер только для выбранных клиентов:

```bash
python -m src.main install --clients codex claude
```

При необходимости можно сменить имя регистрируемого сервера:

```bash
python -m src.main install --server-name team-vars
```

## Development / Разработка

### English

Run tests:

```bash
make test
make test-unit
make test-integration
```

Project entry points:
- `python -m src.main`
- `python -m src.main install`

### Русский

Запуск тестов:

```bash
make test
make test-unit
make test-integration
```

Основные точки входа:
- `python -m src.main`
- `python -m src.main install`

## Notes / Примечания

### English

- Keys must match `[a-z0-9._-]+`.
- `variable_patch` works only when the current value is an object.
- If `project` scope is unavailable, the server returns a validation error instead of silently falling back to `user`.

### Русский

- Ключи должны соответствовать шаблону `[a-z0-9._-]+`.
- `variable_patch` работает только если текущее значение является объектом.
- Если `project` scope не инициализирован, сервер вернёт ошибку валидации, а не будет молча переключаться на `user`.
