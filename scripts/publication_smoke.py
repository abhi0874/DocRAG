"""Bounded production acceptance checks; private operator fixtures stay ignored.

Requires explicit --live and an unused receipt path. Makes at most three approved
public chat requests (two complete, one cancelled), with no retries or cleanup.
Run only after separate authorization for the public deployment and free API use.
"""

import argparse
import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://docrag-demo.onrender.com"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    # Reserve before HTTP/model calls, so a completed run cannot be overwritten.
    args.receipt.open("x").close()
    report = {
        "origin": ORIGIN,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "checks": [],
        "chat_requests": 0,
        "status": "RUNNING",
    }
    settings = dotenv_values(ROOT / ".local/publication-render.env")
    assert settings["DOCRAG_APP_ORIGIN"] == ORIGIN
    assert settings["DOCRAG_GEMINI_BILLING_CONFIRMED"] == "no-linked-account"
    accounts = json.loads((ROOT / ".local/publication-accounts.json").read_text())
    assert len(accounts) == 2
    secrets = [
        settings[k]
        for k in ("GEMINI_API_KEY", "BETTER_AUTH_SECRET", "DEMO_DATABASE_URL")
    ]
    secrets.append(urlsplit(settings["DEMO_DATABASE_URL"]).password)
    secrets.extend(a["password"] for a in accounts)
    jars = [http.cookiejar.CookieJar() for _ in range(3)]
    clients = [
        urllib.request.build_opener(urllib.request.HTTPCookieProcessor(j)) for j in jars
    ]
    questions = json.loads((ROOT / "lib/demo-questions.json").read_text())
    refusal = next(
        json.loads(line)
        for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
        if json.loads(line)["type"] == "unanswerable"
    )

    def save():
        args.receipt.write_text(json.dumps(report, indent=2) + "\n")

    def check(name, passed, **evidence):
        report["checks"].append({"check": name, "pass": bool(passed), **evidence})
        save()
        if not passed:
            raise ValueError(name)

    def scan(body):
        text = body.decode("utf8", errors="replace")
        if any(secret and secret in text for secret in secrets):
            raise ValueError("Credential exposed in HTTP response; body withheld")

    def request(path, who=0, method="GET", data=None, headers=None, stream=False):
        assert path.startswith("/") and not path.startswith("//")
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(
            ORIGIN + path,
            data=body,
            method=method,
            headers={
                "Origin": ORIGIN,
                "Content-Type": "application/json",
                **(headers or {}),
            },
        )
        try:
            response = clients[who].open(req, timeout=90)
        except urllib.error.HTTPError as error:
            response = error
        if stream:
            return response
        with response:
            content = response.read()
            scan(content)
            return response.status, response.headers, content

    def payload(q):
        return {
            "documentId": q["documentId"],
            "messages": [
                {
                    "id": str(uuid.uuid4()),
                    "role": "user",
                    "parts": [{"type": "text", "text": q["question"]}],
                }
            ],
        }

    def chat(q, who, cancel=False):
        report["chat_requests"] += 1
        save()
        start = time.monotonic()
        response = request("/api/chat", who, "POST", payload(q), stream=True)
        events, first = [], None
        with response:
            check(
                "chat_http_" + str(report["chat_requests"]),
                response.status == 200,
                status=response.status,
            )
            request_id = response.headers.get("X-Request-ID")
            uuid.UUID(request_id)
            check(
                "cache_bypassed_" + str(report["chat_requests"]),
                response.headers.get("X-DocRAG-Cache") == "BYPASS",
            )
            for line in response:
                scan(line)
                if not line.startswith(b"data: ") or line.strip() == b"data: [DONE]":
                    continue
                event = json.loads(line[6:])
                events.append(event)
                if event.get("type") == "text-delta":
                    first = first or (time.monotonic() - start)
                    if cancel:
                        break
        text = "".join(
            e.get("delta", "") for e in events if e.get("type") == "text-delta"
        )
        sources = next(
            (e["data"]["sources"] for e in events if e.get("type") == "data-sources"),
            [],
        )
        validation = next(
            (e["data"] for e in events if e.get("type") == "data-validation"), {}
        )
        check(
            "stream_" + str(report["chat_requests"]),
            bool(text)
            and bool(sources)
            and not any(e.get("type") == "error" for e in events),
            request_id=request_id,
            first_text_seconds=first,
            elapsed_seconds=time.monotonic() - start,
            sources=len(sources),
            cancelled_by_client=cancel,
            validation=validation,
        )
        if not cancel:
            check(
                "citation_validation_" + str(report["chat_requests"]),
                validation.get("valid") is True,
            )
        return request_id, text, validation

    try:
        status, _, home = request("/")
        check("homepage_https", status == 200 and b"DocRAG" in home, status=status)
        assets = sorted(
            set(re.findall(r'src="(/_next/static/[^"?]+\.js[^\"]*)"', home.decode()))
        )
        for asset in assets:
            status, _, _ = request(asset)
            check("client_asset", status == 200, asset=asset)
        for path, expected in [("/api/health", "ok"), ("/api/ready", "ready")]:
            status, _, body = request(path)
            check(
                path,
                status == 200 and json.loads(body).get("status") == expected,
                status=status,
            )
        status, _, body = request("/api/documents")
        check(
            "public_corpus",
            status == 200 and {d["id"] for d in json.loads(body)} == {3, 4},
        )
        for doc_id in (3, 4):
            status, _, body = request(f"/api/documents/{doc_id}")
            check(
                "public_source_" + str(doc_id),
                status == 200 and json.loads(body).get("isPublic") is True,
            )
        for path in (
            "/api/metrics",
            "/api/evaluations",
            "/api/feedback?answerId=" + str(uuid.uuid4()),
        ):
            status, _, _ = request(path)
            check(
                "anonymous_denied_" + path.split("?")[0], status == 401, status=status
            )
        for path in ("/api/documents", "/api/evaluations"):
            status, _, _ = request(path, method="POST", data={})
            check("demo_write_denied_" + path, status == 403, status=status)
        status, _, _ = request("/api/auth/sign-up/email", method="POST", data={})
        check("registration_disabled", status == 404, status=status)
        status, _, _ = request(
            "/api/chat",
            method="POST",
            data=payload(questions[0]),
            headers={"Origin": "https://example.invalid"},
        )
        check("foreign_origin_denied", status == 403, status=status)
        status, _, _ = request("/api/chat", method="POST", data={})
        check("invalid_input", status == 400, status=status)
        status, _, _ = request(
            "/api/chat",
            method="POST",
            data=payload(
                {"documentId": 3, "question": "Unapproved synthetic public text"}
            ),
        )
        check("unapproved_text_denied_before_model", status == 403, status=status)
        for who, account in enumerate(accounts, 1):
            status, headers, _ = request(
                "/api/auth/sign-in/email",
                who,
                "POST",
                {"email": account["email"], "password": account["password"]},
            )
            cookie = headers.get("Set-Cookie", "").lower()
            check(
                "secure_login_" + str(who),
                status == 200
                and all(
                    s in cookie
                    for s in ("secure", "httponly", "samesite=lax", "max-age=28800")
                ),
                status=status,
            )
            status, _, body = request("/api/auth/get-session", who)
            check(
                "session_navigation_" + str(who),
                status == 200 and json.loads(body)["user"]["email"] == account["email"],
            )
        answer_id, answer, validation = chat(questions[0], 1)
        check("grounded_answer", "3" in answer and validation.get("kind") == "cited")
        status, _, _ = request(
            "/api/feedback", 1, "POST", {"answerId": answer_id, "value": "up"}
        )
        check("feedback_write", status == 200, status=status)
        status, _, _ = request("/api/feedback?answerId=" + answer_id, 1)
        check("feedback_read", status == 200, status=status)
        status, _, _ = request("/api/feedback?answerId=" + answer_id, 2)
        check("feedback_cross_user_denied", status == 404, status=status)
        status, _, _ = request(
            "/api/feedback", 2, "POST", {"answerId": answer_id, "value": "down"}
        )
        check("feedback_cross_user_write_denied", status == 404, status=status)
        status, _, body = request("/api/metrics", 2)
        check(
            "metrics_cross_user_isolation",
            status == 200 and answer_id not in body.decode(),
        )
        _, refusal_text, validation = chat(
            {"documentId": 3, "question": refusal["question"]}, 1
        )
        check(
            "unsupported_question_refused",
            validation.get("kind") == "uncited-refusal",
            answer=refusal_text,
        )
        status, headers, _ = request("/api/chat", 1, "POST", payload(questions[0]))
        check(
            "application_quota_429",
            status == 429 and int(headers.get("Retry-After", "0")) > 0,
            status=status,
        )
        cancelled_id, _, _ = chat(questions[30], 2, cancel=True)
        terminal = None
        for _ in range(12):
            status, _, body = request("/api/metrics", 2)
            terminal = next(
                (
                    r
                    for r in json.loads(body).get("recent", [])
                    if r["request_id"] == cancelled_id
                ),
                None,
            )
            if terminal:
                break
            time.sleep(1)
        check(
            "cancelled_request_accounted",
            terminal is not None and terminal["outcome"] == "cancelled",
            observed_outcome=terminal["outcome"] if terminal else None,
        )
        for who in (1, 2):
            status, _, _ = request("/api/auth/sign-out", who, "POST", {})
            check("logout_" + str(who), status == 200)
            status, _, body = request("/api/auth/get-session", who)
            check(
                "logout_invalidates_session_" + str(who),
                status == 200 and json.loads(body) is None,
            )
        report["status"] = "PASS"
    except Exception as error:
        report["status"] = "FAIL"
        report["failure"] = (
            str(error) if isinstance(error, ValueError) else type(error).__name__
        )
        # No response bodies, cookies, passwords, or driver errors are printed.
    finally:
        report["finished_at"] = datetime.now(timezone.utc).isoformat()
        save()
    print(
        json.dumps(
            {
                "status": report["status"],
                "passed": sum(c["pass"] for c in report["checks"]),
                "checks": len(report["checks"]),
                "chat_requests": report["chat_requests"],
            }
        )
    )
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
