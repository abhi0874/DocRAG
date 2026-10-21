"""Capture a fixed, attributed documentation snapshot; never overwrite a corpus."""

import hashlib
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "eval/corpus"
AGENT = "DocRAG-Evaluation/1.0"
PAGES = {
    "fastapi": [
        ("path-params", "Path Parameters"),
        ("query-params", "Query Parameters"),
        ("body", "Request Body"),
        ("response-model", "Response Model - Return Type"),
        ("handling-errors", "Handling Errors"),
        ("dependencies", "Dependencies"),
    ],
    "postgresql": [
        ("tutorial-transactions", "3.4. Transactions"),
        ("ddl-constraints", "5.4. Constraints"),
        ("indexes-types", "11.2. Index Types"),
        ("indexes-multicolumn", "11.3. Multicolumn Indexes"),
        ("tutorial-agg", "2.7. Aggregate Functions"),
        ("tutorial-join", "2.6. Joins Between Tables"),
    ],
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fetch(url):
    # macOS curl uses a working system trust store; never disable TLS verification.
    result = subprocess.run(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--location",
            "--proto",
            "=https",
            "--proto-redir",
            "=https",
            "--max-time",
            "45",
            "--retry",
            "2",
            "--retry-delay",
            "2",
            "--user-agent",
            AGENT,
            url,
        ],
        capture_output=True,
        check=True,
    )
    return result.stdout


class ArticleText(HTMLParser):
    """Extract article content, preserving code text and block boundaries."""

    VOID = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }
    BLOCK = {"p", "div", "pre", "li", "h1", "h2", "h3", "h4", "tr", "br"}

    def __init__(self, domain):
        super().__init__(convert_charrefs=True)
        self.domain = domain
        self.stack = []
        self.parts = []
        self.finished = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if not self.stack:
            is_article = (
                tag == "article"
                and self.domain == "fastapi"
                or tag == "div"
                and attrs.get("class") == "sect1"
                and self.domain == "postgresql"
            )
            if self.finished or not is_article:
                return
        if tag in self.BLOCK:
            self.parts.append("\n")
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            self.stack = self.stack[:index]
            if tag in self.BLOCK:
                self.parts.append("\n")
            if not self.stack:
                self.finished = True

    def handle_data(self, data):
        if self.stack and not {"script", "style", "svg"}.intersection(self.stack):
            self.parts.append(data)

    def text(self):
        lines = [
            re.sub(r"[ \t\r\f\v]+", " ", line).strip()
            for line in "".join(self.parts).splitlines()
        ]
        return "\n".join(line for line in lines if line) + "\n"


def main():
    manifest_path = CORPUS / "manifest.json"
    if manifest_path.exists():
        raise ValueError("Snapshot already exists; use its committed bytes unchanged")
    CORPUS.mkdir(parents=True, exist_ok=True)
    policies = {}
    for domain, base in [
        ("fastapi", "https://fastapi.tiangolo.com"),
        ("postgresql", "https://www.postgresql.org"),
    ]:
        raw = fetch(base + "/robots.txt")
        (CORPUS / f"{domain}-robots.txt").write_bytes(raw)
        policy = RobotFileParser()
        policy.parse(raw.decode().splitlines())
        policies[domain] = policy
    entries = []
    for domain, pages in PAGES.items():
        for number, (slug, title) in enumerate(pages, start=1):
            url = (
                f"https://fastapi.tiangolo.com/tutorial/{slug}/"
                if domain == "fastapi"
                else f"https://www.postgresql.org/docs/16/{slug}.html"
            )
            if not policies[domain].can_fetch(AGENT, url):
                raise ValueError(f"Access disallowed: {url}")
            raw = fetch(url)
            parser = ArticleText(domain)
            parser.feed(raw.decode("utf-8"))
            content = parser.text().encode("utf-8")
            if not parser.finished or len(content) < 500:
                raise ValueError(f"Article extraction failed: {url}")
            source_id = f"{domain}.{slug}"
            filename = f"{source_id}.txt"
            (CORPUS / filename).write_bytes(content)
            entries.append(
                {
                    "source_id": source_id,
                    "document_key": domain,
                    "section": title,
                    "url": url,
                    "version": "16" if domain == "postgresql" else None,
                    "version_note": (
                        "PostgreSQL 16 documentation branch"
                        if domain == "postgresql"
                        else "Unversioned live documentation; pinned by snapshot hash"
                    ),
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                    "raw_html_sha256": digest(raw),
                    "content_sha256": digest(content),
                    "text_file": filename,
                    "page_number": number,
                }
            )
            print(source_id, len(content), "bytes")
            time.sleep(0.5)
    manifest = {
        "schema_version": 1,
        "corpus_id": "docrag-public-docs-v1",
        "extraction": "ArticleText-v1; article text with block boundaries",
        "sources": entries,
    }
    manifest["corpus_hash"] = digest(
        json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()
    )
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
