"""Run the authenticated application on the selected free local corpus."""

import argparse
import os
import subprocess
from urllib.parse import urlsplit

from eval.chunking_experiments import experiment_url
from scripts.common import ROOT, load_environment


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["run", "create-account"])
    args = parser.parse_args()
    load_environment()
    env = os.environ.copy()
    env.update(
        AI_PROVIDER="ollama",
        OLLAMA_DATABASE_URL=experiment_url("heading-1400-280"),
        DOCRAG_CHUNKING_EXPERIMENT="heading-1400-280",
    )
    env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    if args.action == "create-account":
        command = [str(ROOT / ".venv/bin/python"), "-m", "scripts.create_account"]
    else:
        origin = urlsplit(env.get("DOCRAG_APP_ORIGIN", "http://localhost:8000"))
        if origin.hostname not in {"localhost", "127.0.0.1"}:
            raise ValueError("This helper starts a loopback development server only")
        command = [
            "node",
            "node_modules/next/dist/bin/next",
            "dev",
            "--hostname",
            "127.0.0.1",
            "--port",
            str(origin.port or 8000),
        ]
    raise SystemExit(subprocess.run(command, cwd=ROOT, env=env, check=False).returncode)


if __name__ == "__main__":
    main()
