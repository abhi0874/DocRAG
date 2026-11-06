"""Real container checks with public fixtures."""

import json
import secrets
import subprocess
import time
import uuid
from http.client import HTTPConnection

from eval.corpus import ROOT
from scripts import security_http as http

COMPOSE = ["docker", "compose", "--env-file", ".local/step9-compose.env"]


def sql(query):
    result = subprocess.run(
        [
            *COMPOSE,
            "exec",
            "-T",
            "db",
            "psql",
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "docrag",
            "-d",
            "docrag_container",
            "-Atc",
            query,
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def main():
    assert sql("SELECT current_database()") == "docrag_container"
    assert sql("SELECT extversion FROM pg_extension WHERE extname='vector'") == "0.8.1"
    http.ORIGIN = "http://127.0.0.1:8010"
    accounts = [
        {
            "id": str(uuid.uuid4()),
            "email": f"container-{uuid.uuid4().hex}@example.test",
            "password": secrets.token_urlsafe(24),
        }
        for _ in range(2)
    ]
    script = """
import pg from 'pg';
import {hashPassword} from 'better-auth/crypto';
import {randomUUID} from 'node:crypto';
const pool=new pg.Pool({connectionString:process.env.OLLAMA_DATABASE_URL});
try{for(const a of ACCOUNTS){
await pool.query('INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)',
[a.id,'Container test',a.email]);
await pool.query('INSERT INTO auth_account'+
'(id,account_id,provider_id,user_id,password) '+
"VALUES($1,$2,'credential',$2,$3)",
[randomUUID(),a.id,await hashPassword(a.password)])
}}finally{await pool.end()}
""".replace("ACCOUNTS", json.dumps(accounts))
    subprocess.run(
        [
            *COMPOSE,
            "run",
            "--rm",
            "--no-deps",
            "-T",
            "--entrypoint",
            "node",
            "migrate",
            "--input-type=module",
        ],
        cwd=ROOT,
        input=script,
        text=True,
        capture_output=True,
        check=True,
    )
    checks = []

    def compose(*args):
        subprocess.run([*COMPOSE, *args], cwd=ROOT, check=True, capture_output=True)

    def healthy():
        for _ in range(60):
            result = subprocess.run(
                [
                    "docker",
                    "inspect",
                    "--format",
                    "{{.State.Health.Status}}",
                    "docrag-step9-app-1",
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            if result.stdout.strip() == "healthy":
                return
            time.sleep(1)
        raise AssertionError("DocRAG app did not become healthy")

    def other_project():
        result = subprocess.run(
            ["docker", "inspect", "text-to-sql-db-1"],
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(result.stdout)[0]
        assert data["State"]["Health"]["Status"] == "healthy"
        return {
            "id": data["Id"],
            "started": data["State"]["StartedAt"],
            "mounts": data["Mounts"],
            "ports": data["HostConfig"]["PortBindings"],
        }

    other_before = other_project()

    def expect(name, response, status):
        assert response[0] == status, f"{name}: expected {status}, got {response[0]}"
        checks.append(name)
        return response

    expect("anonymous metrics", http.request("/api/metrics"), 401)
    expect("anonymous upload", http.upload("", http.pdf()), 401)
    expect(
        "bad origin",
        http.request(
            "/api/auth/sign-in/email",
            "POST",
            {},
            headers={"Origin": "https://evil.example"},
        ),
        403,
    )
    cookies = []
    for a in accounts:
        r = expect(
            "sign in",
            http.request(
                "/api/auth/sign-in/email",
                "POST",
                {"email": a["email"], "password": a["password"]},
            ),
            200,
        )
        assert json.loads(r[2]) == {"ok": True}
        values = r[1].get_all("Set-Cookie")
        assert all("HttpOnly" in v and "SameSite=Lax" in v for v in values)
        cookies.append("; ".join(v.split(";")[0] for v in values))
        r = expect(
            "session persisted",
            http.request("/api/auth/get-session", cookie=cookies[-1]),
            200,
        )
        assert json.loads(r[2])["user"]["id"] == a["id"]
    a, b = cookies
    doc = json.loads(expect("private PDF upload", http.upload(a, http.pdf()), 201)[2])[
        "id"
    ]
    expect("cross-user document", http.request(f"/api/documents/{doc}", cookie=b), 404)
    payload = {
        "documentId": doc,
        "messages": [
            {
                "id": "container-test",
                "role": "user",
                "parts": [
                    {
                        "type": "text",
                        "text": "Which commands surround a PostgreSQL transaction?",
                    }
                ],
            }
        ],
    }
    r = expect("streaming chat", http.request("/api/chat", "POST", payload, a), 200)
    events = [
        json.loads(s[6:]) for s in r[2].decode().splitlines() if s.startswith("data: {")
    ]
    assert any(e["type"] == "finish" for e in events)
    assert not any(e["type"] == "error" for e in events)
    answer = str(uuid.UUID(r[1]["X-Request-ID"]))
    assert (
        sql(
            "SELECT outcome || ':' || cache FROM request_metrics "
            f"WHERE request_id='{answer}'"
        )
        == "completed:BYPASS"
    )
    for value in ["up", "down"]:
        expect(
            "feedback " + value,
            http.request(
                "/api/feedback", "POST", {"answerId": answer, "value": value}, a
            ),
            200,
        )
    expect(
        "feedback ownership",
        http.request("/api/feedback", "POST", {"answerId": answer, "value": "up"}, b),
        404,
    )
    assert (
        sql(
            f"SELECT count(*) FROM answer_feedback WHERE answer_id='{answer}' "
            "AND value='down'"
        )
        == "1"
    )
    expect("owned metrics", http.request("/api/metrics", cookie=a), 200)
    # Close a real streaming socket; expect one cancelled terminal record.
    connection = HTTPConnection("127.0.0.1", 8010, timeout=120)
    connection.request(
        "POST",
        "/api/chat",
        json.dumps(payload),
        {"Content-Type": "application/json", "Origin": http.ORIGIN, "Cookie": a},
    )
    response = connection.getresponse()
    assert response.status == 200
    cancelled = str(uuid.UUID(response.getheader("X-Request-ID")))
    response.readline()
    response.close()
    connection.close()
    for _ in range(120):
        state = sql(
            f"SELECT outcome FROM request_metrics WHERE request_id='{cancelled}'"
        )
        if state:
            break
        time.sleep(0.25)
    assert state == "cancelled"
    assert sql(f"SELECT count(*) FROM answer_receipts WHERE id='{cancelled}'") == "0"
    checks.append("cancelled stream has one terminal metric and no answer receipt")
    assert (
        sql(f"SELECT count(*) FROM request_metrics WHERE request_id='{cancelled}'")
        == "1"
    )

    # Only our newly generated account is expired; existing users are untouched.
    owner_b = accounts[1]["id"]
    assert (
        sql(
            "SELECT bool_and(expires_at-created_at "
            "BETWEEN interval '7 hours 59 minutes' "
            "AND interval '8 hours 1 minute') FROM auth_session "
            f"WHERE user_id='{owner_b}'"
        )
        == "t"
    )
    sql(
        "UPDATE auth_session SET expires_at=now()-interval '1 second' "
        f"WHERE user_id='{owner_b}'"
    )
    expired = expect(
        "expired session rejected", http.request("/api/metrics", cookie=b), 401
    )
    assert expired[0] == 401

    fingerprint_query = (
        "SELECT md5(string_agg(row_to_json(t)::text, '' ORDER BY id)) FROM chunks t"
    )
    fingerprint = sql(fingerprint_query)
    compose("run", "--rm", "--no-deps", "-T", "migrate")
    assert sql(fingerprint_query) == fingerprint
    checks.append("repeat migration preserves embeddings")
    compose("restart", "app")
    healthy()
    expect("session survives app restart", http.request("/api/metrics", cookie=a), 200)
    compose("stop", "db")
    try:
        failed = http.request("/api/metrics", cookie=a)
        assert failed[0] >= 500, "DB loss must not authorize a request"
        checks.append("DB outage fails closed")
    finally:
        compose("start", "db")
    for _ in range(60):
        r = http.request("/api/metrics", cookie=a)
        if r[0] == 200:
            break
        time.sleep(1)
    expect("recovery after DB restart", r, 200)
    assert sql(fingerprint_query) == fingerprint
    compose("stop", "app", "db")
    try:
        state = subprocess.run(
            [
                "docker",
                "inspect",
                "--format",
                "{{.State.ExitCode}}",
                "docrag-step9-app-1",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        assert state.stdout.strip() in {"0", "143"}, "App required a forced kill"
        assert other_project() == other_before
        checks.append("graceful shutdown; unrelated database unchanged")
    finally:
        compose("start", "db", "app")
    healthy()
    assert sql(fingerprint_query) == fingerprint
    expect(
        "persistent session after full restart",
        http.request("/api/metrics", cookie=a),
        200,
    )
    assert other_project() == other_before
    for cookie in cookies:
        expect("sign out", http.request("/api/auth/sign-out", "POST", {}, cookie), 200)
        r = expect(
            "logout replay", http.request("/api/auth/get-session", cookie=cookie), 200
        )
        assert json.loads(r[2]) is None
    receipt = {
        "status": "PASS",
        "checks": checks,
        "check_count": len(checks),
        "fixture_documents_retained": [doc],
        "paid_api_charges_inr": 0,
    }
    (ROOT / ".local/step9-container-http.json").write_text(
        json.dumps(receipt, indent=2) + "\n"
    )
    print(json.dumps({"status": "PASS", "check_count": len(checks)}))


if __name__ == "__main__":
    main()
