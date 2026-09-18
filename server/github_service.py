"""GitHub REST operations for issues, repository metadata and draft PRs."""

import re
from urllib.parse import quote, urlparse
import httpx
from langsmith import traceable

import config


def parse_repository(url):
    parsed = urlparse(url.strip())
    match = re.fullmatch(r"/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?", parsed.path)
    if parsed.scheme != "https" or parsed.netloc != "github.com" or not match or parsed.query or parsed.fragment:
        raise ValueError("Use a repository URL like https://github.com/owner/repository.")
    owner, name = match.groups()
    if owner in (".", "..") or name in (".", ".."):
        raise ValueError("Invalid repository name.")
    return f"{owner}/{name}"


def parse_issue(value, repo):
    value = str(value).strip()
    if value.isdigit() and int(value) > 0:
        return int(value)
    parsed = urlparse(value)
    match = re.fullmatch(r"/([^/]+/[^/]+)/issues/([1-9][0-9]*)/?", parsed.path)
    if parsed.scheme == "https" and parsed.netloc == "github.com" and match and match[1].lower() == repo.lower() and not parsed.query:
        return int(match[2])
    raise ValueError("Enter a positive issue number or an issue URL from this repository.")


def request(method, path, **kwargs):
    if not config.GITHUB_TOKEN:
        raise ValueError("GITHUB_TOKEN is missing. Add it to server/.env.")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "Authorization": f"Bearer {config.GITHUB_TOKEN}"}
    try:
        response = httpx.request(method, f"https://api.github.com{path}", headers=headers, timeout=30, **kwargs)
    except httpx.RequestError as error:
        raise ValueError("GitHub could not be reached. Check your connection.") from error
    if response.status_code >= 400:
        if response.status_code == 429 or response.headers.get("x-ratelimit-remaining") == "0":
            raise ValueError("GitHub rate limit reached. Wait for the limit to reset.")
        messages = {401: "GitHub token is invalid.", 403: "GitHub permission denied; check token access.",
                    404: "GitHub repository or issue not found (or your token has no access).",
                    422: "GitHub rejected the PR. Check whether the branch or PR already exists."}
        raise ValueError(messages.get(response.status_code, f"GitHub API error ({response.status_code})."))
    return response.json()


@traceable(run_type="tool")
def get_issue(repo, number):
    issue = request("GET", f"/repos/{repo}/issues/{number}")
    if "pull_request" in issue:
        raise ValueError("This number refers to a pull request. Enter an issue number.")
    if len(issue.get("body") or "") > 20000:
        raise ValueError("Issue exceeds the learning version's 20,000 character limit.")
    return {"title": issue["title"], "body": issue.get("body") or ""}


@traceable(run_type="tool")
def get_repository(repo):
    return request("GET", f"/repos/{repo}")


def check_publish_access(state):
    metadata = get_repository(state["repo"])
    if not metadata.get("permissions", {}).get("push"):
        raise ValueError("Your GitHub token cannot push to this repository. Use a repository with write access; automatic forks are not supported.")
    latest = request("GET", f"/repos/{state['repo']}/commits/{quote(state['default_branch'], safe='')}")
    if latest["sha"] != state["base_sha"]:
        raise ValueError("The base branch changed after analysis. Start a new run to review a fresh diff.")


@traceable(run_type="tool")
def create_pull_request(state):
    if state.get("approved") is not True or state["validation_result"]["status"] == "failed":
        raise ValueError("PR creation requires approval and non-failing validation.")
    checks = "\n".join(f"- {item['name']}: {item['status']} (exit {item['exit_code']})"
                        for item in state["validation_result"]["checks"])
    result = request("POST", f"/repos/{state['repo']}/pulls", json={
        "title": f"Fix #{state['issue_number']}: {state['issue_title']}"[:240],
        "head": state["branch_name"], "base": state["default_branch"], "draft": True,
        "body": f"Closes #{state['issue_number']}\n\n## Plan\n" + "\n".join(f"- {step}" for step in state["plan"])
                + f"\n\n## Validation\n{checks}\n\nThese changes were explicitly approved in CodeRepair.",
    })
    return {"pr_number": result["number"], "pr_title": result["title"], "pr_url": result["html_url"]}
