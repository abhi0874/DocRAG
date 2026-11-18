"""Bounded live Gemini acceptance: only synthetic/public data in a new native DB."""

import argparse
import hashlib
import json
import os
import secrets
import time

import psycopg
from dotenv import dotenv_values

from eval.corpus import ROOT
from scripts import security_http as http
from scripts.workspace_http import create_database, fixture_pdf, server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    assert args.run_id.replace("-", "").isalnum()
    directory = ROOT / ".local" / ("workspace-cloud-" + args.run_id)
    directory.mkdir()
    billing = json.loads(
        (ROOT / ".local/workspace-release/cloud-quota-billing.json").read_text()
    )
    assert billing["project"] == "gen-lang-client-0270320094"
    assert "no billing account" in billing["google_cloud_billing"]
    os.environ["PATH"] = (
        str(ROOT / ".local/node-v24.22.1-darwin-arm64/bin")
        + os.pathsep
        + os.environ["PATH"]
    )
    target = create_database(directory, cloud=True)
    key = dotenv_values(ROOT / ".local/step11-gemini.env")["GEMINI_API_KEY"]
    assert key and len(key) > 20
    http.ORIGIN = "http://127.0.0.1:8007"
    env = {
        **os.environ,
        "AI_PROVIDER": "gemini",
        "DOCRAG_DEPLOYMENT": "recruiter-demo",
        "DOCRAG_WORKSPACE_ENABLED": "true",
        "DOCRAG_WORKSPACE_TEST_DATABASE": "true",
        "DOCRAG_LOCAL_HTTP": "true",
        "DOCRAG_POSTGRES_PORT": "55433",
        "DEMO_DATABASE_URL": target,
        "DOCRAG_APP_ORIGIN": http.ORIGIN,
        "BETTER_AUTH_SECRET": secrets.token_urlsafe(48),
        "GEMINI_API_KEY": key,
        "DOCRAG_GEMINI_BILLING_CONFIRMED": "no-linked-account",
        "RERANKER_ENABLED": "false",
        "RESPONSE_CACHE_ENABLED": "false",
    }
    report = {
        "status": "INCOMPLETE",
        "scope": "live Gemini; isolated native database; synthetic uploads",
        "checks": [],
        "answers": [],
        "generation_requests": 0,
    }

    def expect(label, response, status):
        assert response[0] == status, (
            f"{label}: expected {status}, received {response[0]}"
        )
        report["checks"].append(label)
        return response

    try:
        with server(env, directory):
            expect(
                "no-consent chat blocked", http.request("/api/chat", "POST", {}), 403
            )
            consent = expect(
                "explicit consent",
                http.request(
                    "/api/processing-consent",
                    "POST",
                    {
                        "country": "IN",
                        "adult": True,
                        "professional": True,
                        "nonSensitive": True,
                        "externalProcessing": True,
                    },
                ),
                200,
            )[1]["Set-Cookie"].split(";")[0]
            accounts = []
            cookies = []
            for label in ["alpha", "beta"]:
                account = {
                    "name": "Synthetic " + label,
                    "email": secrets.token_hex(8) + "@example.test",
                    "password": secrets.token_urlsafe(24),
                }
                accounts.append(account)
                expect(
                    "signup " + label,
                    http.request("/api/auth/sign-up/email", "POST", account, consent),
                    200,
                )
                response = expect(
                    "login " + label,
                    http.request(
                        "/api/auth/sign-in/email",
                        "POST",
                        {k: account[k] for k in ["email", "password"]},
                        consent,
                    ),
                    200,
                )
                cookies.append(response[1]["Set-Cookie"].split(";")[0] + "; " + consent)
            (directory / "accounts.json").write_text(json.dumps(accounts))
            (directory / "accounts.json").chmod(0o600)
            a, b = cookies
            public_before = json.loads(
                expect(
                    "guest public library",
                    http.request("/api/documents?scope=public"),
                    200,
                )[2]
            )
            assert len(public_before) == 2
            fixture = (
                "Project Cedar launched on 12 March 2025. "
                "Its goal is to reduce water waste. Its budget is 45000 credits. "
                "Weekly leak inspections are recommended."
            )
            doc = json.loads(
                expect(
                    "cloud upload and index",
                    http.upload(a, fixture_pdf(fixture), "cedar.pdf"),
                    201,
                )[2]
            )
            doc_id = doc["id"]
            with psycopg.connect(target) as conn:
                row = conn.execute(
                    "SELECT vector_dims(embedding),content FROM chunks "
                    "WHERE document_id=%s",
                    (doc_id,),
                ).fetchone()
                assert row[0] == 1536 and "45000" in row[1]
                assert (
                    conn.execute(
                        "SELECT count(*) FROM workspace_document_policy "
                        "WHERE document_id=%s AND expires_at>now()",
                        (doc_id,),
                    ).fetchone()[0]
                    == 1
                )
            report["checks"].append("1536-dimensional index and bounded retention")
            expect(
                "cross-account source blocked",
                http.request(f"/api/documents/{doc_id}", cookie=b),
                404,
            )
            expect(
                "cross-account delete blocked",
                http.request(f"/api/documents/{doc_id}", "DELETE", cookie=b),
                404,
            )
            expect(
                "guest source blocked",
                http.request(f"/api/documents/{doc_id}", cookie=consent),
                404,
            )
            last = 0.0
            history = []
            for label, question, refusal, ids, cookie in [
                ("supported", "When did Cedar launch?", False, [doc_id], a),
                ("follow-up", "What is its budget?", False, [doc_id], a),
                ("unsupported", "Who is its chief executive?", True, [doc_id], a),
                (
                    "guest free-form",
                    "Why do PostgreSQL transactions use COMMIT?",
                    False,
                    [4],
                    consent,
                ),
            ]:
                if last:
                    time.sleep(max(0, 31 - (time.monotonic() - last)))
                last = time.monotonic()
                messages = (history if label == "follow-up" else []) + [
                    {
                        "id": secrets.token_hex(4),
                        "role": "user",
                        "parts": [{"type": "text", "text": question}],
                    }
                ]
                report["generation_requests"] += 1
                response = expect(
                    label + " HTTP",
                    http.request(
                        "/api/chat",
                        "POST",
                        {
                            "documentIds": ids,
                            "personal": cookie == a,
                            "messages": messages,
                        },
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
                validation = next(
                    (e["data"] for e in events if e["type"] == "data-validation"), {}
                )
                report["answers"].append(
                    {
                        "label": label,
                        "answer_chars": len(answer),
                        "answer_sha256": hashlib.sha256(answer.encode()).hexdigest(),
                        "validation": validation,
                    }
                )
                assert not any(e["type"] == "error" for e in events), (
                    label + ": stream error"
                )
                assert any(
                    e["type"] == "finish" and e.get("finishReason") == "stop"
                    for e in events
                ), label + ": missing successful stream finalization"
                assert validation.get("valid") and validation["kind"] == (
                    "uncited-refusal" if refusal else "cited"
                ), label + ": grounding failure"
                if label == "supported":
                    assert "2025" in answer and "March" in answer
                    history = messages + [
                        {
                            "id": "a",
                            "role": "assistant",
                            "parts": [{"type": "text", "text": answer}],
                        }
                    ]
                if label == "follow-up":
                    assert "45" in answer
                report["checks"].append(label + " answer and citations")
                (directory / "receipt.json").write_text(json.dumps(report, indent=2))
            expect(
                "cloud own-document deletion",
                http.request(f"/api/documents/{doc_id}", "DELETE", cookie=a),
                200,
            )
            with psycopg.connect(target) as conn:
                for table, column in [
                    ("chunks", "document_id"),
                    ("document_files", "document_id"),
                    ("workspace_document_policy", "document_id"),
                ]:
                    assert (
                        conn.execute(
                            f"SELECT count(*) FROM {table} WHERE {column}=%s", (doc_id,)
                        ).fetchone()[0]
                        == 0
                    )
                assert conn.execute("SELECT count(*) FROM chunks").fetchone()[0] == 162
            report["checks"].append(
                "deletion removes new data; 162 public chunks survive"
            )
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
                    "generation_requests": report["generation_requests"],
                }
            )
        )


if __name__ == "__main__":
    main()
