"""Check original Gemini data against a pre-integration cache-only audit."""

import json

from eval.corpus import ROOT, canonical, sha256
from eval.local_corpus import snapshot_original

RECEIPT = ROOT / "eval/gemini-preservation.json"


def verify():
    receipt = json.loads(RECEIPT.read_text())
    for relative, expected in receipt["cache_file_sha256"].items():
        path = ROOT / ".local/eval-cache" / relative
        if sha256(path.read_bytes()) != expected:
            raise ValueError("Original Gemini cache changed or disappeared")
    rows, _, _, _ = snapshot_original()
    if sha256(canonical(rows)) != receipt["original_vectors_sha256"]:
        raise ValueError("Original Gemini chunks/vectors changed")
    if len(receipt["verified_records"]) != 20:
        raise ValueError("Gemini record audit missing")
    print(
        "Original Gemini preservation: 20/20 pairs; "
        "cache bytes and 151 vectors unchanged."
    )


if __name__ == "__main__":
    verify()
