"""Load private settings without exposing values in errors."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


def load_environment():
    load_dotenv(ROOT / ".env", override=False)


def required(name):
    value = os.environ.get(name, "").strip()
    if not value or any(
        marker in value
        for marker in ("replace-with", "DEV_USER", "DEV_PASSWORD", "your-private")
    ):
        raise ValueError(f"{name} is missing or still contains a placeholder")
    return value


def database_url():
    value = required("DATABASE_URL")
    if value == os.environ.get("DATABASE_URL_PROD"):
        raise ValueError("Development and production database URLs must differ")
    if not value.startswith(("postgresql://", "postgres://")):
        raise ValueError("DATABASE_URL must be a PostgreSQL connection URL")
    return value


def redact(value):
    result = str(value)
    for name in ("DATABASE_URL", "DATABASE_URL_PROD", "GOOGLE_GENERATIVE_AI_API_KEY"):
        secret = os.environ.get(name)
        if secret:
            result = result.replace(secret, "[REDACTED]")
    return result
