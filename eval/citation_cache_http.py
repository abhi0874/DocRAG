"""Exercise the built chat route. Only chat generation is scripted for this probe."""

import json
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from eval.cache_http import ask, server
from eval.corpus import ROOT


class ScriptedChat(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, body):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def forward(self, body=None):
        req = urllib.request.Request(
            "http://127.0.0.1:11434" + self.path,
            data=body,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=180) as upstream:
            self.reply(upstream.read())

    def do_GET(self):
        if self.path in {"/api/version", "/api/tags"}:
            self.forward()
        else:
            self.send_error(404)

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        if self.path == "/api/embed":
            self.forward(body)
            return
        if self.path != "/api/chat":
            self.send_error(404)
            return
        model = json.loads(body)["model"]
        self.server.calls += 1
        frames = [
            {"model": model, "message": {"content": part}, "done": False}
            for part in self.server.parts
        ]
        frames.append(
            {
                "model": model,
                "message": {"content": ""},
                "done": True,
                "done_reason": "stop",
                "prompt_eval_count": 20,
                "eval_count": 10,
            }
        )
        self.reply(b"".join(json.dumps(f).encode() + b"\n" for f in frames))


def main():
    records = list(
        map(json.loads, (ROOT / "eval/golden_set.jsonl").read_text().splitlines())
    )
    cases = [
        (
            ["The value is 3, according to source [", "-1]."],
            "invalid-references",
            False,
        ),
        (["It receives the Python integer 3 ", "[1]."], "cited", True),
        (
            [
                "The value is 3 [1].\n```x = 3",
                "```\nAccording to source [-1], the value is 3.",
            ],
            "invalid-references",
            False,
        ),
        (["```python\nx = items[-1]\n```\n", "The value is 3 [1]."], "cited", True),
        (
            ["I cannot determine that from the supplied documents."],
            "uncited-refusal",
            True,
        ),
    ]
    with ThreadingHTTPServer(("127.0.0.1", 0), ScriptedChat) as fixture:
        worker = threading.Thread(target=fixture.serve_forever, daemon=True)
        worker.start()
        try:
            with patch.dict(
                "os.environ",
                {"OLLAMA_BASE_URL": f"http://127.0.0.1:{fixture.server_port}"},
            ):
                with server(True, "step5-v1"):
                    for record, (parts, kind, valid) in zip(records, cases):
                        fixture.calls, fixture.parts = 0, parts
                        rows = [ask(record), ask(record)]
                        statuses = [r["cache"] for r in rows]
                        assert statuses == ["MISS", "HIT" if valid else "MISS"]
                        assert fixture.calls == (1 if valid else 2)
                        assert rows[0]["source_ids"] == rows[1]["source_ids"]
                        for row in rows:
                            assert row["validation"]["valid"] is valid
                            assert row["validation"]["kind"] == kind
                            assert row["answer"] == "".join(parts)
                        print(
                            json.dumps(
                                {
                                    "kind": kind,
                                    "statuses": statuses,
                                    "model_calls": fixture.calls,
                                }
                            )
                        )
        finally:
            fixture.shutdown()
            worker.join()


if __name__ == "__main__":
    main()
