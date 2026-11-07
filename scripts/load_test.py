"""Bounded local-only load measurements; never targets a running user application."""

import argparse
import hashlib
import http.client
import json
import math
import os
import secrets
import socket
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit, urlunsplit
from urllib.request import urlopen

import psycopg
from psycopg import sql

from eval.chunking_experiments import experiment_url
from scripts.common import ROOT
from scripts.native_db import DATA, owned_cluster
from scripts.security_http import pdf

ORIGIN = "http://127.0.0.1:8011"
MODES = ("read", "authentication", "cached", "streaming", "cancellation", "upload")


def percentile(values, fraction):
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * fraction
    lo, hi = math.floor(index), math.ceil(index)
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def summary(rows, seconds):
    latencies = [r["latency_ms"] for r in rows]
    return {
        "requests": len(rows),
        "elapsed_seconds": seconds,
        "requests_per_second": len(rows) / seconds if seconds else 0,
        "successful_requests_per_second": sum(r["ok"] for r in rows) / seconds,
        "error_rate": sum(not r["ok"] for r in rows) / len(rows) if rows else None,
        "rate_limited": sum(r["status"] == 429 for r in rows),
        "p50_ms": percentile(latencies, 0.5),
        "p95_ms": percentile(latencies, 0.95),
        "p99_ms": percentile(latencies, 0.99),
        "queue_p95_ms": percentile([r["queue_ms"] for r in rows], 0.95),
    }


def exchange(path, cookie="", body=None, content_type="application/json", cancel=False):
    started = time.perf_counter()
    conn = http.client.HTTPConnection("127.0.0.1", 8011, timeout=60)
    headers = {"Origin": ORIGIN, "Content-Type": content_type, "Cookie": cookie}
    if isinstance(body, dict):
        body = json.dumps(body).encode()
    try:
        conn.request("POST" if body is not None else "GET", path, body, headers)
        response = conn.getresponse()
        data = (
            response.readline()
            if cancel and response.status == 200
            else response.read()
        )
        result = {
            "status": response.status,
            "request_id": response.getheader("X-Request-ID"),
            "cache": response.getheader("X-DocRAG-Cache"),
            "latency_ms": (time.perf_counter() - started) * 1000,
            "queue_ms": 0,
            "ok": response.status in (200, 201),
        }
        if path == "/api/chat" and not cancel and response.status == 200:
            events = [
                json.loads(s[6:]) for s in data.splitlines() if s.startswith(b"data: {")
            ]
            result["ok"] = any(e["type"] == "finish" for e in events) and not any(
                e["type"] == "error" for e in events
            )
        cookies = "; ".join(
            v.split(";", 1)[0]
            for k, v in response.getheaders()
            if k.lower() == "set-cookie"
        )
        return result, cookies, response.getheader("Retry-After")
    except (OSError, http.client.HTTPException):
        return (
            {
                "status": 0,
                "request_id": None,
                "cache": None,
                "latency_ms": (time.perf_counter() - started) * 1000,
                "queue_ms": 0,
                "ok": False,
            },
            "",
            None,
        )
    finally:
        conn.close()


def chat(question):
    return {
        "documentId": 3,
        "messages": [
            {
                "id": "load",
                "role": "user",
                "parts": [{"type": "text", "text": question}],
            }
        ],
    }


def setup(directory, env):
    owned_cluster()
    source = experiment_url("heading-1400-280")
    with psycopg.connect(source) as conn:
        conn.read_only = True
        assert conn.execute("SHOW data_directory").fetchone()[0] == str(DATA)
        assert conn.execute("SELECT count(*) FROM chunks").fetchone()[0] == 162
    name = "docrag_security_test_" + uuid.uuid4().hex[:12]
    target = urlunsplit(urlsplit(source)._replace(path="/" + name))
    with psycopg.connect(source, autocommit=True) as conn:
        conn.execute(
            sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(
                sql.Identifier(name)
            )
        )
    with psycopg.connect(target) as dest, psycopg.connect(source) as src:
        src.read_only = True
        dest.execute(
            (ROOT / "db/init.sql").read_text().replace("vector(1536)", "vector(768)")
        )
        with src.cursor().copy("COPY documents TO STDOUT") as reader:
            with dest.cursor().copy("COPY documents FROM STDIN") as writer:
                for block in reader:
                    writer.write(block)
        columns = (
            "id,document_id,chunk_index,page_number,content,embedding,"
            "created_at,metadata"
        )
        with src.cursor().copy(f"COPY chunks ({columns}) TO STDOUT") as reader:
            with dest.cursor().copy(f"COPY chunks ({columns}) FROM STDIN") as writer:
                for block in reader:
                    writer.write(block)
        for table in ("documents", "chunks"):
            dest.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}','id'),MAX(id)) "
                f"FROM {table}"
            )
    env.update(OLLAMA_DATABASE_URL=target, SECURITY_DATABASE_URL=target)
    with (directory / "setup.log").open("w") as log:
        subprocess.run(
            ["node", "--import", "tsx", "scripts/security-migrate.ts"],
            env=env,
            stdout=log,
            stderr=log,
            check=True,
        )
        accounts = []
        for index in range(50):
            account = {
                "name": "Public load fixture",
                "email": f"load-{index}-{uuid.uuid4().hex}@example.test",
                "password": secrets.token_urlsafe(32),
            }
            subprocess.run(
                ["node", "--import", "tsx", "scripts/create_account.ts"],
                input=json.dumps(account),
                text=True,
                env=env,
                stdout=log,
                stderr=log,
                check=True,
            )
            accounts.append(account)
    (directory / "ownership.json").write_text(
        json.dumps({"owner": str(ROOT), "database": name})
    )
    return target, accounts


def sample_resources(target, pid):
    with psycopg.connect(target) as conn:
        conn.read_only = True
        connections = conn.execute(
            "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()"
        ).fetchone()[0]
    rows = subprocess.check_output(
        ["ps", "-axo", "pid,ppid,%cpu,rss,comm"], text=True
    ).splitlines()[1:]
    selected = []
    parsed = [line.split(None, 4) for line in rows]
    postgres_pid = int(
        (ROOT / ".local/postgres/postmaster.pid").read_text().splitlines()[0]
    )
    owned = {pid, postgres_pid}
    owned.update(int(p[0]) for p in parsed if len(p) == 5 and "ollama" in p[4].lower())
    for _ in range(8):
        owned.update(int(p[0]) for p in parsed if len(p) == 5 and int(p[1]) in owned)
    for line in rows:
        parts = line.split(None, 4)
        if len(parts) == 5 and int(parts[0]) in owned:
            kind = "postgres" if "postgres" in parts[4].lower() else "model_or_child"
            selected.append(
                {
                    "kind": "app" if int(parts[0]) == pid else kind,
                    "cpu_percent": float(parts[2]),
                    "rss_kib": int(parts[3]),
                }
            )
    return {
        "time": time.time(),
        "connections": connections,
        "processes": selected,
        "host_load": os.getloadavg(),
    }


def measure(mode, users, cookies, target, pid, duration, ramp):
    begin = time.perf_counter()
    samples, rows = [], []
    stop = threading.Event()
    inference = threading.BoundedSemaphore(2)
    golden = json.loads((ROOT / "eval/golden_set.jsonl").read_text().splitlines()[0])[
        "question"
    ]

    def monitor():
        while not stop.is_set():
            try:
                sample = sample_resources(target, pid)
                samples.append(sample)
                if any(
                    p["kind"] == "app" and p["rss_kib"] > 2 * 1024 * 1024
                    for p in sample["processes"]
                ):
                    stop.set()
            except (OSError, psycopg.Error):
                stop.set()
            stop.wait(1)

    def user(index):
        time.sleep(ramp * index / users)
        row = None
        queued = time.perf_counter()
        needs_model = mode in ("streaming", "cancellation", "upload")
        if needs_model and not inference.acquire(timeout=180):
            return {
                "status": 0,
                "ok": False,
                "queue_ms": 180000,
                "latency_ms": 0,
                "request_id": None,
                "cache": None,
            }
        try:
            if stop.is_set():
                return None
            queue_ms = (time.perf_counter() - queued) * 1000
            if mode == "read":
                row = exchange("/api/documents", cookies[index])[0]
            elif mode == "authentication":
                row = exchange("/api/auth/get-session", cookies[index])[0]
            elif mode in ("cached", "streaming", "cancellation"):
                question = (
                    golden
                    if mode == "cached"
                    else "In one sentence, what is FastAPI? Public load sample "
                    f"{users}-{index}-{mode}."
                )
                row = exchange(
                    "/api/chat",
                    cookies[index],
                    chat(question),
                    cancel=mode == "cancellation",
                )[0]
            else:
                boundary = "load-" + uuid.uuid4().hex
                body = (
                    (
                        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                        'filename="public.pdf"\r\nContent-Type: application/pdf\r\n\r\n'
                    ).encode()
                    + pdf()
                    + f"\r\n--{boundary}--\r\n".encode()
                )
                row = exchange(
                    "/api/documents",
                    cookies[index],
                    body,
                    "multipart/form-data; boundary=" + boundary,
                )[0]
            row["queue_ms"] = queue_ms
            return row
        finally:
            if needs_model:
                inference.release()

    thread = threading.Thread(target=monitor)
    thread.start()
    try:
        with ThreadPoolExecutor(max_workers=users) as pool:
            rows = [r for r in pool.map(user, range(users)) if r is not None]
        time.sleep(max(0, duration - (time.perf_counter() - begin)))
    finally:
        aborted = stop.is_set()
        stop.set()
        thread.join()
    elapsed = time.perf_counter() - begin
    ids = [r["request_id"] for r in rows if r["request_id"]]
    # Allow bounded asynchronous cancellation telemetry to settle.
    time.sleep(1)
    with psycopg.connect(target) as conn:
        conn.read_only = True
        metrics = conn.execute(
            "SELECT request_id,outcome,cache,details FROM request_metrics "
            "WHERE request_id=ANY(%s)",
            (ids,),
        ).fetchall()
        cancellations_without_receipt = conn.execute(
            "SELECT count(*) FROM request_metrics m WHERE request_id=ANY(%s) "
            "AND outcome='cancelled' AND NOT EXISTS"
            "(SELECT 1 FROM answer_receipts a WHERE a.id=m.request_id)",
            (ids,),
        ).fetchone()[0]
    validation = {
        "all_users_attempted": len(rows) == users,
        "metrics_present": len(metrics) == len(ids),
        "cached_hits": mode != "cached"
        or all(r["cache"] == "HIT" for r in rows if r["ok"]),
        "uncached_bypass": mode != "streaming"
        or all(r["cache"] == "BYPASS" for r in rows if r["ok"]),
        "cancellation_accounting": mode != "cancellation"
        or cancellations_without_receipt == sum(r["ok"] for r in rows),
    }
    return {
        "mode": mode,
        "users": users,
        "ramp_seconds": ramp,
        "minimum_window_seconds": duration,
        "model_concurrency_cap": 2,
        "aborted": aborted,
        "validation": validation,
        "summary": summary(rows, elapsed),
        "requests": rows,
        "resources": samples,
        "metric_count": len(metrics),
        "cancelled_without_receipt": cancellations_without_receipt,
        "server_metrics": [
            {
                "request_id": str(r[0]),
                "outcome": r[1],
                "cache": r[2],
                "timings": r[3].get("timings"),
                "generation_ms": r[3].get("generation_ms"),
                "first_token_ms": r[3].get("first_token_ms"),
            }
            for r in metrics
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    if not args.run_id.replace("-", "").isalnum():
        raise ValueError("Invalid run ID")
    directory = ROOT / ".local" / ("load-" + args.run_id)
    directory.mkdir(mode=0o700)
    output = ROOT / "loadtest" / (args.run_id + ".json")
    if output.exists():
        raise ValueError("Never overwrite load evidence")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 8011))
    with urlopen("http://127.0.0.1:11434/api/version", timeout=5) as response:
        assert json.load(response)["version"] == "0.40.9"
    env = {
        **os.environ,
        "PATH": str(ROOT / ".local/node-v24.22.1-darwin-arm64/bin")
        + os.pathsep
        + os.environ["PATH"],
        "AI_PROVIDER": "ollama",
        "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
        "DOCRAG_APP_ORIGIN": ORIGIN,
        "DOCRAG_LOCAL_HTTP": "true",
        "DOCRAG_CHUNKING_EXPERIMENT": "heading-1400-280",
        "RERANKER_ENABLED": "false",
        "RESPONSE_CACHE_ENABLED": "true",
        "BETTER_AUTH_SECRET": secrets.token_urlsafe(48),
    }
    env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    env.pop("DOCRAG_RUNTIME", None)
    target, accounts = setup(directory, env)
    print("Isolated public fixture database/accounts ready", flush=True)
    result = {
        "status": "RUNNING",
        "git_revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True
        ).strip(),
        "policy": (
            "One operation per virtual user per mode; 5s ramp, >=15s observation, "
            "2 concurrent model calls, 60s socket timeout, 180s client queue bound. "
            "No steady-state capacity claim."
        ),
        "stages": [],
    }
    with (directory / "server.log").open("w") as log:
        process = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                "8011",
            ],
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(30):
                if exchange("/")[0]["status"] == 200:
                    break
                time.sleep(1)
            else:
                raise ValueError("Isolated server failed startup")
            cookies = []
            for account in accounts:
                row, cookie, retry = exchange(
                    "/api/auth/sign-in/email",
                    body={k: account[k] for k in ("email", "password")},
                )
                if row["status"] == 429:
                    print(
                        "Respecting authentication quota before fixture login",
                        flush=True,
                    )
                    time.sleep(min(301, int(retry or 301)) + 1)
                    row, cookie, _ = exchange(
                        "/api/auth/sign-in/email",
                        body={k: account[k] for k in ("email", "password")},
                    )
                assert row["ok"] and cookie, "Fixture authentication failed"
                cookies.append(cookie)
            golden = json.loads(
                (ROOT / "eval/golden_set.jsonl").read_text().splitlines()[0]
            )["question"]
            assert exchange("/api/chat", cookies[0], chat(golden))[0]["ok"]
            for users in (5, 20, 50):
                for mode in MODES:
                    stage = measure(mode, users, cookies, target, process.pid, 15, 5)
                    result["stages"].append(stage)
                    output.write_text(json.dumps(result, indent=2) + "\n")
                    print(users, mode, stage["summary"], flush=True)
                    failures = [
                        r
                        for r in stage["requests"]
                        if not r["ok"] and r["status"] != 429
                    ]
                    if (
                        stage["aborted"]
                        or failures
                        or not all(stage["validation"].values())
                    ):
                        raise ValueError(
                            "Safety stop: resource abort or unexpected request failure"
                        )
            result["status"] = "PASS"
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            if result["status"] != "PASS":
                result["status"] = "INCOMPLETE"
            result["golden_sha256"] = hashlib.sha256(
                (ROOT / "eval/golden_set.jsonl").read_bytes()
            ).hexdigest()
            output.write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
