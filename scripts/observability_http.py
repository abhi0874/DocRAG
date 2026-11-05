"""Real production HTTP, SQL, cancellation, privacy and feedback verification."""

import hashlib
import http.client
import json
import statistics
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import psycopg
from psycopg.rows import dict_row

from eval.corpus import ROOT
from scripts.security_http import ORIGIN, configuration, pdf, request, server, upload


def main():
    target, env = configuration()
    accounts = json.loads((ROOT / ".local/security-test-accounts.json").read_text())
    checks, ids = [], []
    golden = ROOT / "eval/golden_set.jsonl"
    golden_hash = hashlib.sha256(golden.read_bytes()).hexdigest()
    question = json.loads(golden.read_text().splitlines()[0])["question"]

    def check(label, condition):
        assert condition, label
        checks.append(label)

    def expect(label, response, status):
        check(label, response[0] == status)
        rid = response[1].get("X-Request-ID")
        check(label + " server UUID", str(uuid.UUID(rid)) == rid)
        ids.append(rid)
        return response

    def read(query, params=()):
        with psycopg.connect(target, row_factory=dict_row) as conn:
            conn.read_only = True
            return conn.execute(query, params).fetchall()

    def metric(rid):
        rows = read("SELECT * FROM request_metrics WHERE request_id=%s", (rid,))
        check("one persisted request", len(rows) == 1)
        return rows[0]

    def chat(doc, text):
        return {
            "documentId": doc,
            "messages": [
                {
                    "id": "test",
                    "role": "user",
                    "parts": [{"type": "text", "text": text}],
                }
            ],
        }

    def vote(answer, value, cookie):
        return request(
            "/api/feedback", "POST", {"answerId": answer, "value": value}, cookie
        )

    initial_count = read("SELECT count(*) AS n FROM request_metrics")[0]["n"]
    started_at = read("SELECT clock_timestamp() AS at")[0]["at"]
    with server(env):
        # Fixture-only quota reset. No application database rows are modified.
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE request_limits SET reset_at=clock_timestamp()-interval "
                "'1 second'"
            )
        cookies = []
        for account in accounts:
            r = expect(
                "sign in",
                request(
                    "/api/auth/sign-in/email",
                    "POST",
                    {"email": account["email"], "password": account["password"]},
                ),
                200,
            )
            cookies.append(
                "; ".join(v.split(";", 1)[0] for v in r[1].get_all("Set-Cookie"))
            )
        a, b = cookies
        r = expect(
            "public documents",
            request("/api/documents", headers={"X-Request-ID": "forged"}),
            200,
        )
        check("client correlation ignored", r[1]["X-Request-ID"] != "forged")
        expect("anonymous metrics", request("/api/metrics"), 401)
        expect("anonymous feedback", vote(str(uuid.uuid4()), "up", ""), 401)
        expect(
            "metric owner injection",
            request("/api/metrics?ownerId=" + accounts[1]["id"], cookie=a),
            400,
        )
        expect("invalid metrics period", request("/api/metrics?hours=0", cookie=a), 400)
        expect("invalid JSON", request("/api/chat", "POST", b"{", a), 400)
        missing = expect("missing answer", vote(str(uuid.uuid4()), "down", a), 404)
        check(
            "404 telemetry",
            metric(missing[1]["X-Request-ID"])["error_category"] == "unavailable",
        )
        miss = expect(
            "public stream miss",
            request("/api/chat", "POST", chat(3, question), a),
            200,
        )
        answer = miss[1]["X-Request-ID"]
        events = [
            json.loads(line[6:])
            for line in miss[2].decode().splitlines()
            if line.startswith("data: {")
        ]
        check(
            "server answer identity",
            next(e for e in events if e["type"] == "start")["messageId"] == answer,
        )
        check("completed stream", any(e["type"] == "finish" for e in events))
        m = metric(answer)
        check(
            "actual model token usage",
            m["outcome"] == "completed"
            and m["cache"] == "MISS"
            and m["total_tokens"] > 0,
        )
        check(
            "real stage durations",
            m["details"]["timings"]["retrieval"] >= 0
            and m["details"]["first_token_ms"] >= 0,
        )
        receipt = read("SELECT * FROM answer_receipts WHERE id=%s", (answer,))[0]
        check("receipt owner", receipt["owner_id"] == accounts[0]["id"])
        check(
            "public provenance",
            receipt["public_question_hash"] is not None and receipt["public_answer"],
        )
        hit = expect(
            "public cache hit", request("/api/chat", "POST", chat(3, question), a), 200
        )
        hm = metric(hit[1]["X-Request-ID"])
        check(
            "cache accounting",
            hm["cache"] == "HIT"
            and hm["total_tokens"] is None
            and hm["details"]["generation_skipped"]
            and hm["details"]["model_calls_avoided"] == 1,
        )
        expect("thumbs up", vote(answer, "up", a), 200)
        expect("thumbs down update", vote(answer, "down", a), 200)
        with ThreadPoolExecutor(max_workers=5) as pool:
            for r in pool.map(lambda _: vote(answer, "down", a), range(5)):
                expect("concurrent idempotent feedback", r, 200)
        rows = read("SELECT * FROM answer_feedback WHERE answer_id=%s", (answer,))
        check(
            "unique feedback with correct owner",
            len(rows) == 1
            and rows[0]["owner_id"] == accounts[0]["id"]
            and rows[0]["value"] == "down",
        )
        expect("cross-user feedback write", vote(answer, "up", b), 404)
        expect(
            "cross-user feedback read",
            request("/api/feedback?answerId=" + answer, cookie=b),
            404,
        )
        expect("invalid vote", vote(answer, "invalid", a), 400)
        expect(
            "extra identity rejected",
            request(
                "/api/feedback",
                "POST",
                {"answerId": answer, "value": "up", "ownerId": accounts[1]["id"]},
                a,
            ),
            400,
        )
        expect(
            "bad feedback origin",
            request(
                "/api/feedback",
                "POST",
                {"answerId": answer, "value": "up"},
                a,
                {"Origin": "https://evil.example"},
            ),
            403,
        )
        # Synthetic private file is newly created in this disposable database.
        private = expect(
            "private upload", upload(a, pdf(), "private-observability.pdf"), 201
        )
        doc = json.loads(private[2])["id"]
        private_question = (
            "PRIVATE-OBSERVABILITY-MARKER: Which commands surround a transaction?"
        )
        pr = expect(
            "private answer",
            request("/api/chat", "POST", chat(doc, private_question), a),
            200,
        )
        private_id = pr[1]["X-Request-ID"]
        pm = metric(private_id)
        check(
            "private bypass", pm["cache"] == "BYPASS" and pm["outcome"] == "completed"
        )
        receipt = read("SELECT * FROM answer_receipts WHERE id=%s", (private_id,))[0]
        check(
            "private text not retained",
            receipt["public_answer"] is None
            and receipt["public_question_hash"] is None,
        )
        expect("private negative feedback", vote(private_id, "down", a), 200)
        # Close a real socket after receiving the assistant start event.
        connection = http.client.HTTPConnection("127.0.0.1", 8005, timeout=120)
        connection.request(
            "POST",
            "/api/chat",
            json.dumps(chat(3, "Explain path parameters with a new example.")),
            {"Content-Type": "application/json", "Origin": ORIGIN, "Cookie": a},
        )
        response = connection.getresponse()
        cancelled_id = response.getheader("X-Request-ID")
        check("cancellation HTTP accepted", response.status == 200)
        response.readline()
        response.close()
        connection.close()
        for _ in range(120):
            rows = read(
                "SELECT outcome,error_category FROM request_metrics "
                "WHERE request_id=%s",
                (cancelled_id,),
            )
            if rows:
                break
            time.sleep(0.25)
        check(
            "cancelled stream not completed",
            rows
            and rows[0]["outcome"] == "cancelled"
            and rows[0]["error_category"] == "cancelled",
        )
        check(
            "cancelled answer not rateable",
            not read("SELECT id FROM answer_receipts WHERE id=%s", (cancelled_id,)),
        )
        # Force a bounded metrics-only write failure, not a model/database outage.
        with psycopg.connect(target) as locker:
            locker.execute("LOCK request_metrics IN ACCESS EXCLUSIVE MODE")
            start = time.perf_counter()
            r = expect(
                "metric failure preserves response",
                request("/api/documents", cookie=a),
                200,
            )
            check("metric failure bounded", time.perf_counter() - start < 4)
        recovered = expect(
            "metrics persistence recovered", request("/api/documents", cookie=a), 200
        )
        metric(recovered[1]["X-Request-ID"])
        # Read-only SQL is the independent source for dashboard expectations.
        own = expect(
            "owner dashboard data", request("/api/metrics?hours=24", cookie=a), 200
        )
        other = expect(
            "other owner dashboard data",
            request("/api/metrics?hours=24", cookie=b),
            200,
        )
        data, other_data = json.loads(own[2]), json.loads(other[2])
        expected = read(
            "SELECT count(*) AS n,avg(latency_ms) AS mean,percentile_cont(.5) "
            "WITHIN GROUP(ORDER BY latency_ms) AS p50,percentile_cont(.95) "
            "WITHIN GROUP(ORDER BY latency_ms) AS p95 FROM request_metrics "
            "WHERE owner_id=%s AND route<>'/api/metrics' AND "
            "created_at>=clock_timestamp()-interval '24 hours'",
            (accounts[0]["id"],),
        )[0]
        check(
            "dashboard aggregate matches SQL",
            data["summary"]["total"] == expected["n"]
            and abs(data["summary"]["p95_ms"] - expected["p95"]) < 0.000001,
        )
        check(
            "cross-user metrics separated",
            not (
                {r["request_id"] for r in data["recent"]}
                & {r["request_id"] for r in other_data["recent"]}
            ),
        )
        check(
            "dashboard privacy",
            all(
                secret not in own[2].decode()
                for secret in [
                    private_question,
                    "private-observability.pdf",
                    accounts[1]["id"],
                    accounts[0]["password"],
                ]
            ),
        )
        with psycopg.connect(target) as conn:
            conn.execute(
                "INSERT INTO request_limits(key,count,reset_at) "
                "VALUES(%s,60,clock_timestamp()+interval '1 minute') ON "
                "CONFLICT(key) DO UPDATE SET "
                "count=60,reset_at=EXCLUDED.reset_at",
                ("feedback:" + accounts[0]["id"],),
            )
        limited = expect("feedback rate limit", vote(answer, "up", a), 429)
        check(
            "429 telemetry",
            metric(limited[1]["X-Request-ID"])["error_category"] == "rate_limit",
        )
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE request_limits SET reset_at=clock_timestamp()-interval "
                "'1 second' WHERE key=%s",
                ("feedback:" + accounts[0]["id"],),
            )
        output = ROOT / f".local/feedback-review/http-{uuid.uuid4().hex}.jsonl"
        subprocess.run(
            [
                ".venv/bin/python",
                "-m",
                "scripts.feedback_to_eval",
                "--out",
                str(output),
            ],
            cwd=ROOT,
            check=True,
        )
        exported = [json.loads(line) for line in output.read_text().splitlines()]
        check(
            "public review candidate exported",
            any(
                row["feedback_reference"] == answer
                and row["review_status"] == "review_needed"
                and row["ground_truth"] is False
                for row in exported
            ),
        )
        check(
            "private export blocked",
            all(row["feedback_reference"] != private_id for row in exported)
            and private_question not in output.read_text(),
        )
        check(
            "golden set unchanged",
            hashlib.sha256(golden.read_bytes()).hexdigest() == golden_hash,
        )
        expect(
            "remove newly created private fixture",
            request(f"/api/documents/{doc}", "DELETE", cookie=a),
            200,
        )
        expect("deleted answer feedback", vote(private_id, "up", a), 404)
        durations = []
        for index in range(35):
            start = time.perf_counter()
            check("overhead request", request("/api/documents")[0] == 200)
            if index >= 5:
                durations.append((time.perf_counter() - start) * 1000)
        stats = read(
            "SELECT count(*) AS request_count,avg(latency_ms) AS "
            "avg_latency_ms,percentile_cont(.5) WITHIN GROUP(ORDER BY "
            "latency_ms) AS p50_ms,percentile_cont(.95) WITHIN GROUP(ORDER BY "
            "latency_ms) AS p95_ms,count(*) FILTER(WHERE cache='HIT') AS "
            "cache_hits,count(*) FILTER(WHERE cache='MISS') AS cache_misses "
            "FROM request_metrics WHERE created_at >= %s",
            (started_at,),
        )[0]
        check(
            "plausible stored durations",
            not read(
                "SELECT request_id FROM request_metrics WHERE latency_ms<0 OR "
                "latency_ms='NaN'::float8"
            ),
        )
        check("unique response IDs", len(ids) == len(set(ids)))
        actual_delta = (
            read("SELECT count(*) AS n FROM request_metrics")[0]["n"] - initial_count
        )
        # 33 named requests + 35 timing samples + 1 socket cancellation;
        # exactly one deliberate metrics-write failure has no database row.
        expected_requests = len(ids) + 35 + 1
        check(
            "exact metric count with one controlled loss",
            actual_delta == expected_requests - 1,
        )
        check("run SQL count matches delta", stats["request_count"] == actual_delta)
    log = (ROOT / ".local/security-http-server.log").read_text()
    events = [
        json.loads(line) for line in log.splitlines() if line.startswith('{"timestamp"')
    ]
    check("JSON events present", len(events) > 10)
    check(
        "safe persistence failure visible",
        any(e["event"] == "metrics.failed" for e in events),
    )
    check(
        "private data absent from logs",
        all(
            secret not in log
            for secret in [
                private_question,
                "private-observability.pdf",
                *cookies,
                *[a["password"] for a in accounts],
            ]
        ),
    )
    correlated = [e for e in events if e.get("request_id") == answer]
    check(
        "stage correlation",
        {"request.started", "stage.finished", "metrics.written", "request.finished"}
        <= {e["event"] for e in correlated},
    )
    writes = [e["duration_ms"] for e in events if e["event"] == "metrics.written"]

    def percentile(values, fraction):
        values = sorted(values)
        i = (len(values) - 1) * fraction
        low = int(i)
        return values[low] + (values[min(low + 1, len(values) - 1)] - values[low]) * (
            i - low
        )

    result = {
        "status": "PASS",
        "checks": checks,
        "check_count": len(checks),
        "http_requests_with_ids": len(ids),
        "http_requests_total": expected_requests,
        "metrics_rows_created": actual_delta,
        "controlled_metric_write_losses": 1,
        "metrics": stats,
        "overhead_sample": {
            "n": len(durations),
            "mean_ms": statistics.mean(durations),
            "p50_ms": percentile(durations, 0.5),
            "p95_ms": percentile(durations, 0.95),
        },
        "metric_write_ms": {
            "p50": percentile(writes, 0.5),
            "p95": percentile(writes, 0.95),
        },
        "candidate_count": len(exported),
        "golden_sha256": golden_hash,
        "sanitized_logs": [correlated[0], correlated[-1]],
    }
    (ROOT / ".local/step8-http.json").write_text(json.dumps(result, indent=2))
    (ROOT / ".local/step8-http.log").write_text(log)
    print(
        f"PASS: {len(checks)} assertions; {len(ids)} HTTP request IDs; "
        f"{len(exported)} review candidates"
    )


if __name__ == "__main__":
    main()
