"""Operator-only account creation; password input never appears in shell history."""

import getpass
import json
import os
import subprocess

from scripts.common import ROOT, load_environment


def main():
    load_environment()
    name = input("Display name: ").strip()
    email = input("Email: ").strip()
    password = getpass.getpass("New password (12–128 characters): ")
    if password != getpass.getpass("Repeat password: "):
        raise ValueError("Passwords differ; no account created")
    result = subprocess.run(
        ["node", "--import", "tsx", "scripts/create_account.ts"],
        cwd=ROOT,
        env=os.environ.copy(),
        input=json.dumps({"name": name, "email": email, "password": password}),
        text=True,
        check=False,
    )
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyboardInterrupt, EOFError) as error:
        print(
            str(error)
            if isinstance(error, ValueError)
            else "Account creation cancelled"
        )
        raise SystemExit(1) from None
