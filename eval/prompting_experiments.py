"""Step 6 declarations; no retrieval, model, judge or dataset changes."""

from eval.corpus import ROOT, sha256
from eval.reranking_experiments import configuration as reranking_configuration

FILES = [
    "lib/rag-prompt.ts",
    "lib/citations.ts",
    "lib/evidence.ts",
    "lib/response-cache.ts",
    "lib/public-cache-policy.ts",
    "lib/public-cache-manifest.json",
    "lib/validated-stream.ts",
    "lib/types.ts",
]


def configuration(version):
    if version not in ("step5-v1", "grounded-v1"):
        raise ValueError("Unknown prompt version")
    config = reranking_configuration("control")
    config["prompting_experiment"] = version
    config["production_response_cache"] = False
    config["application_file_hashes"].update(
        {p: sha256((ROOT / p).read_bytes()) for p in FILES}
    )
    return config
