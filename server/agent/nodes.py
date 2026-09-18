"""Workflow nodes: each reads shared state and returns a small update."""

from langgraph.config import get_stream_writer
from pathlib import Path

import config
import github_service
import workspace_service
from agent import llm
from agent.tools import make_read_tool
from agent.validation import run_validation


def report(node, message, tool=""):
    get_stream_writer()({"node": node, "status": "running", "message": message, "tool": tool})


def fetch_issue(state):
    report("fetch_issue", "Reading the GitHub issue", "get_issue")
    issue = github_service.get_issue(state["repo"], state["issue_number"])
    return {"issue_title": issue["title"], "issue_body": issue["body"]}


def clone_repository(state):
    report("clone_repository", "Cloning a real repository workspace", "clone_repository")
    metadata = github_service.get_repository(state["repo"])
    cloned = workspace_service.clone_repository(state["repo_url"], state["run_id"], metadata["default_branch"])
    return {**cloned, "default_branch": metadata["default_branch"]}


def inspect_repository(state):
    report("inspect_repository", "Inspecting source files in the cloned workspace", "list_files")
    files = workspace_service.list_files(state["workspace_path"])
    if not files:
        raise ValueError("No supported source files were found in the repository.")
    return {"repo_files": files}


def check_selection(paths, state):
    if not isinstance(paths, list) or not 1 <= len(paths) <= 6:
        raise ValueError("The agent must select between 1 and 6 files per round.")
    for path in paths:
        if not isinstance(path, str) or path not in state["repo_files"]:
            raise ValueError(f"Agent selected an unavailable or ignored file: {path}")
    return list(dict.fromkeys(paths))


def select_relevant_files(state):
    report("select_relevant_files", "Asking Gemini to choose relevant files", "Gemini → read_file")
    return {"selected_files": check_selection(llm.choose_files(state), state),
            "context_rounds": 0, "additional_files": []}


def read_files(state):
    report("read_files", "Reading selected files from the clone", "read_file")
    contents = dict(state.get("file_contents", {}))
    read_tool = make_read_tool(state["workspace_path"])
    for path in state["selected_files"]:
        if path not in contents:
            contents[path] = read_tool.invoke({"path": path})
        if len(contents) > config.MAX_FILES or sum(len(text) for text in contents.values()) > config.MAX_CONTEXT_CHARS:
            raise ValueError("Context exceeds the 12 file / 120,000 character learning limit.")
    return {"file_contents": contents}


def check_context(state):
    report("check_context", "Asking Gemini whether enough context is available")
    decision = llm.structured(
        "Is there enough context to implement a small fix? If not, request 1 to 6 unread paths. Do not guess.",
        {"issue": state["issue_body"], "files": state["file_contents"], "available_paths": list(state["repo_files"])},
        {"enough": {"type": "boolean"}, "more_files": llm.STRING_LIST})
    if decision["enough"]:
        return {"enough_context": True}
    if state["context_rounds"] >= 2:
        raise ValueError("Context is still insufficient after two extra reads. Try a smaller issue.")
    paths = check_selection(decision["more_files"], state)
    new_paths = [path for path in paths if path not in state["file_contents"]]
    if not new_paths:
        raise ValueError("The agent requested more context without selecting a new file.")
    return {"enough_context": False, "selected_files": new_paths,
            "additional_files": state["additional_files"] + new_paths,
            "context_rounds": state["context_rounds"] + 1}


def plan_solution(state):
    report("plan_solution", "Creating a concrete implementation plan")
    plan = llm.structured("Return a short implementation plan.",
                          {"issue": state["issue_body"], "files": state["file_contents"]},
                          {"plan": llm.STRING_LIST})["plan"]
    if not plan or len(plan) > 12:
        raise ValueError("Gemini returned an empty or excessively long plan.")
    return {"plan": plan}


def generate_patch(state):
    report("generate_patch", "Generating structured file changes")
    result = llm.structured(
        "Return 1 to 6 changed files with COMPLETE updated UTF-8 contents. No markdown fences, placeholders, deletions or renames. "
        "Only modify files already read. You may create a new source/test file if needed. Preserve unrelated code.",
        {"issue": state["issue_body"], "plan": state["plan"], "files": state["file_contents"]},
        {"patches": {"type": "array", "items": {"type": "object", "properties": {
            "path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}})
    patches = result["patches"]
    if not 1 <= len(patches) <= 6:
        raise ValueError("Expected between 1 and 6 changed files.")
    seen, changed = set(), []
    for patch in patches:
        path, content = patch["path"], patch["content"]
        workspace_service.safe_path(state["workspace_path"], path)
        if path not in state["repo_files"] and Path(path).suffix.lower() not in workspace_service.TEXT_SUFFIXES:
            raise ValueError("New files must be supported source or text files.")
        if path.lower() in seen or not isinstance(content, str) or len(content.encode("utf-8")) > config.MAX_FILE_BYTES or "\x00" in content:
            raise ValueError("Patch contains duplicate paths, binary data or an oversized file.")
        seen.add(path.lower())
        if path in state["repo_files"] and path not in state["file_contents"]:
            raise ValueError(f"Cannot modify an unread file: {path}")
        if any(name.lower() == path.lower() and name != path for name in state["repo_files"]):
            raise ValueError("Case-only file renames are not supported.")
        if state["file_contents"].get(path) != content:
            changed.append(patch)
    if not changed:
        raise ValueError("The agent produced no changes.")
    return {"patches": changed}


def apply_patch(state):
    report("apply_patch", "Applying proposed files inside the cloned workspace", "apply_changes")
    workspace_service.apply_changes(state)
    return {}


def validate_changes(state):
    report("validate_changes", "Validating the changed workspace", "run_validation")
    result = run_validation(state, lambda message: report("validate_changes", message, "run_validation"))
    return {"validation_result": result}


def prepare_result(state):
    report("prepare_result", "Preparing per-file diffs and validation results")
    return {"diffs": workspace_service.make_diffs(state)}
