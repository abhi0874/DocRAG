SHELL := /bin/sh
PYTHON := .venv/bin/python
export PATH := $(CURDIR)/.venv/bin:$(PATH)

.PHONY: setup lint test cov build-fe run-api eval eval-gate up down stop load check-env db-query db-status
setup:
	python3 -m venv .venv
	$(PYTHON) -m pip install -r requirements-dev.txt
	pnpm install --frozen-lockfile
lint:
	$(PYTHON) -m ruff check .
	$(PYTHON) -m ruff format --check .
	pnpm lint
	pnpm typecheck
test:
	$(PYTHON) -m pytest -q
	pnpm test
cov:
	$(PYTHON) -m pytest -q --cov=scripts --cov-report=term-missing --cov-report=html:coverage/python
	pnpm test:coverage
build-fe:
	pnpm build
run-api:
	pnpm dev --hostname 127.0.0.1 --port 8000
check-env:
	$(PYTHON) scripts/check_env.py
db-query:
	$(PYTHON) scripts/db_query.py "SELECT extname FROM pg_extension WHERE extname = 'vector'"
eval:
	@echo 'STEP 2 not yet implemented: python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/latest.json' >&2
	@exit 1
eval-gate:
	@echo 'STEP 2 not yet implemented: python -m eval.check_regression --baseline eval/results/baseline.json --current eval/results/latest.json' >&2
	@exit 1
load:
	@echo 'STEP 10 load testing is not yet implemented.' >&2
	@exit 1
up:
	$(PYTHON) scripts/native_db.py up
stop down:
	$(PYTHON) scripts/native_db.py stop
db-status:
	$(PYTHON) scripts/native_db.py status
