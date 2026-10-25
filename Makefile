SHELL := /bin/sh
PYTHON := .venv/bin/python
ifeq ($(AI_PROVIDER),ollama)
EVAL_LATEST := eval/results/latest-local-ollama.json
EVAL_BASELINE := eval/results/baseline-local-ollama.json
else
EVAL_LATEST := eval/results/latest.json
EVAL_BASELINE := eval/results/baseline.json
endif

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
	$(PYTHON) -m eval.run_eval --golden eval/golden_set.jsonl --out $(EVAL_LATEST)
eval-gate:
	$(PYTHON) -m eval.check_regression --baseline $(EVAL_BASELINE) --current $(EVAL_LATEST)
load:
	@echo 'STEP 10 load testing is not yet implemented.' >&2
	@exit 1
up:
	$(PYTHON) scripts/native_db.py up
stop down:
	$(PYTHON) scripts/native_db.py stop
db-status:
	$(PYTHON) scripts/native_db.py status

.PHONY: local-check local-ingest local-calibrate
local-check:
	AI_PROVIDER=ollama $(PYTHON) -m eval.local_setup --check
local-ingest:
	AI_PROVIDER=ollama $(PYTHON) -m eval.local_setup --ingest
local-calibrate:
	AI_PROVIDER=ollama $(PYTHON) -m eval.local_calibration

.PHONY: local-calibrate-automated local-validate-results
local-calibrate-automated:
	$(PYTHON) -m eval.automated_validation
local-validate-results:
	$(PYTHON) -m eval.promote_local --source eval/results/latest-local-ollama.json --out eval/results/latest-local-ollama.json
