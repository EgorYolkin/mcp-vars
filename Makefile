.PHONY: install-mcp run run-project build test test-unit test-integration

NODE ?= node
NPM ?= npm

install-mcp:
	npx -y tsx src/cli.ts install

run:
	npx -y tsx src/cli.ts

run-project:
	PROJECT_ROOT=$(CURDIR) npx -y tsx src/cli.ts

build:
	$(NPM) run build

test:
	$(NPM) test

test-unit:
	$(NPM) test -- tests/unit

test-integration:
	$(NPM) test -- tests/integration
