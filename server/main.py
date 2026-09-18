"""FastAPI routes, in-memory run tracking and replayable SSE events."""

import asyncio
import json
import os
import threading
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

import config
import github_service
import workspace_service
from agent.graph import build_graph

app = FastAPI(title="GitHub Issue Solver", version="1.0.0")

# Updated CORS middleware to allow wildcards or explicit origins dynamically
allowed_origins = [config.FRONTEND_URL] if getattr(config, "FRONTEND_URL", None) else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Updated Trusted Host Middleware to support wildcard host headers on deployment platforms
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "testserver", "*.onrender.com", "*"]
)

graph = build_graph()
runs = {}
lock = threading.Lock()
TERMINAL = {"completed", "cancelled", "failed"}
PUBLIC_FIELDS = {
    "repo_url", "issue_number", "issue_title", "issue_body", "run_tests", 
    "plan", "diffs", "validation_result", "additional_files", "branch_name", 
    "commit_sha", "pr_number", "pr_title", "pr_url"
}


class StartRequest(BaseModel):
    repo_url: str = Field(max_length=300)
    issue: str = Field(max_length=350)
    run_tests: bool = False


class ApprovalRequest(BaseModel):
    approve: bool
    acknowledge_skipped_checks: bool = False


@app.middleware("http")
async def check_origin(request: Request, call_next):
    # Allow pre-flight OPTIONS requests and check origin only if explicit FRONTEND_URL configured
    if request.method == "POST" and getattr(config, "FRONTEND_URL", None):
        origin = request.headers.get("origin")
        if origin and origin != config.FRONTEND_URL:
            return JSONResponse({"detail": "This origin is not allowed."}, status_code=403)
    return await call_next(request)


def snapshot(run):
    state = run["state"]
    result = {key: value for key, value in state.items() if key in PUBLIC_FIELDS}
    paths = list(state.get("repo_files", {}))
    result.update(
        run_id=run["id"], 
        status=run["status"], 
        error=run.get("error", ""),
        selected_files=list(state.get("file_contents", {})),
        repository_summary={
            "file_count": len(paths), 
            "paths": paths[:100],
            "base_sha": state.get("base_sha", "")
        },
        current_step=run.get("current_step", ""), 
        last_event_id=len(run["events"])
    )
    return result


def emit(run, **event):
    with lock:
        if "run_status" in event:
            run["status"] = event.pop("run_status")
        event.update(id=len(run["events"]) + 1, state=snapshot(run))
        run["events"].append(event)


def safe_error(error):
    module = type(error).__module__
    if "google" in module or "langchain" in module:
        return "Gemini request failed or was rate limited. Check your API key, model access and quota."
    text = str(error) if isinstance(error, (ValueError, OSError)) else f"Run failed ({type(error).__name__}). Check backend configuration."
    return config.redact(text)[:2000]


def finish(run, status, message):
    try:
        workspace_service.cleanup_workspace(run["id"])
    except (ValueError, OSError):
        message += " The workspace could not be removed; stop the server before cleaning server/.workspaces."
    emit(run, run_status=status, node=run.get("current_step", ""), status=status, message=message)


def fail(run, error):
    with lock:
        run["error"] = safe_error(error)
    finish(run, "failed", run["error"])


def execute_analysis(run):
    try:
        settings = {
            "recursion_limit": 35, 
            "run_name": "Analyze GitHub issue", 
            "tags": ["issue-solver"],
            "metadata": {"run_id": run["id"], "repo": run["state"]["repo"]}
        }
        for kind, event in graph.stream(dict(run["state"]), settings, stream_mode=["custom", "updates"]):
            if kind == "custom":
                with lock:
                    run["current_step"] = event["node"]
                emit(run, **event)
            else:
                for node, update in event.items():
                    with lock:
                        run["state"].update(update or {})
                    if node == "inspect_repository":
                        message = f"Found {len(run['state']['repo_files'])} source files"
                    elif node == "read_files":
                        message = f"Read {len(run['state']['file_contents'])} files"
                    elif node == "check_context" and not run["state"]["enough_context"]:
                        message = "Additional context requested: " + ", ".join(run["state"]["selected_files"])
                    else:
                        message = node.replace("_", " ").capitalize() + " finished"
                    emit(run, node=node, status="done", message=message)
        emit(
            run, 
            run_status="awaiting_approval", 
            node="approval", 
            status="waiting",
            message="Analysis finished. Review the diff and validation before approving."
        )
    except Exception as error:
        fail(run, error)


def publish(run):
    try:
        state = run["state"]
        with lock:
            state["branch_name"] = f"codex/issue-{state['issue_number']}-{run['id'][:8]}"
        steps = ["create_branch", "commit_changes", "push_branch", "create_pull_request"]
        for step in steps:
            with lock:
                run["current_step"] = step
            emit(run, node=step, status="running", message=step.replace("_", " ").capitalize(), tool=step)
            if step == "create_branch":
                github_service.check_publish_access(state)
                workspace_service.create_branch(state)
            elif step == "commit_changes":
                result = workspace_service.commit_changes(state)
                with lock:
                    state["commit_sha"] = result
            elif step == "push_branch":
                github_service.check_publish_access(state)
                workspace_service.push_branch(state)
            else:
                result = github_service.create_pull_request(state)
                with lock:
                    state.update(result)
            emit(run, node=step, status="done", message=step.replace("_", " ").capitalize() + " finished")
        finish(run, "completed", "Draft pull request created.")
    except Exception as error:
        fail(run, error)


@app.get("/api/health")
def health():
    return {
        "status": "ok", 
        "gemini_ready": bool(getattr(config, "GOOGLE_API_KEY", None)),
        "github_ready": bool(getattr(config, "GITHUB_TOKEN", None)), 
        "model": getattr(config, "GEMINI_MODEL", "gemini-1.5-flash")
    }


@app.post("/api/runs", status_code=202)
def start_run(body: StartRequest):
    try:
        repo = github_service.parse_repository(body.repo_url)
        number = github_service.parse_issue(body.issue, repo)
        if not getattr(config, "GOOGLE_API_KEY", None) or not getattr(config, "GITHUB_TOKEN", None):
            raise ValueError("Configure GOOGLE_API_KEY and GITHUB_TOKEN in server/.env, then restart the backend.")
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    with lock:
        if len(runs) >= 20:
            raise HTTPException(409, "This learning server keeps at most 20 runs. Restart it to clear history.")
        if sum(run["status"] == "running" for run in runs.values()) >= 2:
            raise HTTPException(409, "Two runs are already working. Wait for one to finish.")
        run_id = uuid4().hex
        state = {
            "run_id": run_id, 
            "repo_url": f"https://github.com/{repo}", 
            "repo": repo,
            "issue_number": number, 
            "run_tests": body.run_tests, 
            "file_contents": {}, 
            "approved": False
        }
        run = {"id": run_id, "state": state, "status": "running", "events": []}
        runs[run_id] = run
    threading.Thread(target=execute_analysis, args=(run,), daemon=True).start()
    return {"run_id": run_id}


def find_run(run_id):
    if run_id not in runs:
        raise HTTPException(404, "Run not found. In-memory runs disappear when the backend restarts.")
    return runs[run_id]


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    with lock:
        return snapshot(find_run(run_id))


@app.post("/api/runs/{run_id}/approval", status_code=202)
def approve_run(run_id: str, body: ApprovalRequest):
    with lock:
        run = find_run(run_id)
        if run["status"] != "awaiting_approval":
            raise HTTPException(409, "This run is not waiting for approval.")
        status = run["state"]["validation_result"]["status"]
        if body.approve and status == "failed":
            raise HTTPException(409, "Validation failed. Cancel and start a new run.")
        if body.approve and status == "partial" and not body.acknowledge_skipped_checks:
            raise HTTPException(409, "Acknowledge skipped checks before approving.")
        run["state"]["approved"] = body.approve
        run["status"] = "running"
    if body.approve:
        threading.Thread(target=publish, args=(run,), daemon=True).start()
    else:
        finish(run, "cancelled", "Cancelled. No branch was pushed and the local workspace was removed.")
    return {"run_id": run_id, "status": run["status"]}


@app.get("/api/runs/{run_id}/events")
async def events(run_id: str, request: Request):
    run = find_run(run_id)
    try:
        cursor = max(0, int(request.headers.get("last-event-id", "0")))
    except ValueError:
        cursor = 0

    async def stream():
        nonlocal cursor
        idle = 0
        while not await request.is_disconnected():
            with lock:
                pending = list(run["events"][cursor:])
                finished = run["status"] in TERMINAL
            for event in pending:
                cursor = event["id"]
                yield f"id: {cursor}\ndata: {json.dumps(event)}\n\n"
            if finished and cursor >= len(run["events"]):
                break
            idle += 1
            if idle % 40 == 0:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.25)
            
    return StreamingResponse(
        stream(), 
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)