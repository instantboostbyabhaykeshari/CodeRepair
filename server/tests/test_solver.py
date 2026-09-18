"""Use real local Git repositories; replace only external GitHub/Gemini calls."""

import os
from pathlib import Path
import subprocess
import time

os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"

import httpx
import pytest
from fastapi.testclient import TestClient

import config
import github_service
import main
import workspace_service as workspace
from agent import llm, nodes
from agent.tools import make_read_tool
from agent.validation import run_validation

ORIGINAL = 'def destination(token):\n    return "dashboard"\n'
FIX = 'def destination(token):\n    if not token or token.get("expired"):\n        return "login"\n    return "dashboard"\n'
TEST = 'from auth import destination\n\ndef test_expired():\n    assert destination({"expired": True}) == "login"\n'
URL = "https://github.com/example/project"


def local_git(directory, *args):
    result = subprocess.run(["git", "-c", "core.hooksPath=" + os.devnull, "-c", "core.autocrlf=false",
                             "-c", "user.name=Test", "-c", "user.email=test@example.com",
                             "-c", "commit.gpgsign=false", *args], cwd=directory, capture_output=True, text=True,
                            env=workspace.process_environment(), timeout=30)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


@pytest.fixture
def project(tmp_path, monkeypatch):
    main.runs.clear()
    monkeypatch.setattr(config, "WORKSPACE_ROOT", tmp_path / "workspaces")
    monkeypatch.setattr(config, "GOOGLE_API_KEY", "test-google-key")
    monkeypatch.setattr(config, "GITHUB_TOKEN", "test-github-token")
    source = tmp_path / "source"
    source.mkdir()
    local_git(source, "init", "-b", "main")
    (source / "auth.py").write_text(ORIGINAL)
    (source / "tests").mkdir()
    (source / "tests/test_auth.py").write_text(TEST)
    (source / ".env").write_text("DO_NOT_READ=secret")
    (source / "dist").mkdir()
    (source / "dist/generated.js").write_text("generated")
    local_git(source, "add", ".")
    local_git(source, "commit", "-m", "Initial fixture")
    sha = local_git(source, "rev-parse", "HEAD")
    remote = tmp_path / "remote.git"
    local_git(tmp_path, "clone", "--bare", str(source), str(remote))
    writes = []
    original_git = workspace.git

    def git(directory, *args, authenticated=False):
        if args[0] == "clone":
            assert args[-2] == URL and authenticated
            local_git(tmp_path, "clone", "--no-hardlinks", str(remote), args[-1])
            local_git(Path(args[-1]), "remote", "set-url", "origin", URL)
            return ""
        if args[0] == "push":
            assert authenticated and args[1] == "origin"
            assert args[2].startswith("HEAD:refs/heads/codex/issue-25-")
            writes.append("push")
            return local_git(directory, "push", str(remote), args[2])
        return original_git(directory, *args, authenticated=authenticated)
    monkeypatch.setattr(workspace, "git", git)

    def api(method, path, **kwargs):
        if method != "GET":
            writes.append(path)
        if path.endswith("/issues/25"):
            return {"title": "Expired token", "body": "Return expired tokens to login."}
        if path == "/repos/example/project":
            return {"default_branch": "main", "permissions": {"push": True}}
        if path.endswith("/commits/main"):
            return {"sha": sha}
        if path.endswith("/pulls"):
            body = kwargs["json"]
            assert body["draft"] and body["base"] == "main"
            assert local_git(remote, "rev-parse", body["head"]) != sha
            return {"number": 26, "title": body["title"], "html_url": URL + "/pull/26"}
        raise AssertionError(path)
    monkeypatch.setattr(github_service, "request", api)
    monkeypatch.setattr(llm, "choose_files", lambda state: ["auth.py"])

    def structured(task, data, properties):
        if "enough" in properties:
            return {"enough": "tests/test_auth.py" in data["files"], "more_files": ["tests/test_auth.py"]}
        if "plan" in properties:
            return {"plan": ["Handle expired tokens.", "Retain valid sessions."]}
        return {"patches": [{"path": "auth.py", "content": FIX}]}
    monkeypatch.setattr(llm, "structured", structured)
    return {"remote": remote, "sha": sha, "writes": writes}


@pytest.fixture
def client(project):
    with TestClient(main.app) as client:
        yield client
    for run_id in list(main.runs):
        workspace.cleanup_workspace(run_id)


def wait_for(client, run_id, expected):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        state = client.get(f"/api/runs/{run_id}").json()
        if state["status"] != "running":
            assert state["status"] == expected, state
            return state
        time.sleep(0.05)
    raise AssertionError("Run did not finish")


def start(client):
    response = client.post("/api/runs", json={"repo_url": URL, "issue": "25"})
    assert response.status_code == 202, response.text
    return response.json()["run_id"]


def test_real_clone_apply_commit_push_and_pr(client, project):
    run_id = start(client)
    paused = wait_for(client, run_id, "awaiting_approval")
    root = workspace.workspace_for(run_id)
    assert (root / "auth.py").read_text() == FIX
    assert local_git(root, "rev-parse", "HEAD") == project["sha"]
    assert project["writes"] == []
    assert paused["selected_files"] == ["auth.py", "tests/test_auth.py"]
    assert paused["additional_files"] == ["tests/test_auth.py"]
    assert ".env" not in paused["repository_summary"]["paths"]
    assert "dist/generated.js" not in paused["repository_summary"]["paths"]
    assert paused["diffs"][0]["path"] == "auth.py"
    assert "+    if not token" in paused["diffs"][0]["diff"]
    assert "workspace_path" not in paused
    assert client.post(f"/api/runs/{run_id}/approval", json={"approve": True}).status_code == 409
    response = client.post(f"/api/runs/{run_id}/approval", json={"approve": True, "acknowledge_skipped_checks": True})
    assert response.status_code == 202
    done = wait_for(client, run_id, "completed")
    assert done["pr_number"] == 26 and done["pr_url"].endswith("/pull/26")
    assert local_git(project["remote"], "show", done["branch_name"] + ":auth.py") == FIX.strip()
    assert local_git(project["remote"], "rev-parse", "main") == project["sha"]
    assert project["writes"] == ["push", "/repos/example/project/pulls"]
    assert not root.exists()
    assert client.post(f"/api/runs/{run_id}/approval", json={"approve": True}).status_code == 409
    stream = client.get(f"/api/runs/{run_id}/events").text
    assert '"status": "running"' in stream and '"status": "completed"' in stream
    assert "test-google-key" not in stream and "test-github-token" not in stream
    replay = client.get(f"/api/runs/{run_id}/events", headers={"Last-Event-ID": "1"}).text
    assert "id: 1\n" not in replay


def test_cancel_removes_clone_without_writes(client, project):
    run_id = start(client)
    wait_for(client, run_id, "awaiting_approval")
    assert workspace.workspace_for(run_id).exists()
    client.post(f"/api/runs/{run_id}/approval", json={"approve": False})
    wait_for(client, run_id, "cancelled")
    assert not workspace.workspace_for(run_id).exists()
    assert project["writes"] == []


def test_failed_validation_blocks_publish(client, project, monkeypatch):
    original = llm.structured
    monkeypatch.setattr(llm, "structured", lambda task, data, properties:
                        {"patches": [{"path": "auth.py", "content": "def broken(:\n"}]}
                        if "patches" in properties else original(task, data, properties))
    run_id = start(client)
    paused = wait_for(client, run_id, "awaiting_approval")
    assert paused["validation_result"]["status"] == "failed"
    assert client.post(f"/api/runs/{run_id}/approval", json={"approve": True}).status_code == 409
    assert project["writes"] == []
    client.post(f"/api/runs/{run_id}/approval", json={"approve": False})


@pytest.mark.parametrize("reason", ["stale", "permission", "push"])
def test_publish_failures_do_not_claim_success(client, project, monkeypatch, reason):
    run_id = start(client)
    wait_for(client, run_id, "awaiting_approval")
    if reason == "stale":
        original = github_service.request
        monkeypatch.setattr(github_service, "request", lambda method, path, **kwargs:
                            {"sha": "changed"} if path.endswith("/commits/main") else original(method, path, **kwargs))
    elif reason == "permission":
        monkeypatch.setattr(github_service, "get_repository", lambda repo: {"permissions": {"push": False}})
    else:
        def fail_push(state):
            raise ValueError("Git push failed: permission denied.")
        monkeypatch.setattr(workspace, "push_branch", fail_push)
    client.post(f"/api/runs/{run_id}/approval", json={"approve": True, "acknowledge_skipped_checks": True})
    failed = wait_for(client, run_id, "failed")
    assert not failed.get("pr_url")
    assert project["writes"] == []
    assert not workspace.workspace_for(run_id).exists()


@pytest.mark.parametrize("path", ["../secret", "/tmp/a", ".env", "a/../../b", ".github/workflows/a.yml",
                                 "a\\b", "C:/a", "key.pem", "a//b", "CON.py", "a./b", "dist/a.js", "coverage/a.py"])
def test_unsafe_paths(tmp_path, path):
    with pytest.raises(ValueError):
        workspace.safe_path(tmp_path, path)


def test_symlink_escape(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    root = tmp_path / "repo"
    root.mkdir()
    try:
        (root / "link").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("Windows account cannot create symlinks")
    with pytest.raises(ValueError):
        workspace.safe_path(root, "link/secret.txt")


def test_context_limit_and_unread_file(monkeypatch, tmp_path):
    monkeypatch.setattr(nodes, "report", lambda *args: None)
    monkeypatch.setattr(llm, "structured", lambda *args: {"enough": False, "more_files": ["a.py"]})
    with pytest.raises(ValueError, match="two extra reads"):
        nodes.check_context({"issue_body": "", "file_contents": {}, "repo_files": {"a.py": {}}, "context_rounds": 2})
    monkeypatch.setattr(llm, "structured", lambda *args: {"patches": [{"path": "a.py", "content": "a=1"}]})
    with pytest.raises(ValueError, match="unread"):
        nodes.generate_patch({"issue_body": "", "plan": [], "file_contents": {}, "repo_files": {"a.py": {}}, "workspace_path": str(tmp_path)})


def test_no_repository_execution_without_opt_in(tmp_path, monkeypatch):
    (tmp_path / "a.py").write_text("raise RuntimeError('must not run')\n")
    monkeypatch.setattr(workspace, "run_command", lambda *a, **k: pytest.fail("Must not execute Python"))
    result = run_validation({"workspace_path": str(tmp_path), "patches": [{"path": "a.py"}], "run_tests": False})
    assert result["status"] == "partial"
    assert result["checks"][0]["status"] == "passed"


def test_command_result_and_secret_environment(tmp_path, monkeypatch):
    import sys
    monkeypatch.setenv("GOOGLE_API_KEY", "secret")
    assert "GOOGLE_API_KEY" not in workspace.process_environment()
    result = workspace.run_command([sys.executable, "-c", "import sys; print('out'); print('err', file=sys.stderr); sys.exit(3)"], tmp_path)
    assert result["exit_code"] == 3
    assert result["stdout"].strip() == "out"
    assert result["stderr"].strip() == "err"


def test_github_rate_limit(monkeypatch):
    monkeypatch.setattr(config, "GITHUB_TOKEN", "test")
    monkeypatch.setattr(github_service.httpx, "request", lambda *a, **k: httpx.Response(403, headers={"x-ratelimit-remaining": "0"}))
    with pytest.raises(ValueError, match="rate limit"):
        github_service.get_issue("example/project", 25)


def test_input_origin_and_missing_credentials(client, monkeypatch):
    assert client.post("/api/runs", json={"repo_url": "https://evil.test/a/b", "issue": "25"}).status_code == 400
    assert client.post("/api/runs", json={"repo_url": URL, "issue": "https://github.com/other/repo/issues/25"}).status_code == 400
    assert client.post("/api/runs", headers={"Origin": "https://evil.test"}, json={"repo_url": URL, "issue": "25"}).status_code == 403
    monkeypatch.setattr(config, "GOOGLE_API_KEY", "")
    assert client.post("/api/runs", json={"repo_url": URL, "issue": "25"}).status_code == 400
    assert client.get("/api/runs/missing").status_code == 404


def test_model_tool_is_bound_to_workspace(tmp_path):
    (tmp_path / "a.py").write_text("a=1")
    tool = make_read_tool(str(tmp_path))
    assert set(tool.args) == {"path"}
    assert tool.invoke({"path": "a.py"}) == "a=1"
    with pytest.raises(ValueError):
        tool.invoke({"path": "../outside"})


def test_modified_review_cannot_be_committed(client, project):
    run_id = start(client)
    wait_for(client, run_id, "awaiting_approval")
    (workspace.workspace_for(run_id) / "auth.py").write_text("tampered=1")
    client.post(f"/api/runs/{run_id}/approval", json={"approve": True, "acknowledge_skipped_checks": True})
    state = wait_for(client, run_id, "failed")
    assert "changed the proposed file" in state["error"]
    assert project["writes"] == []


def test_cleanup_rejects_foreign_path():
    with pytest.raises(ValueError):
        workspace.cleanup_workspace("../outside")

def test_trusted_python_checks_execute_actual_pytest(client, monkeypatch):
    import sys
    run_id = start(client)
    wait_for(client, run_id, "awaiting_approval")
    state = dict(main.runs[run_id]["state"], run_tests=True)
    original = workspace.run_command
    commands = []
    def installed_environment(command, directory, **kwargs):
        commands.append(command)
        if command[0] == "git":
            return original(command, directory, **kwargs)
        if "pytest" in command and "pip" not in command:
            return original([sys.executable, "-m", "pytest", "-q"], directory)
        return {"name": "dependency setup fixture", "status": "passed", "exit_code": 0, "stdout": "", "stderr": ""}
    monkeypatch.setattr(workspace, "run_command", installed_environment)
    result = run_validation(state)
    assert result["status"] == "passed"
    assert "1 passed" in result["checks"][-1]["stdout"]
    assert any("venv" in command for command in commands)
    client.post(f"/api/runs/{run_id}/approval", json={"approve": False})


def test_javascript_checks_only_use_existing_allowed_scripts(tmp_path, monkeypatch):
    import json
    from agent.validation import repository_checks
    (tmp_path / "package.json").write_text(json.dumps({"scripts": {"test": "test command", "build": "build command", "deploy": "must not run"}}))
    monkeypatch.setattr("agent.validation.shutil.which", lambda name: name)
    commands = []
    def record(command, directory, **kwargs):
        commands.append(command)
        return {"name": " ".join(command), "status": "passed", "exit_code": 0, "stdout": "", "stderr": ""}
    monkeypatch.setattr(workspace, "run_command", record)
    repository_checks(tmp_path, None)
    assert "--ignore-scripts" in commands[0] and "--package-lock=false" in commands[0]
    assert [command[-1] for command in commands[1:]] == ["test", "build"]


def test_unapproved_git_operations_are_blocked():
    state = {"approved": False, "validation_result": {"status": "passed"}}
    for function in (workspace.create_branch, workspace.commit_changes, workspace.push_branch, github_service.create_pull_request):
        with pytest.raises(ValueError):
            function(state)


def test_secret_never_enters_git_command(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "GITHUB_TOKEN", "private-token")
    def capture(command, directory, **kwargs):
        assert "private-token" not in " ".join(command)
        assert kwargs["environment"]["GIT_CONFIG_KEY_0"] == "http.https://github.com/.extraheader"
        assert "GITHUB_TOKEN" not in kwargs["environment"]
        return {"status": "passed", "stdout": "ok", "stderr": "", "truncated": False}
    monkeypatch.setattr(workspace, "run_command", capture)
    assert workspace.git(tmp_path, "fetch", "origin", authenticated=True) == "ok"
