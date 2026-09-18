from typing import TypedDict


class AgentState(TypedDict, total=False):
    """Shared information. Each node returns only the fields it changes."""

    run_id: str
    repo_url: str
    repo: str
    issue_number: int
    run_tests: bool
    issue_title: str
    issue_body: str
    default_branch: str
    base_sha: str
    workspace_path: str
    repo_files: dict
    selected_files: list[str]
    additional_files: list[str]
    file_contents: dict
    context_rounds: int
    enough_context: bool
    plan: list[str]
    patches: list[dict]
    diffs: list[dict]
    validation_result: dict
    approved: bool
    branch_name: str
    commit_sha: str
    pr_number: int
    pr_title: str
    pr_url: str
