# Tracewave — common tasks. Override the Python launcher on Windows: `make test PY=py`
PY ?= python
COMPOSE ?= docker compose

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ----- Docker stack -------------------------------------------------------- #
.PHONY: up
up: ## Build + start the full stack (detached)
	$(COMPOSE) up --build -d
	@echo "dashboard  -> http://localhost:3000"
	@echo "api        -> http://localhost:8000/api/health"
	@echo "prometheus -> http://localhost:9090"
	@echo "grafana    -> http://localhost:3001"

.PHONY: up-fg
up-fg: ## Build + start in the foreground (see logs)
	$(COMPOSE) up --build

.PHONY: down
down: ## Stop the stack
	$(COMPOSE) down

.PHONY: clean
clean: ## Stop the stack and drop volumes (wipes TimescaleDB)
	$(COMPOSE) down -v

.PHONY: logs
logs: ## Tail all service logs
	$(COMPOSE) logs -f

.PHONY: ps
ps: ## Show service status
	$(COMPOSE) ps

# ----- Local (no infra) ---------------------------------------------------- #
.PHONY: venv
venv: ## Create the backend venv + install (dev extras)
	cd backend && $(PY) -m venv .venv && .venv/bin/pip install -e ".[dev]"

.PHONY: dev
dev: ## Run the whole pipeline single-process against the live firehose
	cd backend && $(PY) -m tracewave.run.dev

.PHONY: web
web: ## Run the dashboard dev server
	cd frontend && npm run dev

.PHONY: test
test: ## Run the backend test suite
	cd backend && $(PY) -m pytest -q

# ----- Data ---------------------------------------------------------------- #
.PHONY: record
record: ## Tee ~60s of the live firehose to data/sample.jsonl
	cd backend && TW_RECORD_FILE=../data/sample.jsonl $(PY) -m tracewave.run.ingestor

.PHONY: replay
replay: ## Run the pipeline from the recorded sample (offline demo)
	cd backend && TW_REPLAY_FILE=../data/sample.jsonl TW_REPLAY_SPEED=1 $(PY) -m tracewave.run.dev
