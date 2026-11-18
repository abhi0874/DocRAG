"""Real local account/upload/RAG acceptance, using only new synthetic fixtures."""

import argparse
import json
import os
import secrets
import socket
import subprocess
import textwrap
import time
from contextlib import contextmanager
from http.client import HTTPConnection
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from eval.chunking_experiments import experiment_url
from eval.corpus import ROOT
from scripts import security_http as http
from scripts.native_db import DATA, owned_cluster


def fixture_pdf(text):
    """Keep all synthetic evidence inside the page instead of clipping one long line."""
    lines = textwrap.wrap(text, width=65)
    escaped = [
        line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        for line in lines
    ]
    return http.pdf(") Tj 0 -18 Td (".join(escaped))


def create_database(directory, cloud=False):
    """Copy only frozen public corpus into a new test database; never edit source."""
    owned_cluster()
    source = experiment_url("heading-1400-280")
    if cloud:
        source = urlunsplit(urlsplit(source)._replace(path="/docrag_demo_gemini_v1"))
    with psycopg.connect(source) as conn:
        conn.read_only = True
        assert Path(conn.execute("SHOW data_directory").fetchone()[0]) == DATA
        assert conn.execute("SHOW port").fetchone()[0] == "55433"
    name = "docrag_security_test_" + secrets.token_hex(6)
    target = urlunsplit(urlsplit(source)._replace(path="/" + name))
    with psycopg.connect(source, autocommit=True) as conn:
        conn.execute(
            sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(
                sql.Identifier(name)
            )
        )
    with psycopg.connect(target) as conn:
        conn.execute(
            (ROOT / "db/init.sql")
            .read_text()
            .replace("vector(1536)", "vector(1536)" if cloud else "vector(768)")
        )
    with psycopg.connect(source) as src, psycopg.connect(target) as dst:
        src.read_only = True
        for table, columns in [
            ("documents", "id,title,filename,page_count,chunk_count,status,created_at"),
            (
                "chunks",
                "id,document_id,chunk_index,page_number,content,embedding,created_at,metadata",
            ),
        ]:
            with src.cursor().copy(f"COPY {table} ({columns}) TO STDOUT") as reader:
                with dst.cursor().copy(
                    f"COPY {table} ({columns}) FROM STDIN"
                ) as writer:
                    for block in reader:
                        writer.write(block)
            dst.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}','id'),"
                f"COALESCE(MAX(id),1)) FROM {table}"
            )
    env = {
        **os.environ,
        "SECURITY_DATABASE_URL": target,
        "DOCRAG_POSTGRES_PORT": "55433",
    }
    with (directory / "migration.log").open("w") as log:
        subprocess.run(
            ["node", "--import", "tsx", "scripts/security-migrate.ts"],
            env=env,
            stdout=log,
            stderr=log,
            check=True,
        )
    (directory / "database.json").write_text(
        json.dumps({"database": name, "owner": str(ROOT)})
    )
    if cloud:
        with psycopg.connect(source) as src, psycopg.connect(target) as dst:
            src.read_only = True
            space = src.execute(
                "SELECT version,model,dimensions,corpus_hash FROM demo_embedding_space"
            ).fetchone()
            assert space[:3] == ("gemini-001-1536-v1", "gemini-embedding-001", 1536)
            dst.execute((ROOT / "db/demo-space.sql").read_text())
            dst.execute(
                "INSERT INTO demo_embedding_space"
                "(version,model,dimensions,corpus_hash) "
                "VALUES(%s,%s,%s,%s)",
                space,
            )
            dst.execute((ROOT / "db/workspace.sql").read_text())
    return target


@contextmanager
def server(env, directory):
    with socket.socket() as check:
        assert check.connect_ex(("127.0.0.1", 8007)) != 0, "Test port occupied"
    with (directory / "server.log").open("w") as log:
        process = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                "8007",
            ],
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(30):
                assert process.poll() is None, "Test server exited"
                try:
                    if http.request("/api/ready")[0] == 200:
                        break
                except OSError:
                    pass
                time.sleep(1)
            else:
                raise ValueError("Test server not ready")
            yield
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    if not args.run_id.replace("-", "").isalnum():
        raise ValueError("Invalid run ID")
    directory = ROOT / ".local" / ("workspace-http-" + args.run_id)
    directory.mkdir()
    os.environ["PATH"] = (
        str(ROOT / ".local/node-v24.22.1-darwin-arm64/bin")
        + os.pathsep
        + os.environ["PATH"]
    )
    assert (
        subprocess.check_output(["node", "--version"], text=True).strip() == "v24.22.1"
    )
    http.ORIGIN = "http://127.0.0.1:8007"
    report = {
        "status": "INCOMPLETE",
        "checks": [],
        "answers": [],
        "provider": "local Ollama",
        "fresh_generations": 0,
    }
    try:
        target = create_database(directory)
        env = {
            **os.environ,
            "AI_PROVIDER": "ollama",
            "DOCRAG_DEPLOYMENT": "local",
            "DOCRAG_WORKSPACE_ENABLED": "true",
            "OLLAMA_DATABASE_URL": target,
            "DOCRAG_POSTGRES_PORT": "55433",
            "DOCRAG_APP_ORIGIN": http.ORIGIN,
            "DOCRAG_LOCAL_HTTP": "true",
            "BETTER_AUTH_SECRET": secrets.token_urlsafe(48),
            "RERANKER_ENABLED": "false",
            "RESPONSE_CACHE_ENABLED": "false",
        }
        for key in (
            "GEMINI_API_KEY",
            "GOOGLE_GENERATIVE_AI_API_KEY",
            "DEMO_DATABASE_URL",
        ):
            env.pop(key, None)
        accounts = [
            {
                "name": f"Synthetic {label}",
                "email": f"{label}-{secrets.token_hex(4)}@example.test",
                "password": secrets.token_urlsafe(24),
            }
            for label in ("alpha", "beta")
        ]
        (directory / "accounts.json").write_text(json.dumps(accounts))
        (directory / "accounts.json").chmod(0o600)

        def expect(label, result, status):
            assert result[0] == status, (
                f"{label}: expected {status}, received {result[0]}"
            )
            report["checks"].append(label)
            return result

        with server(env, directory):
            consent = expect(
                "accept local registration terms",
                http.request(
                    "/api/processing-consent",
                    "POST",
                    {"version": "local-workspace-v1", "accepted": True},
                ),
                200,
            )[1]["Set-Cookie"].split(";")[0]
            for account in accounts:
                expect(
                    "registration " + account["name"],
                    http.request("/api/auth/sign-up/email", "POST", account, consent),
                    200,
                )
            duplicate = expect(
                "duplicate registration is generic",
                http.request("/api/auth/sign-up/email", "POST", accounts[0], consent),
                200,
            )
            assert json.loads(duplicate[2]) == {"ok": True}
            expect(
                "invalid password",
                http.request(
                    "/api/auth/sign-in/email",
                    "POST",
                    {"email": accounts[0]["email"], "password": "wrong-password"},
                ),
                401,
            )
            cookies = []
            for account in accounts:
                response = expect(
                    "login " + account["name"],
                    http.request(
                        "/api/auth/sign-in/email",
                        "POST",
                        {k: account[k] for k in ("email", "password")},
                    ),
                    200,
                )
                raw = response[1].get("Set-Cookie", "")
                assert "httponly" in raw.lower() and "samesite=lax" in raw.lower()
                cookies.append(raw.split(";")[0])
            a, b = cookies
            session = expect(
                "session refresh", http.request("/api/auth/get-session", cookie=a), 200
            )
            assert json.loads(session[2])["user"]["email"] == accounts[0]["email"]
            expect(
                "anonymous workspace library denied",
                http.request("/api/documents?scope=mine"),
                401,
            )
            public_before = json.loads(
                expect("guest samples", http.request("/api/documents"), 200)[2]
            )
            assert len(public_before) == 2
            text1 = (
                "Project Cedar launched on 12 March 2025. "
                "Cedar aims to reduce water waste. "
                "Section 4 recommends weekly leak inspections. "
                "The project budget is 45000 credits."
            )
            text2 = (
                "Project Birch launched on 20 June 2025. "
                "Birch recommends monthly pipe inspections. "
                "Its budget is 28000 credits."
            )
            text_b = (
                "Project Violet has a secret synthetic marker VIOLET-7294 "
                "and a budget of 99000 credits."
            )
            docs = []
            for cookie, text, filename in [
                (a, text1, "cedar.pdf"),
                (a, text2, "birch.pdf"),
                (b, text_b, "violet.pdf"),
            ]:
                response = expect(
                    "upload " + filename,
                    http.upload(cookie, fixture_pdf(text), filename),
                    201,
                )
                doc = json.loads(response[2])
                assert doc["status"] == "ready" and doc["chunkCount"] > 0
                with psycopg.connect(target) as conn:
                    stored = conn.execute(
                        "SELECT content FROM chunks WHERE document_id=%s "
                        "ORDER BY chunk_index",
                        (doc["id"],),
                    ).fetchall()
                    assert (
                        " ".join(" ".join(row[0] for row in stored).split()) == text
                    ), "Synthetic fixture lost text during extraction"
                report["checks"].append("complete indexed fixture " + filename)
                docs.append(doc["id"])
            da, da2, db = docs
            mine = json.loads(
                expect(
                    "owned library",
                    http.request("/api/documents?scope=mine", cookie=a),
                    200,
                )[2]
            )
            assert {d["id"] for d in mine} == {da, da2}
            assert len(json.loads(http.request("/api/documents")[2])) == 2
            for cookie, doc in [(a, db), (b, da), ("", da)]:
                for path in (f"/api/documents/{doc}", f"/api/documents/{doc}/download"):
                    expect(
                        "cross-account/guest source denied",
                        http.request(path, cookie=cookie),
                        404,
                    )
                expect(
                    "cross-account/guest deletion denied",
                    http.request(f"/api/documents/{doc}", "DELETE", cookie=cookie),
                    404 if cookie else 401,
                )
                expect(
                    "cross-account/guest retrieval denied",
                    http.request(
                        "/api/chat",
                        "POST",
                        {
                            "documentIds": [doc],
                            "messages": [
                                {
                                    "id": "denied",
                                    "role": "user",
                                    "parts": [
                                        {"type": "text", "text": "What is the budget?"}
                                    ],
                                }
                            ],
                        },
                        cookie,
                    ),
                    404,
                )
            expect(
                "invalid upload type",
                http.upload(a, b"not a pdf", "wrong.txt", "text/plain"),
                415,
            )
            expect(
                "oversize upload",
                http.upload(a, b"%PDF-1.4" + b"x" * (15 * 1024 * 1024), "large.pdf"),
                413,
            )
            expect(
                "corrupt PDF fails safely",
                http.upload(b, b"%PDF-1.4\ninvalid", "broken.pdf"),
                422,
            )
            expect(
                "no document selected",
                http.request(
                    "/api/chat",
                    "POST",
                    {
                        "messages": [
                            {
                                "id": "empty",
                                "role": "user",
                                "parts": [{"type": "text", "text": "Summarize"}],
                            }
                        ]
                    },
                    a,
                ),
                400,
            )
            with psycopg.connect(target) as conn:
                conn.execute(
                    "UPDATE documents SET status='processing' WHERE id=%s", (da2,)
                )
            expect(
                "processing distinguished",
                http.request(
                    "/api/chat",
                    "POST",
                    {
                        "documentIds": [da2],
                        "messages": [
                            {
                                "id": "processing",
                                "role": "user",
                                "parts": [{"type": "text", "text": "Summarize"}],
                            }
                        ],
                    },
                    a,
                ),
                409,
            )
            with psycopg.connect(target) as conn:
                conn.execute("UPDATE documents SET status='ready' WHERE id=%s", (da2,))

            def ask(
                label, question, ids, required=(), refusal=False, history=None, cookie=a
            ):
                messages = (history or []) + [
                    {
                        "id": secrets.token_hex(4),
                        "role": "user",
                        "parts": [{"type": "text", "text": question}],
                    }
                ]
                start = time.monotonic()
                response = expect(
                    label + " HTTP",
                    http.request(
                        "/api/chat",
                        "POST",
                        {"documentIds": ids, "messages": messages},
                        cookie,
                    ),
                    200,
                )
                events = [
                    json.loads(line[6:])
                    for line in response[2].decode().splitlines()
                    if line.startswith("data: {")
                ]
                answer = "".join(
                    e["delta"] for e in events if e["type"] == "text-delta"
                )
                sources = next(
                    (
                        e["data"]["sources"]
                        for e in events
                        if e["type"] == "data-sources"
                    ),
                    [],
                )
                validation = next(
                    (e["data"] for e in events if e["type"] == "data-validation"), {}
                )
                report["fresh_generations"] += 1
                report["answers"].append(
                    {
                        "label": label,
                        "question": question,
                        "answer": answer,
                        "source_document_ids": sorted(
                            {s["documentId"] for s in sources}
                        ),
                        "validation": validation,
                        "seconds": time.monotonic() - start,
                    }
                )
                (directory / "receipt.json").write_text(json.dumps(report, indent=2))
                assert not any(e["type"] == "error" for e in events), (
                    f"{label}: stream error"
                )
                assert validation.get("valid"), f"{label}: citation validation failed"
                assert "VIOLET-7294" not in answer and all(
                    s["documentId"] in ids for s in sources
                )
                assert all(word.lower() in answer.lower() for word in required), (
                    f"{label}: required fact absent"
                )
                if refusal:
                    assert validation["kind"] == "uncited-refusal", (
                        f"{label}: unsupported question was answered"
                    )
                else:
                    assert validation["kind"] == "cited", (
                        f"{label}: answerable question refused"
                    )
                if label == "partial support":
                    assert any(
                        word in answer.lower()
                        for word in (
                            "not",
                            "missing",
                            "unknown",
                            "absent",
                            "unspecified",
                        )
                    ), "Partial answer failed to disclose missing information"
                report["checks"].append(label + " evidence")
                return messages + [
                    {
                        "id": secrets.token_hex(4),
                        "role": "assistant",
                        "parts": [{"type": "text", "text": answer}],
                    }
                ]

            history = ask(
                "direct fact", "When did Cedar launch?", [da], ("March", "2025")
            )
            ask("paraphrase", "How much funding was allocated to Cedar?", [da], ("45",))
            ask("summary", "Summarize this document.", [da], ("Cedar",))
            ask(
                "section explanation",
                "Explain section 4 in simple terms.",
                [da],
                ("weekly",),
            )
            ask("follow-up", "What is its goal?", [da], ("water",), history=history)
            ask(
                "comparison",
                "Compare Cedar and Birch inspection recommendations.",
                [da, da2],
                ("weekly", "monthly"),
            )
            ask("absent fact", "What was Cedar's annual revenue?", [da], refusal=True)
            ask(
                "unrelated knowledge",
                "What is the capital of France?",
                [da],
                refusal=True,
            )
            ask(
                "partial support",
                "What is Cedar's budget and who is its chief executive?",
                [da],
                ("45",),
            )
            ask(
                "guest free-form",
                "Explain why PostgreSQL transactions use COMMIT.",
                [4],
                ("commit",),
                cookie="",
            )
            connection = HTTPConnection("127.0.0.1", 8007, timeout=30)
            connection.request(
                "POST",
                "/api/chat",
                json.dumps(
                    {
                        "documentIds": [da],
                        "messages": [
                            {
                                "id": "cancel",
                                "role": "user",
                                "parts": [
                                    {
                                        "type": "text",
                                        "text": (
                                            "Explain Cedar's goals and "
                                            "recommendations in detail."
                                        ),
                                    }
                                ],
                            }
                        ],
                    }
                ),
                {
                    "Content-Type": "application/json",
                    "Origin": http.ORIGIN,
                    "Cookie": a,
                },
            )
            response = connection.getresponse()
            assert response.status == 200, "Cancellation request rejected"
            cancelled_id = response.getheader("X-Request-ID")
            response.readline()
            response.close()
            connection.close()
            report["generation_requests_cancelled"] = 1
            for _ in range(120):
                with psycopg.connect(target) as conn:
                    row = conn.execute(
                        "SELECT outcome,error_category FROM request_metrics "
                        "WHERE request_id=%s",
                        (cancelled_id,),
                    ).fetchone()
                if row:
                    break
                time.sleep(0.25)
            assert row == ("cancelled", "cancelled"), (
                "Stream cancellation was not recorded"
            )
            with psycopg.connect(target) as conn:
                assert not conn.execute(
                    "SELECT id FROM answer_receipts WHERE id=%s", (cancelled_id,)
                ).fetchall()
            report["checks"].append("cancelled answer not completed or rateable")
            expect(
                "server remains healthy after cancellation",
                http.request("/api/ready"),
                200,
            )
            with psycopg.connect(target) as conn:
                conn.execute(
                    "INSERT INTO request_limits(key,count,reset_at) "
                    "VALUES(%s,30,now()+interval '60 seconds') "
                    "ON CONFLICT(key) DO UPDATE SET count=30,"
                    "reset_at=now()+interval '60 seconds'",
                    ("chat:" + json.loads(session[2])["user"]["id"],),
                )
            expect(
                "question quota",
                http.request(
                    "/api/chat",
                    "POST",
                    {
                        "documentIds": [da],
                        "messages": [
                            {
                                "id": "quota",
                                "role": "user",
                                "parts": [{"type": "text", "text": "Budget?"}],
                            }
                        ],
                    },
                    a,
                ),
                429,
            )
            expect(
                "delete own document",
                http.request(f"/api/documents/{da}", "DELETE", cookie=a),
                200,
            )
            with psycopg.connect(target) as conn:
                for table, column in [
                    ("documents", "id"),
                    ("chunks", "document_id"),
                    ("document_files", "document_id"),
                    ("document_access", "document_id"),
                ]:
                    assert (
                        conn.execute(
                            sql.SQL("SELECT count(*) FROM {} WHERE {}=%s").format(
                                sql.Identifier(table), sql.Identifier(column)
                            ),
                            (da,),
                        ).fetchone()[0]
                        == 0
                    )
            report["checks"].append("deletion removes original, chunks and ownership")
            expect("logout", http.request("/api/auth/sign-out", "POST", {}, a), 200)
            assert (
                json.loads(http.request("/api/auth/get-session", cookie=a)[2]) is None
            )
            expect("logged-out upload denied", http.upload(a, http.pdf()), 401)
            with psycopg.connect(target) as conn:
                conn.execute(
                    "UPDATE auth_session SET expires_at=clock_timestamp()"
                    "-interval '1 second' WHERE user_id="
                    "(SELECT id FROM auth_user WHERE email=%s)",
                    (accounts[1]["email"],),
                )
            expect(
                "expired account library denied",
                http.request("/api/documents?scope=mine", cookie=b),
                401,
            )
            expect("expired account upload denied", http.upload(b, http.pdf()), 401)
            assert "VIOLET-7294" not in (directory / "server.log").read_text(), (
                "Private synthetic marker leaked into logs"
            )
            report["checks"].append("private document marker absent from server logs")
            report["status"] = "PASS"
    except Exception as error:
        report["status"] = "FAIL"
        report["failure"] = (
            str(error) if isinstance(error, AssertionError) else type(error).__name__
        )
        raise
    finally:
        (directory / "receipt.json").write_text(json.dumps(report, indent=2))
        print(
            json.dumps(
                {
                    "status": report["status"],
                    "checks": len(report["checks"]),
                    "fresh_generations": report["fresh_generations"],
                    "receipt": str(directory / "receipt.json"),
                }
            )
        )


if __name__ == "__main__":
    main()
