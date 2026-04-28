from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent


def resolve_launcher() -> list[str]:
    npm_path = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm_path:
        raise RuntimeError("Node.js/npm is not installed or not available on PATH.")
    return [npm_path, "start"]


def main() -> int:
    try:
        command = resolve_launcher()
    except RuntimeError as exc:
        print(f"Nexus launcher error: {exc}", file=sys.stderr)
        return 1

    try:
        return subprocess.call(command, cwd=PROJECT_ROOT)
    except KeyboardInterrupt:
        return 130

if __name__ == "__main__":
    raise SystemExit(main())
