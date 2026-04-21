.PHONY: install-mcp run run-project test test-unit test-integration

PYTHON ?= $(if $(wildcard .env/bin/python),.env/bin/python,python3)

install-mcp:
	$(PYTHON) -m src.main install

run:
	$(PYTHON) -m src.main

run-project:
	PROJECT_ROOT=$(CURDIR) $(PYTHON) -m src.main

test:
	$(PYTHON) -m pytest

test-unit:
	$(PYTHON) -m pytest tests/unit

test-integration:
	$(PYTHON) -m pytest tests/integration
