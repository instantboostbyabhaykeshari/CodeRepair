"""Validate the actual changed clone with backend-chosen commands only."""

import ast
import json
import os
from pathlib import Path
import shutil
import sys
import tomllib

from langsmith import traceable

import workspace_service as workspace


def check(name, status, output, exit_code=None):
    return {"name": name, "status": status, "stdout": output, "stderr": "", "exit_code": exit_code}


@traceable(run_type="tool")
def run_validation(state, notify=None):
    root = Path(state["workspace_path"])
    checks = []
    package_file = root / "package.json"
    package = json.loads(package_file.read_text(encoding="utf-8")) if package_file.is_file() else {}
    uses_jsx = bool(set(package.get("dependencies", {})) & {"react", "next", "vue"})
    for patch in state["patches"]:
        path = patch["path"]
        content = workspace.read_file(root, path)
        suffix = Path(path).suffix.lower()
        try:
            if suffix == ".py":
                ast.parse(content, filename=path)
            elif suffix == ".json":
                json.loads(content)
            elif suffix == ".toml":
                tomllib.loads(content)
            elif suffix in (".js", ".mjs", ".cjs") and not uses_jsx and shutil.which("node"):
                result = workspace.run_command([shutil.which("node"), "--check", path], root)
                checks.append(result)
                continue
            else:
                checks.append(check(f"Syntax: {path}", "skipped", "Use the repository's configured checks for this file type."))
                continue
            checks.append(check(f"Syntax: {path}", "passed", "Parsed successfully; behavior still needs tests.", 0))
        except (SyntaxError, ValueError) as error:
            checks.append(check(f"Syntax: {path}", "failed", str(error), 1))

    if not state["run_tests"]:
        checks.append(check("Repository checks", "skipped",
                            "Not executed. Enable the trusted-code option when starting a run to install dependencies and run project checks."))
    elif any(item["status"] == "failed" for item in checks):
        checks.append(check("Repository checks", "skipped", "Fix syntax errors before executing repository code."))
    else:
        try:
            checks.extend(repository_checks(root, notify))
        except (ValueError, OSError) as error:
            checks.append(check("Repository checks", "failed", str(error), 1))
    status = "failed" if any(item["status"] == "failed" for item in checks) else "partial" if any(item["status"] == "skipped" for item in checks) else "passed"
    return {"status": status, "checks": checks}


def repository_checks(root, notify):
    results = []

    def execute(command, timeout=60):
        if notify:
            notify("Running " + " ".join([Path(command[0]).stem] + command[1:]))
        result = workspace.run_command(command, root, timeout=timeout)
        results.append(result)
        return result["status"] == "passed"

    # Script names are read from package.json, but only these three names can run.
    if (root / "package.json").is_file():
        package = json.loads((root / "package.json").read_text(encoding="utf-8"))
        scripts = package.get("scripts", {})
        names = [name for name in ("test", "lint", "build") if name in scripts]
        if not names:
            return [check("Repository checks", "skipped", "No test, lint or build script is defined.")]
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise ValueError("npm is not installed.")
        install = ["ci"] if (root / "package-lock.json").is_file() else ["install", "--package-lock=false"]
        if not execute([npm, *install, "--ignore-scripts", "--no-audit", "--no-fund"], timeout=180):
            return results
        for name in names:
            execute([npm, "run", name])
    else:
        tests = [path for path in workspace.list_files(root) if path.endswith(".py") and (Path(path).name.startswith("test_") or Path(path).name.endswith("_test.py"))]
        if not tests:
            return [check("Repository tests", "skipped", "No supported pytest tests found.")]
        # Dependencies go into a run-specific environment, not the backend's environment.
        env_dir = root / ".agent-venv"
        if not execute([sys.executable, "-m", "venv", str(env_dir)], timeout=120):
            return results
        python = str(env_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python"))
        if not execute([python, "-m", "pip", "install", "pytest"], timeout=180):
            return results
        if (root / "requirements.txt").is_file():
            if not execute([python, "-m", "pip", "install", "-r", "requirements.txt"], timeout=180):
                return results
        elif (root / "pyproject.toml").is_file():
            project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
            if "build-system" in project or "project" in project:
                if not execute([python, "-m", "pip", "install", "."], timeout=180):
                    return results
        execute([python, "-m", "pytest", "-q"])
    return results
