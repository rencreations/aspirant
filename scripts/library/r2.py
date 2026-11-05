"""Replicate the local mirror (D:\\ren\\aspirant-r2) into the R2 bucket, or check they match.

    python scripts/library/r2.py sync [subfolder]     upload what is new or changed (never deletes)
    python scripts/library/r2.py sync --delete        also remove bucket objects that are not in the mirror
    python scripts/library/r2.py status [subfolder]   count and size, mirror against bucket
    python scripts/library/r2.py restore [subfolder]  the other way: download the bucket into the mirror

The key of an object is its path under the mirror, so  D:\\ren\\aspirant-r2\\library\\v1\\arts\\x\\f.webp
is  https://s3.aspirant.cc/library/v1/arts/x/f.webp.

Credentials: ~/.config/aspirant/r2-scoped.env (object read and write on the bucket `aspirant` only).
Needs the AWS CLI (`aws`). Nothing here prints a secret.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import common

ENV_FILE = Path.home() / ".config" / "aspirant" / "r2-scoped.env"
CACHE = "public, max-age=2592000"  # 30 days. A changed file needs a new version folder (VERSION in common.py).
TYPES = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".vtt": "text/vtt; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".obj": "text/plain; charset=utf-8",
    ".mtl": "text/plain; charset=utf-8",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
}


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    if not ENV_FILE.exists():
        raise SystemExit(f"Missing {ENV_FILE}. See scripts/library/README.md.")
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    env["AWS_ACCESS_KEY_ID"] = env["R2_ACCESS_KEY_ID"]
    env["AWS_SECRET_ACCESS_KEY"] = env["R2_SECRET_ACCESS_KEY"]
    env["AWS_DEFAULT_REGION"] = "auto"
    env["AWS_EC2_METADATA_DISABLED"] = "true"
    return env


def aws(env: dict[str, str], *args: str, capture: bool = False) -> subprocess.CompletedProcess:
    cmd = ["aws", *args, "--endpoint-url", env["R2_ENDPOINT"]]
    return subprocess.run(cmd, env=env, capture_output=capture, text=True)


def sync(sub: str = "", delete: bool = False) -> int:
    env = load_env()
    bucket = env["R2_BUCKET"]
    local = common.MIRROR / sub if sub else common.MIRROR
    if not local.exists():
        raise SystemExit(f"Nothing at {local}")
    base = f"s3://{bucket}/{sub.replace(os.sep, '/')}".rstrip("/")
    failed = 0
    for ext, ctype in TYPES.items():
        r = aws(
            env, "s3", "sync", str(local), base,
            "--exclude", "*", "--include", f"*{ext}",
            "--exclude", "*/_work/*", "--exclude", "*/.meta.json", "--exclude", "*.tmp",
            "--content-type", ctype, "--cache-control", CACHE, "--no-progress",
            *(["--delete"] if delete else []),
        )
        if r.returncode != 0:
            failed += 1
            print(f"sync {ext} failed (exit {r.returncode})")
    print("sync finished" + (f" with {failed} failed group(s)" if failed else " cleanly"))
    return 1 if failed else 0


def restore(sub: str = "") -> int:
    env = load_env()
    bucket = env["R2_BUCKET"]
    local = common.MIRROR / sub if sub else common.MIRROR
    local.mkdir(parents=True, exist_ok=True)
    base = f"s3://{bucket}/{sub.replace(os.sep, '/')}".rstrip("/")
    return aws(env, "s3", "sync", base, str(local), "--no-progress").returncode


def count(env: dict[str, str], sub: str) -> tuple[int, int]:
    base = f"s3://{env['R2_BUCKET']}/{sub.replace(os.sep, '/')}".rstrip("/") + "/"
    r = aws(env, "s3", "ls", base, "--recursive", "--summarize", capture=True)
    n = size = 0
    for line in (r.stdout or "").splitlines():
        if line.strip().startswith("Total Objects:"):
            n = int(line.split(":")[1])
        elif line.strip().startswith("Total Size:"):
            size = int(line.split(":")[1])
    return n, size


def status(sub: str = "") -> int:
    env = load_env()
    local = common.MIRROR / sub if sub else common.MIRROR
    ln = ls = 0
    for p in local.rglob("*"):
        if p.is_file() and "_work" not in p.parts and p.name != ".meta.json" and p.suffix != ".tmp":
            ln += 1
            ls += p.stat().st_size
    rn, rs = count(env, sub)
    print(f"mirror: {ln} files, {common.human(ls)}")
    print(f"bucket: {rn} objects, {common.human(rs)}")
    print("MATCH" if (ln, ls) == (rn, rs) else "DIFFERENT (run: python scripts/library/r2.py sync)")
    return 0 if (ln, ls) == (rn, rs) else 1


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    cmd = args[0] if args else "status"
    sub = args[1] if len(args) > 1 else ""
    if cmd == "sync":
        sys.exit(sync(sub, delete="--delete" in flags))
    if cmd == "status":
        sys.exit(status(sub))
    if cmd == "restore":
        sys.exit(restore(sub))
    raise SystemExit(__doc__)
