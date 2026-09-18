# CodeRepair — Agentic AI GitHub Issue Solver

A local learning application that reads a GitHub issue, clones its repository,
uses Gemini to select relevant source files, proposes and applies a fix in that
clone, validates it, and shows a review. Only explicit approval starts the
separate branch, commit, push and draft pull-request flow.

The application uses Next.js JavaScript, Tailwind CSS, FastAPI, LangGraph,
LangChain's Gemini integration and optional LangSmith tracing. There is no
production demo mode, database, authentication service or automatic merge.

## Architecture and agent workflow

```text
Next.js form → FastAPI → LangGraph
  START
    → fetch_issue → clone_repository → inspect_repository
    → select_relevant_files → read_files → check_context
                                  ↑            |
                                  └────────────┘ needs more context (at most twice)
                                               |
                                          enough context
                                               ↓
       plan_solution → generate_patch → apply_patch → validate_changes
                                               ↓
                                         prepare_result → END

FastAPI saves the completed result → browser displays review
  Cancel → remove local clone
  Approve → check access/base commit → create branch → commit approved files
          → recheck base commit → push branch → create draft PR → remove clone

Server-Sent Events carry progress and public state to the browser throughout.
```

Gemini chooses files through actual LangChain tool calls, assesses context,
writes a plan and proposes replacement contents. Python checks paths, bounds
the loop, writes files and runs commands. These responsibilities are separate.
The analysis graph ends before approval; it does not need a checkpointer.
See [LEARNING.md](LEARNING.md) for a guided explanation.

## Actual source structure

Generated environments, dependencies, caches and temporary clones are omitted.

```text
CodeRepair/
├── .gitignore
├── README.md
├── LEARNING.md
├── server/
│   ├── .env.example
│   ├── requirements.txt
│   ├── config.py
│   ├── main.py
│   ├── github_service.py
│   ├── workspace_service.py
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── state.py
│   │   ├── graph.py
│   │   ├── nodes.py
│   │   ├── tools.py
│   │   ├── llm.py
│   │   └── validation.py
│   └── tests/
│       └── test_solver.py
└── client/
    ├── .env.example
    ├── .gitignore
    ├── AGENTS.md
    ├── CLAUDE.md
    ├── package.json
    ├── package-lock.json
    ├── jsconfig.json
    ├── next.config.mjs
    ├── eslint.config.mjs
    ├── postcss.config.mjs
    ├── app/
    │   ├── page.js
    │   ├── layout.js
    │   └── globals.css
    ├── components/
    │   ├── IssueForm.js
    │   ├── AgentDetails.js
    │   ├── AgentTimeline.js
    │   └── DiffViewer.js
    └── lib/
        └── api.js
```

All application frontend code is JavaScript. TypeScript is present only as a
development dependency required by the Next.js ESLint parser.

## Windows, VS Code and PowerShell setup

Install Git, Python 3.11 or newer, and Node.js 20.9 or newer. Check:
```powershell
git --version
py --version
node --version
npm.cmd --version
```

**Your completed code is already in this local folder.** Open it in VS Code:
```powershell
cd "C:\Abhay\PDFfiles\Desktop\Agentic AI\CodeRepair"
code .
```

For a fresh machine, after these local changes have been published to your
repository, the clone commands are:
```powershell
git clone https://github.com/instantboostbyabhaykeshari/CodeRepair.git
cd CodeRepair
code .
```
The implementation in this workspace has not been committed or pushed for you;
cloning the remote before publishing it may retrieve an older version.

### Backend terminal

In VS Code, open Terminal → New Terminal:
```powershell
cd "C:\Abhay\PDFfiles\Desktop\Agentic AI\CodeRepair\server"
py -m venv .venv
& ./.venv/Scripts/python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
code .env
```

You can skip environment creation and installation when already set up.
Calling the environment's Python directly avoids PowerShell activation-policy
problems. Put your real values into server/.env, never into frontend files:

```env
GOOGLE_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
GITHUB_TOKEN=your_github_token
LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=github-issue-agent
FRONTEND_URL=http://localhost:3000
GIT_AUTHOR_NAME=Your Name
GIT_AUTHOR_EMAIL=your_github_noreply_email
```

Then start the backend:
```powershell
& ./.venv/Scripts/python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Keep that terminal running. Backend: [localhost:8000/api/health](http://localhost:8000/api/health).
Interactive API documentation: [localhost:8000/docs](http://localhost:8000/docs).
The root / path is not an application page. Use one backend worker.

### Frontend terminal

Open a second terminal:
```powershell
cd "C:\Abhay\PDFfiles\Desktop\Agentic AI\CodeRepair\client"
npm.cmd install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

client/.env.local must contain:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start:
```powershell
npm.cmd run dev -- --hostname 127.0.0.1
```

Open [localhost:3000](http://localhost:3000), using localhost consistently so the
browser origin matches FRONTEND_URL. Keep both terminals running. Ctrl+C stops
a server. Restart after changing environment variables.

## Obtain your keys

### Gemini

1. Sign in to [Google AI Studio's API keys page](https://aistudio.google.com/apikey).
2. Create a key for a Google project and copy it to GOOGLE_API_KEY.
3. Keep GEMINI_MODEL configurable. The default gemini-2.5-flash has a free-tier
   offering, subject to eligibility, regional availability and quota.
4. Check [Gemini pricing and free-tier limits](https://ai.google.dev/gemini-api/docs/pricing)
   before changing models. Rate limits or unavailable models are reported as
   errors, never replaced by fabricated output.

### GitHub

1. In GitHub, open Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
2. Choose the resource owner, an expiry and only the repository you will use.
3. Grant repository permissions: **Contents: Read and write**, **Issues: Read**,
   and **Pull requests: Read and write**. Metadata read access is included.
4. Put the token in GITHUB_TOKEN and restart FastAPI.

Your GitHub account must itself have write access. Organization approval may
be required. This implementation opens branches in the same repository; it
does not create forks. See the official
[token instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

### LangSmith (optional)

1. Sign in to [LangSmith](https://smith.langchain.com).
2. Open Settings → API Keys and create an API key.
3. Set LANGSMITH_API_KEY, LANGSMITH_TRACING=true and
   LANGSMITH_PROJECT=github-issue-agent in server/.env.
4. Restart the backend, run an issue, then open that LangSmith project to
   inspect graph nodes, model calls and traced service operations.

Tracing sends issue and selected source data to LangSmith. Leave it disabled
when you do not want that sharing. See the official
[account and API-key guide](https://docs.langchain.com/langsmith/create-account-api-key).

## How to use

1. Enter a GitHub repository URL and an existing issue number or matching issue URL.
2. Optionally enable installation and execution of repository checks only for
   code you trust. Static checks are the default.
3. Click **Solve issue** and watch the execution timeline and activity.
4. Review the issue, repository summary, selected files and additional context.
5. Review the solution plan, per-file diffs and validation output/exit codes.
6. Failed validation blocks publishing. If checks were skipped, explicitly
   acknowledge that fact before approval.
7. Click **Approve & create PR**, or cancel to remove the clone.
8. Open the resulting draft PR; the page shows its title, number and URL.
9. If tracing is enabled, inspect the run in LangSmith.

The frontend stores the run ID so refresh reconnects while the backend remains
running. It uses normal React state and EventSource; no state-management library.

## Validation and automated tests

The agent applies changes to the actual clone before checking them.
Python, JSON and TOML files receive parser checks. Plain JavaScript uses
node --check when available; JSX and other languages require project tooling.
Unsupported checks are marked skipped.

With the trusted-code option enabled, JavaScript projects install dependencies
with npm ci (or npm install without creating a lockfile), disabling installation
scripts, then execute only existing test, lint and build scripts. Python
projects with pytest-style tests create a separate environment inside the clone,
install pytest and requirements.txt or the root package, then run pytest.
Commands are selected by backend code, not supplied by Gemini.

Each project check has a 60-second timeout; dependency installation has a
180-second timeout. stdout, stderr and exit codes are recorded. A passed syntax
check does not prove correct behavior. Skipped checks remain visible.

Run this application's own checks:
```powershell
cd "C:\Abhay\PDFfiles\Desktop\Agentic AI\CodeRepair\server"
& ./.venv/Scripts/python.exe -m pytest tests -q

cd "../client"
npm.cmd run lint
npm.cmd run build
```

The backend suite replaces Gemini and GitHub responses only inside tests.
It uses real temporary Git repositories to verify cloning, applying changes,
committing, pushing, cancellation, approval gates, stale bases, path safety,
validation and SSE replay. A successful test suite does not verify your API
credentials or guarantee a real model will fix a given issue.

A simple live test: use a small repository you own with a clear reproducible
bug and a test, create a GitHub issue describing expected behavior, then follow
the UI steps above. Confirm no remote branch exists before approval and that
the resulting draft PR targets the correct default branch.

## Security and practical limits

- Local, single-user application: bind to loopback, use one worker. It has no
  login system and is not intended for public deployment.
- Path checks reject traversal, absolute paths, symlinks/junctions, hidden/secret
  paths and ignored generated directories. The file tool is bound to one clone.
- Backend credentials are not exposed to the browser or included in model
  state. Git authentication is supplied through process configuration, not URLs.
- Optional repository checks execute repository and proposed code on your
  computer. A virtual environment and stripped secret environment variables
  are **not a security sandbox**; code can still access files and the network.
- Each run may read at most 12 files, 40 KB per file, 120,000 context characters,
  with two additional reading rounds. Up to six files can be changed.
- Source discovery is capped at 5,000 supported text files. Large repositories,
  monorepos and unusual build systems may need manual setup.
- New source files and modifications are supported. Deletions, renames, binary
  changes, submodules and hidden paths such as .github workflows are excluded.
- Approval commits only the reviewed files. Changed content, unexpected tracked
  modifications and a changed default-branch base cause an error.
- Pushes use a new codex/issue-* branch without force. The application never
  merges a PR or pushes to the default branch. If PR creation fails after a
  successful push, the remote branch may remain for manual inspection.
- Runs and events live in memory: restart loses review/history. Up to 20 runs
  are retained and two analyses can start concurrently. No database is needed
  for this local lesson.
- Clones under server/.workspaces are removed after completion, cancellation or
  failure. Paused reviews keep their clone. After a crash, stop the backend
  before manually removing abandoned clones from that directory.
- A fix may be incorrect despite passing checks. Review every proposal.

## Cleanup performed

Removed unused legacy UI components (AnalysisCard, IssueInput, Sidebar, Header,
EmptyState), duplicate Axios API setup, the abandoned server/app API, the
runtime demo fixture, default Next.js public assets/favicon and obsolete
frontend README. Removed unused axios, react-markdown and remark-gfm packages.
Retained project instruction files and useful tests. Existing personal virtual
environments were not deleted.

## Troubleshooting

- Missing-key banner: configure both required keys in server/.env and restart.
- Connection error: run both servers and verify both URL environment variables.
- GitHub 404: check repository/issue spelling and the token's repository access.
- GitHub 403: check permissions, organization approval and API rate limits.
- Gemini error: check model access, key, quota and free-tier eligibility.
- Base changed during review: cancel and start again against the latest commit.
- Run not found after restart: start a new run; in-memory history is gone.
- Validation failure: inspect captured output; no PR can be created from that run.
