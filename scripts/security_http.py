"""Exercise real production HTTP/session/ownership behavior on a disposable DB."""

import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from urllib.parse import urlsplit, urlunsplit

import psycopg

from eval.chunking_experiments import experiment_url
from eval.corpus import ROOT

ORIGIN = "http://127.0.0.1:8005"


def configuration():
    marker = json.loads((ROOT / ".local/security-test.json").read_text())
    assert marker["owner"] == str(ROOT)
    assert marker["database"].startswith("docrag_security_test_")
    target = urlunsplit(
        urlsplit(experiment_url("heading-1400-280"))._replace(
            path="/" + marker["database"]
        )
    )
    env = {
        **os.environ,
        "AI_PROVIDER": "ollama",
        "OLLAMA_DATABASE_URL": target,
        "DOCRAG_CHUNKING_EXPERIMENT": "heading-1400-280",
        "DOCRAG_APP_ORIGIN": ORIGIN,
        "DOCRAG_LOCAL_HTTP": "true",
        "BETTER_AUTH_SECRET": secrets.token_urlsafe(48),
        "RAG_PROMPT_VERSION": "step5-v1",
        "RERANKER_ENABLED": "false",
        "RESPONSE_CACHE_ENABLED": "true",
    }
    env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    return target, env


@contextmanager
def server(env):
    with (ROOT / ".local/security-http-server.log").open("w") as log:
        process = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                "8005",
            ],
            cwd=ROOT,
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(30):
                assert process.poll() is None, "Test server exited"
                try:
                    with urllib.request.urlopen(ORIGIN, timeout=2) as response:
                        assert response.status == 200
                    break
                except OSError:
                    time.sleep(1)
            else:
                raise ValueError("Test server unavailable")
            yield
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def request(path, method="GET", data=None, cookie="", headers=None):
    base = {"Origin": ORIGIN, "Content-Type": "application/json"}
    if cookie:
        base["Cookie"] = cookie
    base.update(headers or {})
    if isinstance(data, dict):
        data = json.dumps(data).encode()
    req = urllib.request.Request(ORIGIN + path, data=data, method=method, headers=base)
    try:
        response = urllib.request.urlopen(req, timeout=240)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def pdf(
    text="PostgreSQL transaction blocks start with BEGIN and end with COMMIT.", pages=1
):
    """A self-contained public-text PDF, no external library or personal data."""
    content = f"BT /F1 12 Tf 40 750 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Count {pages} /Kids [".encode()
        + b"3 0 R " * pages
        + b"] >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream",
    ]
    output = b"%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    start = len(output)
    output += b"xref\n0 6\n0000000000 65535 f \n" + b"".join(
        f"{offset:010} 00000 n \n".encode() for offset in offsets[1:]
    )
    return (
        output
        + f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()
    )


def upload(cookie, content, filename="sample.pdf", mime="application/pdf"):
    boundary = "docrag-" + secrets.token_hex(12)
    body = (
        (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'
        ).encode()
        + content
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return request(
        "/api/documents",
        "POST",
        body,
        cookie,
        {"Content-Type": "multipart/form-data; boundary=" + boundary},
    )


def main():
    target, env = configuration()
    accounts = json.loads((ROOT / ".local/security-test-accounts.json").read_text())
    checks = []

    def expect(label, result, status):
        assert result[0] == status, f"{label}: expected {status}, got {result[0]}"
        checks.append(label)
        return result

    def recover(kind, identity):
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE request_limits SET reset_at=clock_timestamp()"
                "-interval '1 second'"
                " WHERE key=%s",
                (f"{kind}:{identity}",),
            )

    def chat(doc, text="Which commands surround a PostgreSQL transaction?"):
        return {
            "documentId": doc,
            "messages": [
                {
                    "id": "integration",
                    "role": "user",
                    "parts": [{"type": "text", "text": text}],
                }
            ],
        }

    with server(env):
        expect("anonymous upload", upload("", pdf()), 401)
        expect("anonymous evaluations", request("/api/evaluations"), 401)
        expect(
            "unsafe origin",
            request(
                "/api/auth/sign-in/email",
                "POST",
                {},
                headers={"Origin": "https://evil.example"},
            ),
            403,
        )
        expect("no public signup", request("/api/auth/sign-up/email", "POST", {}), 404)
        cookies = []
        for i, account in enumerate(accounts):
            response = expect(
                f"user {i} sign in",
                request(
                    "/api/auth/sign-in/email",
                    "POST",
                    {"email": account["email"], "password": account["password"]},
                ),
                200,
            )
            assert json.loads(response[2]) == {"ok": True}, "No token in JSON"
            values = response[1].get_all("Set-Cookie")
            assert values and all(
                "HttpOnly" in v and "SameSite=Lax" in v and "Path=/" in v
                for v in values
            )
            cookies.append("; ".join(v.split(";", 1)[0] for v in values))
            session = expect(
                f"user {i} session",
                request("/api/auth/get-session", cookie=cookies[-1]),
                200,
            )
            assert json.loads(session[2])["user"]["id"] == account["id"]
        a, b = cookies
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE request_limits SET count=30, "
                "reset_at=clock_timestamp()+interval '5 minutes' "
                "WHERE key='auth:anonymous-global'"
            )
        for address in ["203.0.113.10", "198.51.100.20"]:
            limited = expect(
                "auth quota cannot be reset by forwarded IP",
                request(
                    "/api/auth/sign-in/email",
                    "POST",
                    {},
                    headers={"X-Forwarded-For": address},
                ),
                429,
            )
            assert int(limited[1]["Retry-After"]) > 0
        recover("auth", "anonymous-global")
        cross_origin = expect(
            "credentialed CORS is not enabled",
            request(
                "/api/auth/get-session",
                cookie=a,
                headers={"Origin": "https://evil.example"},
            ),
            200,
        )
        assert cross_origin[1].get("Access-Control-Allow-Origin") is None
        assert cross_origin[1].get("Access-Control-Allow-Credentials") is None
        expect(
            "bad password",
            request(
                "/api/auth/sign-in/email",
                "POST",
                {"email": accounts[0]["email"], "password": "wrong-password"},
            ),
            401,
        )
        expect(
            "unknown account",
            request(
                "/api/auth/sign-in/email",
                "POST",
                {"email": "unknown@example.test", "password": "wrong-password"},
            ),
            401,
        )
        doc_a = json.loads(expect("upload A", upload(a, pdf()), 201)[2])["id"]
        doc_b = json.loads(
            expect(
                "upload B",
                upload(
                    b,
                    pdf("PostgreSQL transaction changes can be undone with ROLLBACK."),
                ),
                201,
            )[2]
        )["id"]
        fixtures = {
            "a": accounts[0]["id"],
            "b": accounts[1]["id"],
            "documentA": doc_a,
            "documentB": doc_b,
        }
        (ROOT / ".local/security-http-fixtures.json").write_text(json.dumps(fixtures))
        for cookie, visible, hidden in [
            (a, doc_a, doc_b),
            (b, doc_b, doc_a),
            ("", 3, doc_a),
        ]:
            rows = json.loads(
                expect("scoped list", request("/api/documents", cookie=cookie), 200)[2]
            )
            assert visible in [r["id"] for r in rows] and hidden not in [
                r["id"] for r in rows
            ]
        expect("owner read", request(f"/api/documents/{doc_a}", cookie=a), 200)
        downloaded = expect(
            "owner download", request(f"/api/documents/{doc_a}/download", cookie=a), 200
        )
        assert (
            downloaded[2] == pdf()
            and "attachment" in downloaded[1]["Content-Disposition"]
        )
        for label, cookie in [
            ("B", b),
            ("anonymous", ""),
            ("invalid session", "better-auth.session_token=forged"),
        ]:
            expect(
                label + " guessed read",
                request(f"/api/documents/{doc_a}", cookie=cookie),
                404,
            )
            expect(
                label + " guessed download",
                request(f"/api/documents/{doc_a}/download", cookie=cookie),
                404,
            )
            expect(
                label + " guessed chat/citations/cache",
                request("/api/chat", "POST", chat(doc_a), cookie),
                404,
            )
            expect(
                label + " guessed delete",
                request(f"/api/documents/{doc_a}", "DELETE", cookie=cookie),
                404 if cookie == b else 401,
            )
        expect(
            "B guessed evaluation",
            request(
                "/api/evaluations",
                "POST",
                {"documentId": doc_a, "question": "Explain transaction"},
                b,
            ),
            404,
        )
        expect(
            "forged identity",
            request(
                "/api/chat", "POST", {**chat(doc_a), "userId": accounts[0]["id"]}, b
            ),
            400,
        )
        expect("malformed JSON", request("/api/chat", "POST", b"{broken", a), 400)
        expect(
            "oversized question",
            request("/api/chat", "POST", chat(doc_a, "x" * 8001), a),
            400,
        )
        expect(
            "injected identifier", request("/api/documents/1%20OR%201=1", cookie=a), 400
        )
        expect("invalid pagination", request("/api/documents?offset=-1", cookie=a), 400)
        expect(
            "unsupported generation budget",
            request("/api/chat", "POST", {**chat(doc_a), "maxTokens": 1000000}, a),
            400,
        )
        expect("request size cap", request("/api/chat", "POST", b"x" * 65537, a), 413)
        with psycopg.connect(target) as conn:
            before = conn.execute("SELECT count(*) FROM documents").fetchone()[0]
        for label, content, name, mime, status in [
            ("wrong MIME", pdf(), "sample.pdf", "text/plain", 415),
            ("invalid signature", b"not a PDF", "sample.pdf", "application/pdf", 415),
            ("corrupt PDF", b"%PDF-1.4\ninvalid", "sample.pdf", "application/pdf", 422),
            ("path traversal", pdf(), "..secret.pdf", "application/pdf", 400),
            ("page limit", pdf(pages=101), "sample.pdf", "application/pdf", 422),
            (
                "oversized PDF",
                b"%PDF-1.4" + b"x" * (15 * 1024 * 1024),
                "sample.pdf",
                "application/pdf",
                413,
            ),
        ]:
            recover("upload", accounts[0]["id"])
            expect(label, upload(a, content, name, mime), status)
        with psycopg.connect(target) as conn:
            assert (
                conn.execute("SELECT count(*) FROM documents").fetchone()[0] == before
            )
            legacy = conn.execute(
                "INSERT INTO documents(title,filename,status)"
                " VALUES('quarantine fixture','legacy.pdf','ready') RETURNING id"
            ).fetchone()[0]
        expect("legacy quarantined", request(f"/api/documents/{legacy}", cookie=a), 404)
        subprocess.run(
            ["node", "--import", "tsx", "scripts/security_retrieval.ts"],
            cwd=ROOT,
            env=env,
            check=True,
        )
        checks.append("real SQL retrieval and concurrency suite")
        for i in range(2):
            response = expect(
                f"private streaming {i}",
                request("/api/chat", "POST", chat(doc_a), a),
                200,
            )
            assert response[1]["X-DocRAG-Cache"] == "BYPASS"
            events = [
                json.loads(line[6:])
                for line in response[2].decode().splitlines()
                if line.startswith("data: ") and line[6:] != "[DONE]"
            ]
            assert not any(e["type"] == "error" for e in events)
            assert any(e["type"] == "finish" for e in events)
            sources = next(
                e["data"]["sources"] for e in events if e["type"] == "data-sources"
            )
            assert sources and all(s["documentId"] == doc_a for s in sources)
        comparison = json.loads(
            expect(
                "owner evaluation",
                request(
                    "/api/evaluations",
                    "POST",
                    {
                        "documentId": doc_a,
                        "question": "Which commands surround a transaction?",
                    },
                    a,
                ),
                200,
            )[2]
        )
        for cookie, present in [(a, True), (b, False)]:
            listed = json.loads(
                expect(
                    "scoped evaluation history",
                    request("/api/evaluations", cookie=cookie),
                    200,
                )[2]
            )
            assert (comparison["id"] in [row["id"] for row in listed]) is present
        recover("upload", accounts[0]["id"])
        disposable = json.loads(
            expect("upload disposable owner fixture", upload(a, pdf()), 201)[2]
        )["id"]
        expect(
            "owner deletion",
            request(f"/api/documents/{disposable}", "DELETE", cookie=a),
            200,
        )
        expect(
            "deleted original unavailable",
            request(f"/api/documents/{disposable}/download", cookie=a),
            404,
        )
        with psycopg.connect(target) as conn:
            for table in ["chunks", "document_access", "document_files"]:
                assert (
                    conn.execute(
                        f"SELECT count(*) FROM {table} WHERE document_id=%s",
                        (disposable,),
                    ).fetchone()[0]
                    == 0
                )
        subprocess.run(
            ["node", "--import", "tsx", "scripts/security_session.ts"],
            cwd=ROOT,
            env=env,
            check=True,
        )
        checks.append("actual HTTPS cookies and fixed session lifetime")
        # HTTP quota exhaustion, recovery and independent authenticated identities.
        with psycopg.connect(target) as conn:
            conn.execute(
                "INSERT INTO request_limits(key,count,reset_at)"
                " VALUES(%s,30,clock_timestamp()+interval '1 minute')"
                " ON CONFLICT(key) DO UPDATE"
                " SET count=30,reset_at=EXCLUDED.reset_at",
                ("chat:" + accounts[0]["id"],),
            )
        rate = expect("HTTP 429", request("/api/chat", "POST", chat(doc_a), a), 429)
        assert int(rate[1]["Retry-After"]) > 0
        expect("other user quota", request("/api/chat", "POST", chat(doc_a), b), 404)
        recover("chat", accounts[0]["id"])
        expect(
            "quota recovery",
            request("/api/chat", "POST", {**chat(doc_a), "forged": True}, a),
            400,
        )
        expect("sign out", request("/api/auth/sign-out", "POST", {}, a), 200)
        expect(
            "logout cookie cannot replay",
            request(f"/api/documents/{doc_a}", cookie=a),
            404,
        )
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE auth_session SET expires_at=clock_timestamp()"
                "-interval '1 second'"
                " WHERE user_id=%s",
                (accounts[1]["id"],),
            )
        expect(
            "expired session read", request(f"/api/documents/{doc_b}", cookie=b), 404
        )
        expect("expired session upload", upload(b, pdf()), 401)
        expect("public corpus after logout", request("/api/documents/3"), 200)
    receipt = {
        "status": "PASS",
        "checks": checks,
        "count": len(checks),
        "database": urlsplit(target).path[1:],
    }
    (ROOT / ".local/security-http-receipt.json").write_text(
        json.dumps(receipt, indent=2)
    )
    print(
        f"PASS: {len(checks)} real HTTP checks "
        "plus real SQL retrieval/concurrent quota suite"
    )


if __name__ == "__main__":
    main()
