"""Clone, inspect, safely edit and publish a run's real local Git workspace."""

import base64
import difflib
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile

from langsmith import traceable

import config

IGNORE_DIRS = {".git", "node_modules", ".next", "dist", "build", "coverage",
               "__pycache__", ".venv", "venv", "vendor"}
TEXT_SUFFIXES = {".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".md",
                 ".txt", ".toml", ".yaml", ".yml", ".html", ".css", ".scss", ".sql",
                 ".go", ".rs", ".java", ".c", ".h", ".cpp", ".rb", ".php", ".vue", ".svelte"}
IGNORE_NAMES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "uv.lock", "poetry.lock"}
RESERVED = {"con", "prn", "aux", "nul"} | {f"{prefix}{n}" for prefix in ("com", "lpt") for n in range(1, 10)}


def check_path(path):
    if not isinstance(path, str) or not path or len(path) > 240 or path.startswith("/") or "\\" in path or ":" in path or any(ord(c) < 32 for c in path):
        raise ValueError("Unsafe repository file path.")
    for part in path.split("/"):
        if part in ("", ".", "..") or part in IGNORE_DIRS or part.startswith(".") and part != ".gitignore":
            raise ValueError(f"Hidden, ignored or traversal path is not allowed: {path}")
        if part.endswith((".", " ")) or part.split(".")[0].lower() in RESERVED:
            raise ValueError("File path is not portable to Windows.")
    if path.lower().endswith((".pem", ".key", ".p12", ".pfx")):
        raise ValueError("Secret files are not allowed.")


def safe_path(workspace, path):
    check_path(path)
    original = Path(workspace)
    if original.is_symlink() or getattr(original, "is_junction", lambda: False)():
        raise ValueError("The workspace root cannot be a symbolic link or junction.")
    root = original.resolve()
    target = root / path
    if not target.resolve().is_relative_to(root):
        raise ValueError("File path leaves the cloned workspace.")
    current = root
    for part in path.split("/"):
        current = current / part
        if current.is_symlink() or getattr(current, "is_junction", lambda: False)():
            raise ValueError("Symbolic links and junctions are not supported.")
    return target


def process_environment():
    # Do not inherit backend API secrets, Git helpers or Node/Python startup hooks.
    env = {key: value for key, value in os.environ.items() if key.upper() in
           {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"}}
    env.update(GIT_TERMINAL_PROMPT="0", GIT_CONFIG_NOSYSTEM="1",
               GIT_CONFIG_GLOBAL=os.devnull, GIT_LFS_SKIP_SMUDGE="1",
               PYTEST_DISABLE_PLUGIN_AUTOLOAD="1", CI="true")
    return env


def run_command(command, directory, timeout=60, environment=None, output_limit=12000):
    label = " ".join([Path(command[0]).stem] + command[1:])
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        process = subprocess.Popen(command, cwd=directory, env=environment or process_environment(),
                                   stdout=stdout, stderr=stderr, start_new_session=os.name != "nt")
        timed_out = False
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        stdout.seek(0)
        stderr.seek(0)
        out = stdout.read(output_limit + 1).decode("utf-8", errors="replace")
        err = stderr.read(output_limit + 1).decode("utf-8", errors="replace")
    return {"name": label, "status": "failed" if timed_out or process.returncode else "passed",
            "exit_code": process.returncode, "stdout": config.redact(out[:output_limit]),
            "stderr": config.redact(f"Timed out after {timeout} seconds.\n" + err if timed_out else err[:output_limit]),
            "truncated": len(out) > output_limit or len(err) > output_limit}


def git(workspace, *args, authenticated=False):
    env = process_environment()
    if authenticated and config.GITHUB_TOKEN:
        encoded = base64.b64encode(f"x-access-token:{config.GITHUB_TOKEN}".encode()).decode()
        env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="http.https://github.com/.extraheader",
                   GIT_CONFIG_VALUE_0=f"Authorization: Basic {encoded}")
    command = ["git", "-c", "core.hooksPath=" + os.devnull, "-c", "core.autocrlf=false",
               "-c", "credential.helper=", "-c", "protocol.file.allow=never", *args]
    result = run_command(command, workspace, timeout=120, environment=env, output_limit=2000000)
    if result["status"] == "failed":
        error = result["stderr"].replace(encoded, "[redacted]") if authenticated and config.GITHUB_TOKEN else result["stderr"]
        raise ValueError(f"Git {args[0]} failed: {error[:2000]}")
    if result["truncated"]:
        raise ValueError("Repository metadata exceeds the learning version's limit.")
    return result["stdout"].strip()


def workspace_for(run_id):
    if not re.fullmatch(r"[a-f0-9]{32}", run_id):
        raise ValueError("Invalid workspace identifier.")
    return config.WORKSPACE_ROOT / run_id


@traceable(run_type="tool")
def clone_repository(repo_url, run_id, default_branch):
    root = workspace_for(run_id)
    root.parent.mkdir(parents=True, exist_ok=True)
    if root.exists():
        raise ValueError("Run workspace already exists.")
    git(root.parent, "clone", "--depth", "1", "--no-checkout", "--no-recurse-submodules",
        "--branch", default_branch, "--", repo_url, str(root), authenticated=True)
    # Checkout does not run repository code; hooks/helpers and global filters are disabled.
    git(root, "-c", "core.symlinks=false", "checkout", "--detach", "HEAD")
    return {"workspace_path": str(root), "base_sha": git(root, "rev-parse", "HEAD")}


def list_files(workspace):
    root = Path(workspace)
    indexed = {}
    for row in git(root, "ls-files", "--stage", "-z").split("\0"):
        if row:
            metadata, path = row.split("\t", 1)
            indexed[path] = metadata.split()[0]
    files = {}
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = [name for name in dirs if name not in IGNORE_DIRS and not name.startswith(".")
                   and not (Path(directory) / name).is_symlink()
                   and not getattr(Path(directory) / name, "is_junction", lambda: False)()]
        for name in names:
            path = (Path(directory) / name).relative_to(root).as_posix()
            if indexed.get(path) not in ("100644", "100755") or name in IGNORE_NAMES:
                continue
            if Path(name).suffix.lower() not in TEXT_SUFFIXES and name not in ("Dockerfile", "Makefile", "LICENSE", ".gitignore"):
                continue
            try:
                target = safe_path(root, path)
            except ValueError:
                continue
            if target.stat().st_size <= config.MAX_FILE_BYTES:
                files[path] = {"size": target.stat().st_size}
            if len(files) > 5000:
                raise ValueError("This learning version supports at most 5,000 source files.")
    return files


def read_file(workspace, path):
    target = safe_path(workspace, path)
    if not target.is_file() or target.stat().st_size > config.MAX_FILE_BYTES:
        raise ValueError(f"Selected file is missing or too large: {path}")
    try:
        content = target.read_bytes().decode("utf-8")
    except UnicodeError as error:
        raise ValueError(f"Selected file is not UTF-8 text: {path}") from error
    if "\x00" in content:
        raise ValueError(f"Selected file is binary: {path}")
    return content


@traceable(run_type="tool")
def apply_changes(state):
    root = state["workspace_path"]
    # Check every path before writing the first file.
    for patch in state["patches"]:
        target = safe_path(root, patch["path"])
        if target.exists() and patch["path"] not in state["file_contents"]:
            raise ValueError(f"Cannot overwrite an unread file: {patch['path']}")
        if target.exists() and read_file(root, patch["path"]) != state["file_contents"][patch["path"]]:
            raise ValueError("A source file changed after it was read.")
    for patch in state["patches"]:
        target = safe_path(root, patch["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(patch["content"].encode("utf-8"))


def make_diffs(state):
    modified = set(git(state["workspace_path"], "diff", "--name-only", "-z", "HEAD").split("\0")) - {""}
    if not modified.issubset({patch["path"] for patch in state["patches"]}):
        raise ValueError("Repository checks changed files outside the proposed patch. Start a new run.")
    results = []
    for patch in state["patches"]:
        path = patch["path"]
        actual = read_file(state["workspace_path"], path)
        if actual != patch["content"]:
            raise ValueError(f"Validation changed the proposed file {path}. Start a new run.")
        lines = difflib.unified_diff(state["file_contents"].get(path, "").splitlines(keepends=True),
                                    actual.splitlines(keepends=True),
                                    fromfile=f"a/{path}" if path in state["file_contents"] else "/dev/null",
                                    tofile=f"b/{path}")
        diff = "".join(line if line.endswith("\n") else line + "\n\\ No newline at end of file\n" for line in lines)
        results.append({"path": path, "diff": diff})
    return results


def require_approval(state):
    if state.get("approved") is not True or state["validation_result"]["status"] == "failed":
        raise ValueError("Approval and non-failing validation are required before Git writes.")
    if not state["branch_name"].startswith("codex/issue-") or state["branch_name"] == state["default_branch"]:
        raise ValueError("Refusing to write to the default branch.")
    if git(state["workspace_path"], "remote", "get-url", "origin") != state["repo_url"]:
        raise ValueError("The workspace Git remote changed unexpectedly.")


@traceable(run_type="tool")
def create_branch(state):
    require_approval(state)
    if git(state["workspace_path"], "rev-parse", "HEAD") != state["base_sha"]:
        raise ValueError("The workspace HEAD changed unexpectedly.")
    make_diffs(state)
    git(state["workspace_path"], "switch", "-c", state["branch_name"])


@traceable(run_type="tool")
def commit_changes(state):
    require_approval(state)
    make_diffs(state)
    git(state["workspace_path"], "add", "--", *[patch["path"] for patch in state["patches"]])
    staged = set(git(state["workspace_path"], "diff", "--cached", "--name-only", "-z").split("\0")) - {""}
    if staged != {patch["path"] for patch in state["patches"]}:
        raise ValueError("Staged files differ from the approved files. Nothing was committed.")
    git(state["workspace_path"], "-c", f"user.name={config.GIT_AUTHOR_NAME}", "-c",
        f"user.email={config.GIT_AUTHOR_EMAIL}", "-c", "commit.gpgsign=false",
        "commit", "-m", f"Fix issue #{state['issue_number']}")
    return git(state["workspace_path"], "rev-parse", "HEAD")


@traceable(run_type="tool")
def push_branch(state):
    require_approval(state)
    if git(state["workspace_path"], "branch", "--show-current") != state["branch_name"]:
        raise ValueError("Refusing to push an unexpected branch.")
    git(state["workspace_path"], "push", "origin",
        f"HEAD:refs/heads/{state['branch_name']}", authenticated=True)


def cleanup_workspace(run_id):
    target = workspace_for(run_id)
    root = config.WORKSPACE_ROOT.resolve()
    if target.is_symlink() or target.resolve().parent != root:
        raise ValueError("Refusing to remove a workspace outside the managed directory.")
    if target.exists():
        def writable_then_retry(function, path, error):
            os.chmod(path, 0o700)
            function(path)
        shutil.rmtree(target, onerror=writable_then_retry)
