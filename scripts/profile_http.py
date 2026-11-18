"""Verify registration, profile privacy and account deletion against a new local DB."""

import json
import os
import secrets
import tempfile
from pathlib import Path

import psycopg

from eval.corpus import ROOT
from scripts import security_http as http
from scripts.workspace_http import create_database, server


def main():
    directory = Path(tempfile.mkdtemp(prefix="profile-http-", dir=ROOT / ".local"))
    target = create_database(directory, cloud=True)
    http.ORIGIN = "http://127.0.0.1:8007"
    # A synthetic key is sufficient for readiness; this suite never needs inference.
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
        "GEMINI_API_KEY": secrets.token_urlsafe(32),
        "DOCRAG_GEMINI_BILLING_CONFIRMED": "no-linked-account",
        "RERANKER_ENABLED": "false",
        "RESPONSE_CACHE_ENABLED": "false",
    }
    passed = []

    def check(label, condition):
        if not condition:
            raise AssertionError(label)
        passed.append(label)

    def call(label, status, path, method="GET", data=None, cookie="", headers=None):
        result = http.request(path, method, data, cookie, headers)
        check(label, result[0] == status)
        return result

    terms = dict(
        version="non-sensitive-professional-v2",
        country="CA",
        adult=True,
        professional=True,
        nonSensitive=True,
        externalProcessing=True,
    )
    accounts = [
        dict(
            name=label,
            email=secrets.token_hex(8) + "@example.test",
            password=secrets.token_urlsafe(24),
        )
        for label in ("Alpha", "Beta")
    ]

    def login(account):
        response = call(
            "email login",
            200,
            "/api/auth/sign-in/email",
            "POST",
            {k: account[k] for k in ("email", "password")},
        )
        return response[1]["Set-Cookie"].split(";")[0]

    with server(env, directory):
        call(
            "registration requires acceptance",
            403,
            "/api/auth/sign-up/email",
            "POST",
            accounts[0],
        )
        call(
            "excluded country rejected",
            400,
            "/api/processing-consent",
            "POST",
            {**terms, "country": "DE"},
        )
        call(
            "incomplete attestations rejected",
            400,
            "/api/processing-consent",
            "POST",
            {**terms, "adult": False},
        )
        call(
            "old disclosure version rejected",
            400,
            "/api/processing-consent",
            "POST",
            {**terms, "version": "obsolete"},
        )
        receipt = call(
            "eligible country accepted", 200, "/api/processing-consent", "POST", terms
        )[1]["Set-Cookie"].split(";")[0]
        for account in accounts:
            call(
                "registration with receipt",
                200,
                "/api/auth/sign-up/email",
                "POST",
                account,
                receipt,
            )
        first, second = map(login, accounts)
        other_session = login(accounts[0])
        profile = "/api/account"
        state = "/api/processing-consent"

        def body(response):
            return json.loads(response[2])

        first_id = body(http.request("/api/auth/get-session", cookie=first))["user"][
            "id"
        ]
        second_id = body(http.request("/api/auth/get-session", cookie=second))["user"][
            "id"
        ]
        with psycopg.connect(target) as conn:
            before = conn.execute(
                "SELECT id,chunk_count FROM documents ORDER BY id"
            ).fetchall()
            docs = []
            for owner in (first_id, second_id):
                doc = conn.execute(
                    "INSERT INTO documents(title,filename,status) "
                    "VALUES('Fixture','fixture.pdf','ready') RETURNING id"
                ).fetchone()[0]
                conn.execute(
                    "INSERT INTO document_access(document_id,owner_id,visibility) "
                    "VALUES(%s,%s,'private')",
                    (doc, owner),
                )
                conn.execute(
                    "INSERT INTO document_files(document_id,bytes) VALUES(%s,%s)",
                    (doc, http.pdf()),
                )
                conn.execute(
                    "INSERT INTO chunks(document_id,chunk_index,content) "
                    "VALUES(%s,0,'synthetic text')",
                    (doc,),
                )
                conn.execute(
                    "INSERT INTO workspace_document_policy "
                    "VALUES(%s,now()+interval '1 day',%s)",
                    (doc, terms["version"]),
                )
                docs.append(doc)
            evaluation = conn.execute(
                "INSERT INTO evaluations"
                "(document_id,question,rag_answer,no_rag_answer) "
                "VALUES(%s,'test','test','test') RETURNING id",
                (before[0][0],),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO evaluation_access VALUES(%s,%s)", (evaluation, first_id)
            )
        initial = body(http.request(state, cookie=first))
        check(
            "registration permanently records version and country",
            initial["enabled"]
            and initial["country"] == "CA"
            and initial["version"] == terms["version"],
        )
        call("withdraw hosted access", 200, state, "POST", {"action": "disable"}, first)
        after = body(http.request(state, cookie=other_session + "; " + receipt))
        check(
            "withdrawal persists across sessions and preserves receipt",
            not after["enabled"] and after["acceptedAt"] == initial["acceptedAt"],
        )
        call(
            "withdrawn account cannot post a question using guest receipt",
            403,
            "/api/chat",
            "POST",
            {
                "documentId": 4,
                "messages": [
                    {
                        "id": "q",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Fixture?"}],
                    }
                ],
            },
            first + "; " + receipt,
        )
        call(
            "withdrawn account cannot upload", 403, "/api/documents", "POST", {}, first
        )
        check(
            "other user's consent still enabled",
            body(http.request(state, cookie=second))["enabled"],
        )
        call(
            "guest cannot enable from a saved account",
            401,
            state,
            "POST",
            {"action": "enable"},
            receipt,
        )
        call(
            "re-enable using account acceptance alone",
            200,
            state,
            "POST",
            {"action": "enable"},
            other_session,
        )
        check(
            "all sessions retain original terms and country after re-enabling",
            body(http.request(state, cookie=first)) == initial,
        )
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE auth_user SET hosted_consent_version=NULL WHERE id=%s",
                (second_id,),
            )
        call(
            "missing account acceptance cannot be bypassed with a guest receipt",
            403,
            state,
            "POST",
            {"action": "enable"},
            second + "; " + receipt,
        )
        call(
            "legacy account records its first acceptance",
            200,
            state,
            "POST",
            terms,
            second,
        )
        call(
            "anonymous profile update denied",
            401,
            profile,
            "PATCH",
            {"name": "Demo", "avatar": None},
        )
        call(
            "profile cannot rewrite terms",
            400,
            profile,
            "PATCH",
            {"name": "Demo", "avatar": None, "consentCountry": "US"},
            first,
        )
        call(
            "reject invalid image",
            400,
            profile,
            "PATCH",
            {"name": "Demo", "avatar": "invalid"},
            first,
        )
        picture = "ABCD" * (64 * 64)
        call(
            "save name and avatar",
            200,
            profile,
            "PATCH",
            {"name": "Test profile", "avatar": picture},
            first,
        )
        session = body(http.request("/api/auth/get-session", cookie=other_session))[
            "user"
        ]
        check(
            "profile persists across devices",
            session["name"] == "Test profile" and session["avatar"] == picture,
        )
        check(
            "other user's profile is isolated",
            body(http.request("/api/auth/get-session", cookie=second))["user"]["name"]
            == "Beta",
        )
        email = {"email": accounts[0]["email"]}
        call(
            "cross-origin deletion denied",
            403,
            profile,
            "DELETE",
            email,
            first,
            {"Origin": "https://elsewhere.example.test"},
        )
        call("anonymous deletion denied", 401, profile, "DELETE", email)
        call(
            "another account email rejected",
            400,
            profile,
            "DELETE",
            {"email": accounts[1]["email"]},
            first,
        )
        with psycopg.connect(target) as conn:
            conn.execute(
                "UPDATE auth_session SET created_at=now()-interval '16 minutes' "
                "WHERE user_id=%s",
                (first_id,),
            )
        call("old session cannot delete", 403, profile, "DELETE", email, first)
        fresh = login(accounts[0])
        response = call("delete own account", 200, profile, "DELETE", email, fresh)
        check(
            "cookie expired",
            any(
                "session_token=" in x and "max-age=0" in x.lower()
                for x in response[1].get_all("Set-Cookie", [])
            ),
        )
        for cookie in (first, other_session, fresh):
            check(
                "all previous sessions revoked",
                body(http.request("/api/auth/get-session", cookie=cookie)) is None,
            )
        call(
            "other account can still read its library",
            200,
            "/api/documents?scope=mine",
            cookie=second,
        )
        with psycopg.connect(target) as conn:
            for table, column in (
                ("auth_user", "id"),
                ("auth_session", "user_id"),
                ("auth_account", "user_id"),
            ):
                check(
                    table + " owner removed",
                    not conn.execute(
                        f"SELECT 1 FROM {table} WHERE {column}=%s", (first_id,)
                    ).fetchall(),
                )
            for table, column in (
                ("documents", "id"),
                ("chunks", "document_id"),
                ("document_files", "document_id"),
                ("document_access", "document_id"),
                ("workspace_document_policy", "document_id"),
            ):
                check(
                    table + " deletion is owner scoped",
                    conn.execute(
                        f"SELECT {column} FROM {table} WHERE {column}=ANY(%s)", (docs,)
                    ).fetchall()
                    == [(docs[1],)],
                )
            check(
                "public corpus retained",
                conn.execute(
                    "SELECT id,chunk_count FROM documents WHERE id=ANY(%s) ORDER BY id",
                    ([x[0] for x in before],),
                ).fetchall()
                == before,
            )
            check(
                "private evaluation on public document removed",
                not conn.execute(
                    "SELECT id FROM evaluations WHERE id=%s", (evaluation,)
                ).fetchall(),
            )
    (directory / "receipt.json").write_text(json.dumps(passed, indent=2))
    print(f"{len(passed)} profile HTTP checks passed in {directory.name}")


if __name__ == "__main__":
    main()
