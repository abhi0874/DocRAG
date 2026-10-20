# DocRAG beginner notes — STEP 0

## Open the correct folder

Open Terminal using Spotlight (Cmd+Space, type Terminal, press Return), then:

```sh
cd /Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent
```

A repository is the folder whose Git history tracks your project. The parent
DocRAG folder is empty apart from this clone and its own unrelated Git metadata.
Run `git remote -v` here to confirm abhi0874/DocRAG (the verified renamed original repository).
Use branch `feat/production-rag`; never push to main. No push is needed for setup.

## Install and run locally

```sh
make setup
source .venv/bin/activate
make lint
make test
make build-fe
make run-api
```

A virtual environment (`.venv`) keeps Python helper packages separate from your
Mac's global Python. `make` runs the repeatable commands in the root Makefile.
The application and its API are both Next.js, running at http://localhost:8000.
Stop it with Ctrl+C. `deactivate` leaves the Python environment.
If only JavaScript dependencies need reinstalling, use `pnpm install --frozen-lockfile`.
A lockfile records exact package versions for repeatable installations.

Tests should report passing pytest and Vitest totals and exit with code 0.
Mocks replace Gemini/database calls in unit tests; passing unit tests do not
prove your real credentials or database work. `make check-env` performs that check.

## Private environment settings

In Finder press Cmd+Shift+G and paste the repository path above. Cmd+Shift+.
shows hidden files. Duplicate `.env.example`, name the copy `.env`, and edit it
with your code editor. Keep it plain text and never send keys through chat.

Open https://aistudio.google.com/ in your browser, sign in, open API keys, and
create a key for your project. Put it only in GOOGLE_GENERATIVE_AI_API_KEY.
If you cannot create a key, check the selected Google account/project and its
access permissions. An invalid-key response requires checking the copied value;
a quota response requires waiting or checking the project's quota, not more retries.

DATABASE_URL must point to the isolated development database we approve together.
Do not paste a production connection. If Neon is selected, open https://neon.tech/,
create a separate development project/database, and copy its connection string
privately into .env (retain the supplied TLS settings). Confirm the project is
for development before using any schema initialization script.
DATABASE_URL_PROD is optional and unused here; JWT_SECRET is not required.
The .env file must remain ignored by Git; only .env.example is committed.

## Database choice and safe lifecycle

PostgreSQL stores the documents; pgvector is its extension for vector similarity
search. Docker packages this database in an isolated container with reproducible
configuration. A persistent volume keeps database files when a container stops.

You selected native PostgreSQL, so Docker and Homebrew are not needed.
The installed distribution is Postgres.app v2.9.6 with PostgreSQL 16.15, from
https://postgresapp.com/downloads.html. Installation in /Applications was approved and completed. pgvector 0.8.6 is enabled.
Do not initialize a second server through the app: our helper manages
an isolated cluster for this checkout on port 55432.

After Postgres.app is installed:

```sh
make up
make db-status
make check-env
make stop
```

`make up` initializes PostgreSQL only if this checkout has no database, enables
pgvector, and creates the required tables, search column, and indexes. It uses
private credentials and updates the placeholder DATABASE_URL automatically.
A real existing DATABASE_URL is preserved for your inspection.

`make stop` and `make down` both stop native PostgreSQL without deleting data.
`make up` starts it again. Data and private credentials live under `.local/`, which
Git ignores. Do not delete that folder. Docker-specific commands are not applicable.
If pgvector is unavailable in the installed distribution, we must resolve that
before declaring the database ready.

## Common problems

- `No rule to make target`: run the `cd` command above; you are probably in the parent folder.
- `python: command not found` or import errors: run `make setup`, then activate `.venv`.
- `pnpm: command not found`: reopen Terminal; installation of a global tool needs approval.
- Frozen lockfile mismatch: do not delete the lockfile. Check pnpm 11.25.0 and
  `pnpm-workspace.yaml`; dependency edits require a deliberate lockfile update.
- Database connection refused: start the approved database and check its port;
  authentication failure means privately checking the credentials in `.env`.
- Address already in use: stop the old DocRAG Terminal session with Ctrl+C.
- Native database setup failure: check that the PostgreSQL 16 Postgres.app variant
  is installed; inspect `.local/postgres.log` locally, without posting private values.

## Rename without losing history

The rename has been verified and origin updated; the history was preserved.
For reference, the procedure was: in GitHub, open abhi0874/RAG-Agent → Settings → General → Repository name.
Enter DocRAG and click Rename. If Settings is missing, sign in as the owner;
if the name is taken, do not delete another repository. Check that the existing
commits appear under the new name. After verification, update this clone's origin:

```sh
git remote set-url origin https://github.com/abhi0874/DocRAG.git
git remote -v
```

Do not create a replacement repository. A rename preserves the original history.
Only STEP 0 is in scope; later evaluation and load-test commands intentionally fail.

## Online deployment later

This local database is for development and tests. The final recruiter-facing
application must use an online Next.js deployment and hosted PostgreSQL with
pgvector; it must not depend on your Mac being switched on. This architecture
supports that through DATABASE_URL. Deployment is a later step and has not
been performed in STEP 0.
