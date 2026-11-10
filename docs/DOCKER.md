# Local Docker operation

This is a local development and verification environment, not a deployment.
Run commands from the existing `RAG-Agent` checkout. Keep the other project's
`text-to-sql-db-1` container and its loopback port 55432 untouched.

## Resources and runtime

Compose project `docrag-step9` owns app, migration and database containers,
`docrag-step9_default` network and `docrag-step9_database` volume. The app binds
only 127.0.0.1:8010. PostgreSQL is internal-only on `db:5432`, database
`docrag_container`; it has no host port. The existing native development database
is separately owned at 127.0.0.1:55433, `docrag_dev`. Native services remain necessary
for the historical full evaluation and security contract; Compose does not replace
or import that data. The additional `docrag_ci` database holds synthetic CI checks
inside the dedicated container service.

Node is exactly 24.22.1, pnpm 11.25.0. Dockerfile pins the Node bookworm-slim image
by digest and uses frozen dependencies, a separate migration target, a build target
and a non-root standalone runtime (UID 1000). PostgreSQL is pgvector 0.8.1 on
PostgreSQL 16, also pinned by digest. The runtime includes public/static assets and
the bounded PDF extraction worker. Environment files, local environments, benchmark
results and model weights are excluded by the build-context allowlist.

## Private configuration

The existing `.local/step9-compose.env` is ignored and mode 0600. Do not print it,
commit it or run plain `docker compose config`, which expands its values. Required
variables are `DOCRAG_CONTAINER_DB_PASSWORD`, `DOCRAG_CONTAINER_DATABASE_URL` and
`DOCRAG_CONTAINER_AUTH_SECRET`. The URL must use the matching password and exact
host/database `db:5432/docrag_container`. Port defaults to 8010. Never reuse a
production database or copy another project's environment.

For a *new* checkout only, generate fresh local values without displaying them:

```sh
.venv/bin/python - <<'PY'
from pathlib import Path
import os, secrets
root = Path('.local'); root.mkdir(mode=0o700, exist_ok=True)
p = secrets.token_urlsafe(32)
text = ('DOCRAG_CONTAINER_DB_PASSWORD=' + p + '\n'
        'DOCRAG_CONTAINER_DATABASE_URL=postgresql://docrag:' + p
        + '@db:5432/docrag_container\n'
        'DOCRAG_CONTAINER_AUTH_SECRET=' + secrets.token_urlsafe(48) + '\n')
fd = os.open(root / 'step9-compose.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f: f.write(text)
PY
```

`FileExistsError` intentionally protects existing credentials. Never regenerate the
password over an initialized volume. A password mismatch requires restoring the
original private configuration, not deleting the volume.

## Build, start, verify and stop

```sh
docker compose --env-file .local/step9-compose.env config --quiet
docker compose --env-file .local/step9-compose.env build
docker compose --env-file .local/step9-compose.env up -d
docker compose --env-file .local/step9-compose.env ps
curl --fail http://127.0.0.1:8010/sign-in
.venv/bin/python -m scripts.container_http
```

Startup waits for the database health check and successful migration. The migration
creates the 768-dimensional local schema and applies actual Drizzle migrations.
Repeated application preserves rows and sessions. Never run it against historical
evaluation databases. Container HTTP verification generates random accounts and
public-text PDFs; it retains its synthetic fixture data, tests auth/ownership/chat,
feedback, cancellation, expiration, restarts and recovery. It briefly stops **only**
DocRAG's app/database and restores them in `finally`. Run it without concurrent
DocRAG users. It checks the known other project's container identity/start time,
mounts, ports and health before and after. This proves isolation only within that
test window. The broader historical restart attribution remains unknown. The
helper preserves an unrelated container that is either healthy/running or exited;
if stopped, never start it merely to satisfy the helper. Request service permission before running
the DocRAG restart/outage checks. This fixture assumes test port 8010.

```sh
docker compose --env-file .local/step9-compose.env stop app db
# Later, restore the same data and sessions:
docker compose --env-file .local/step9-compose.env start db app
```

`stop` retains the named volume. Do not use `down -v`, delete volumes, or run prune.
App shutdown uses Docker's init process and a 30-second grace period. Verify health
again after a restart. If 8010 is occupied, inspect its owner; do not stop another
project. An alternate port can be configured for ordinary use, but update the test
harness explicitly before claiming those tests passed on another port.

## Models and authentication

The macOS host supplies existing Ollama models through the explicitly allowed
`http://host.docker.internal:11434` endpoint. Inside a container, localhost refers
to that container. Docker Desktop connectivity and real inference were tested;
do not assume this hostname works on a generic Linux host. Ollama must not be
published on the internet. Neither model weights nor an Ollama server are bundled.
The full benchmark separately requires preserved Ollama 0.40.9 and the frozen model
digests; see [command contract](COMMAND_CONTRACT.md).

MiniLM remains disabled. No macOS Python environment is copied into Linux. The
Linux missing-runtime fallback returns the original hybrid ranking; optional
portable reranker packaging is not implemented here. Native optional reranking
remains available, with its existing removal guide in [RERANKING](RERANKING.md).

Better Auth uses the exact loopback application origin, fixed eight-hour database
sessions, HttpOnly/SameSite=Lax cookies and the explicit local HTTP exception.
Online hosting will require HTTPS and a separate inference design. This step does
not deploy or weaken origin, ACL, cache or session checks. Synthetic smoke-test
accounts do not establish a personal administrator account or public signup.

## Optional verification-tool cleanup

After tests finish, the temporary CI toolbox image can be removed with
`docker image rm docrag-step9-ci-tools:local`. This names only DocRAG's test image
and does not delete the database volume. The isolated test checkout and Python
environment are in `.local/step9-ci-workspace` and `.local/step9-ci-python`; after
stopping their test processes, those specific folders can be moved to Trash. Keep
verification logs if you want the local audit trail. Never delete `.local` itself:
it also contains the native PostgreSQL data, credentials and preserved models.
