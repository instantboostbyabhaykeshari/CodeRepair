# CodeRepair

> An Agentic AI Software Engineering Platform that investigates
> repository issues, identifies probable root causes, generates code
> fixes, validates them with tests, and prepares GitHub Pull Requests.

CodeRepair is designed to move beyond a traditional AI coding chatbot.
Instead of answering only from a user's description, it can inspect a
real repository, search source code, read relevant files, reason over
the evidence, generate a targeted fix, run tests, debug failed attempts,
and automate GitHub workflows.

------------------------------------------------------------------------

## 🚀 Key Features

-   **Agentic AI debugging** using LangGraph and Gemini
-   **Multi-agent orchestration** for repository analysis, bug
    detection, fixing, testing, debugging, and GitHub automation
-   **Repository-aware investigation** through code search and file
    inspection
-   **Tool-based reasoning** instead of relying only on LLM knowledge
-   **AI-generated code fixes** with affected-file context
-   **Automated test execution and validation**
-   **Feedback-driven Debug → Fix → Test loop**
-   **Git branch, commit, and Pull Request automation**
-   **Persistent analysis and execution history**
-   **FastAPI backend and Next.js developer dashboard**
-   **PostgreSQL persistence**
-   **Docker-based development and deployment**

------------------------------------------------------------------------

## 🧠 Problem

Developers often spend significant time investigating software issues
before they can even start fixing them.

A typical debugging workflow involves:

1.  Understanding the issue
2.  Finding relevant files
3.  Searching the codebase
4.  Reading related implementation
5.  Identifying the root cause
6.  Designing a fix
7.  Modifying code
8.  Running tests
9.  Debugging failed tests
10. Creating a commit and Pull Request

Traditional AI assistants often stop after suggesting an answer.

CodeRepair aims to automate the complete investigation and validation
workflow.

------------------------------------------------------------------------

## 💡 Solution

CodeRepair uses specialized AI agents coordinated through **LangGraph**.

``` text
User Issue
    ↓
Manager Agent
    ↓
Repository Analysis
    ↓
Code Search
    ↓
Code Understanding
    ↓
Bug Detection
    ↓
Fix Generation
    ↓
Test Agent
    ↓
 ┌───────────────┐
 │               │
PASS            FAIL
 │               │
 ▼               ▼
GitHub Agent   Debug Agent
 │               │
 ▼               ▼
Pull Request  Fix Generation
                 │
                 ▼
              Test Again
```

The system maintains shared state throughout the workflow so agents can
build on previous investigation results.

------------------------------------------------------------------------

# 🏗️ Architecture

``` text
┌─────────────────────────────────────────────┐
│              Next.js Frontend               │
│                                             │
│  Issue Input • Repository • Analysis        │
│  Agent Steps • Code Fix • History           │
└──────────────────────┬──────────────────────┘
                       │ REST API
                       ▼
┌─────────────────────────────────────────────┐
│              FastAPI Backend                │
│                                             │
│  API Routes • Services • Authentication     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             LangGraph Workflow              │
│                                             │
│ Manager → Code → Bug → Fix → Test → Debug  │
│                         │                   │
│                         ▼                   │
│                    GitHub Agent             │
└───────────────┬─────────────────┬───────────┘
                │                 │
                ▼                 ▼
           Gemini LLM          Tool Layer
                                  │
                 ┌────────────────┼──────────────┐
                 ▼                ▼              ▼
             Code Search      File Reader     Test Runner
                 │                │              │
                 └────────────────┼──────────────┘
                                  │
                                  ▼
                            GitHub API
                                  │
                                  ▼
                         Branch / Commit / PR

                           PostgreSQL
                                │
                                ▼
                     Persistent Application Data
```

------------------------------------------------------------------------

# 🤖 AI Agents

## 1. Manager Agent

The Manager controls the investigation workflow.

Responsibilities:

-   Understand the reported issue
-   Decide the next action
-   Select appropriate tools
-   Track investigation context
-   Coordinate specialized agents
-   Avoid unnecessary repeated searches
-   Decide when enough evidence has been collected

Example:

``` json
{
  "action": "search_code",
  "query": "authorization",
  "reason": "The issue is related to JWT authentication, so the authorization handling should be investigated."
}
```

------------------------------------------------------------------------

## 2. Repository Analyzer

Analyzes repository structure and identifies:

-   Programming languages
-   Frameworks
-   Backend/frontend directories
-   Configuration files
-   Entry points
-   Test directories
-   Important application modules

------------------------------------------------------------------------

## 3. Code Agent

Investigates source code using repository tools.

Capabilities:

``` text
list_files()
search_code()
read_file()
```

The agent uses actual repository evidence instead of relying only on the
LLM's internal knowledge.

------------------------------------------------------------------------

## 4. Bug Detection Agent

Analyzes gathered code and identifies the most likely root cause.

It can reason about:

-   Authentication issues
-   API behavior
-   Incorrect conditions
-   Database interactions
-   State management
-   Configuration
-   Error handling
-   Dependency usage
-   Function and data flow

------------------------------------------------------------------------

## 5. Fix Generation Agent

Generates a targeted code modification based on the identified root
cause.

The result can include:

-   Affected file
-   Existing implementation
-   Proposed change
-   Explanation
-   Expected behavior after the fix

------------------------------------------------------------------------

## 6. Test Agent

Validates generated changes by:

-   Detecting available test frameworks
-   Selecting relevant tests
-   Running tests
-   Capturing output
-   Reporting failures

Example:

``` text
Test Results

✓ Authentication test
✓ Login API test
✓ Protected route test

3 passed
0 failed
```

------------------------------------------------------------------------

## 7. Debug Agent

If tests fail, the Debug Agent receives the failure information and
determines what should change.

``` text
Test Failure
     ↓
Debug Agent
     ↓
Analyze Error
     ↓
Fix Generator
     ↓
Run Tests Again
```

The loop is bounded by a configurable maximum number of attempts to
avoid infinite execution.

------------------------------------------------------------------------

## 8. GitHub Agent

Handles repository automation:

``` text
create_branch()
create_commit()
create_pull_request()
```

Typical workflow:

``` text
Create Branch
     ↓
Apply Fix
     ↓
Run Tests
     ↓
Create Commit
     ↓
Push Changes
     ↓
Create Pull Request
```

------------------------------------------------------------------------

# 🔗 Why LangGraph?

A software debugging task requires multiple dependent decisions.

``` text
What should I search?
        ↓
Which file is relevant?
        ↓
Should I inspect the file?
        ↓
What is the root cause?
        ↓
What should be changed?
        ↓
Did the fix work?
        ↓
If not, what should change?
```

LangGraph provides:

-   Stateful workflows
-   Conditional routing
-   Agent coordination
-   Feedback loops
-   Checkpointing
-   Retry handling
-   Human-in-the-loop support
-   Extensible graph-based orchestration

This makes CodeRepair more suitable for multi-step software engineering
tasks than a single LLM prompt.

------------------------------------------------------------------------

# 🛠️ Tools

CodeRepair exposes controlled tools to its agents.

### Repository Tools

``` text
list_files()
search_code()
read_file()
```

### Development Tools

``` text
write_file()
run_tests()
run_terminal()
```

### GitHub Tools

``` text
create_branch()
create_commit()
create_pull_request()
```

Agents can only use explicitly registered tools.

------------------------------------------------------------------------

# 🧩 Agent State

LangGraph maintains shared state throughout the workflow.

Example:

``` python
{
    "issue": "...",
    "repository_id": "...",
    "repository_path": "...",
    "current_agent": "...",
    "investigation_history": [],
    "relevant_files": [],
    "code_context": [],
    "root_cause": None,
    "proposed_fix": None,
    "test_results": None,
    "debug_attempts": 0,
    "branch_name": None,
    "commit_sha": None,
    "pull_request_url": None
}
```

This allows each agent to build on the work performed by previous
agents.

------------------------------------------------------------------------

# 🗄️ Database

CodeRepair uses **PostgreSQL** for persistent application data.

The database can store:

``` text
Users
Repositories
Issues
Agent Runs
Agent Steps
Analysis Results
Test Results
Pull Requests
```

Relationship:

``` text
User
 │
 └── Repositories
       │
       └── Issues
             │
             └── Agent Runs
                   ├── Agent Steps
                   ├── Analysis
                   ├── Test Results
                   └── Pull Request
```

PostgreSQL allows users to revisit previous investigations and provides
persistent application history.

------------------------------------------------------------------------

# 💻 Frontend

The frontend is built with:

-   Next.js
-   React
-   JavaScript
-   Tailwind CSS
-   Lucide React

Main UI areas:

``` text
Sidebar
Header
Repository Connection
Issue Input
Agent Investigation
AI Analysis
Code Fix
Test Results
Pull Request
Analysis History
```

Primary user journey:

``` text
Connect Repository
       ↓
Describe Issue
       ↓
Analyze
       ↓
Watch Agent Investigation
       ↓
Review Root Cause
       ↓
Review Code Fix
       ↓
Run Tests
       ↓
Create Pull Request
```

------------------------------------------------------------------------

# ⚙️ Backend

The backend is built with:

-   Python
-   FastAPI
-   Pydantic
-   SQLAlchemy
-   LangGraph
-   LangChain
-   Gemini

Example backend structure:

``` text
backend/
├── app/
│   ├── agents/
│   │   ├── manager.py
│   │   ├── repository_agent.py
│   │   ├── code_agent.py
│   │   ├── bug_agent.py
│   │   ├── fix_agent.py
│   │   ├── test_agent.py
│   │   ├── debug_agent.py
│   │   └── github_agent.py
│   │
│   ├── graph/
│   │   ├── state.py
│   │   ├── nodes.py
│   │   ├── edges.py
│   │   └── workflow.py
│   │
│   ├── tools/
│   │   ├── search_code.py
│   │   ├── read_file.py
│   │   ├── write_file.py
│   │   ├── run_tests.py
│   │   ├── terminal.py
│   │   └── github.py
│   │
│   ├── api/
│   ├── models/
│   ├── services/
│   ├── database/
│   └── core/
│
├── tests/
├── requirements.txt
├── Dockerfile
└── alembic.ini
```

------------------------------------------------------------------------

# 📁 Frontend Structure

``` text
frontend/
├── app/
├── components/
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   ├── IssueInput.jsx
│   ├── RepositoryInput.jsx
│   ├── RepositoryCard.jsx
│   ├── AnalysisCard.jsx
│   ├── CodeBlock.jsx
│   ├── AgentSteps.jsx
│   ├── TestResults.jsx
│   ├── PullRequestCard.jsx
│   ├── HistoryPanel.jsx
│   └── LoadingAnalysis.jsx
│
├── lib/
├── public/
├── package.json
└── Dockerfile
```

------------------------------------------------------------------------

# 🔌 API Endpoints

## Repository

### Inspect Repository

``` http
POST /api/repository/inspect
```

Inspects a repository and creates a repository session.

### Search Code

``` http
POST /api/repository/search
```

Example:

``` json
{
  "repository_id": "repo_123",
  "query": "authorization"
}
```

### Read File

``` http
POST /api/repository/read
```

Example:

``` json
{
  "repository_id": "repo_123",
  "file_path": "server/middleware/auth.js"
}
```

------------------------------------------------------------------------

## Agent

### Run CodeRepair

``` http
POST /api/agent/run
```

Example:

``` json
{
  "issue": "Login API returns 401 even with a valid JWT",
  "repository_id": "repo_123"
}
```

------------------------------------------------------------------------

## Analysis

``` http
GET /api/analysis/{analysis_id}
```

Returns the result of an agent investigation.

### History

``` http
GET /api/analysis/history
```

Returns previous investigations.

------------------------------------------------------------------------

# 🔍 Example Investigation

### User Issue

``` text
Login API returns 401 even with a valid JWT.
```

### Investigation

``` text
Step 1
Manager → search_code("authorization")

Step 2
Code Agent → finds authentication middleware

Step 3
Code Agent → read_file("middleware/auth.js")

Step 4
Bug Agent → identifies JWT parsing problem

Step 5
Fix Agent → generates authentication fix

Step 6
Test Agent → runs authentication tests

Step 7
Tests pass

Step 8
GitHub Agent → creates branch, commit and Pull Request
```

### Example Result

``` text
Issue:
Login API returns 401 with a valid JWT.

Root Cause:
The Authorization header is passed directly to JWT
verification instead of extracting the Bearer token.

Suggested Fix:
Extract the token before JWT verification.

Tests:
18 passed
0 failed

Branch:
fix/jwt-authentication-401

Pull Request:
Created successfully
```

------------------------------------------------------------------------

# 🔐 Security

CodeRepair follows several security principles:

-   Sensitive credentials are stored in environment variables
-   GitHub tokens are never hardcoded
-   Repository operations are isolated to the active workspace
-   Agents can only access registered tools
-   Terminal execution is controlled
-   File access is restricted to the selected repository
-   Generated code should be reviewed before merging

> AI-generated code should never be blindly deployed to production.

------------------------------------------------------------------------

# ⚙️ Environment Variables

Create a `.env` file in the backend:

``` env
APP_ENV=development
SECRET_KEY=your_secret_key

GEMINI_API_KEY=your_gemini_api_key

DATABASE_URL=postgresql://postgres:password@localhost:5432/coderepair

GITHUB_TOKEN=your_github_token
```

Frontend `.env.local`:

``` env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Never commit secrets to Git.

------------------------------------------------------------------------

# 🚀 Installation

## Prerequisites

-   Node.js 18+
-   Python 3.11+
-   PostgreSQL
-   Git
-   Docker (recommended)
-   GitHub account
-   Gemini API key

------------------------------------------------------------------------

## Clone

``` bash
git clone https://github.com/your-username/CodeRepair.git
cd CodeRepair
```

------------------------------------------------------------------------

## Backend

``` bash
cd backend

python -m venv venv
```

### Windows

``` bash
venv\Scripts\activate
```

### macOS / Linux

``` bash
source venv/bin/activate
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

Run migrations:

``` bash
alembic upgrade head
```

Start the API:

``` bash
uvicorn app.main:app --reload
```

Backend:

``` text
http://localhost:8000
```

Swagger:

``` text
http://localhost:8000/docs
```

------------------------------------------------------------------------

## Frontend

``` bash
cd frontend
npm install
npm run dev
```

Frontend:

``` text
http://localhost:3000
```

------------------------------------------------------------------------

# 🐳 Docker

Run the complete application using Docker Compose:

``` bash
docker compose up --build
```

This can start:

``` text
Next.js
FastAPI
PostgreSQL
```

------------------------------------------------------------------------

# 🧪 Testing

Backend:

``` bash
cd backend
pytest
```

Frontend:

``` bash
cd frontend
npm run lint
npm run build
```

The main integration flow should validate:

``` text
Repository
    ↓
Issue
    ↓
Agent
    ↓
Tools
    ↓
Root Cause
    ↓
Fix
    ↓
Tests
    ↓
GitHub PR
```

------------------------------------------------------------------------

# 📊 Observability

Each agent run can record:

``` text
Agent
Action
Input
Tool
Tool Result
Execution Status
Error
Execution Time
```

Example:

``` text
Step 1
Manager → search_code("authorization")

Step 2
Code Agent → read_file("middleware/auth.js")

Step 3
Bug Agent → root cause identified

Step 4
Fix Agent → fix generated

Step 5
Test Agent → tests passed

Step 6
GitHub Agent → Pull Request created
```

This makes the workflow easier to debug, monitor, and improve.

------------------------------------------------------------------------

# 🧱 Design Principles

### Tool-First Investigation

The agent should inspect actual repository evidence before making
conclusions.

### Small Changes

Generated fixes should modify only the files necessary for the issue.

### Test Before PR

A Pull Request should only be prepared after validation succeeds.

### Stateful Execution

Agents should use previous investigation results instead of repeatedly
starting from scratch.

### Bounded Loops

Agent retry and debugging loops must have maximum execution limits.

### Human Review

AI-generated changes remain reviewable through GitHub Pull Requests.

------------------------------------------------------------------------

# 🆚 Traditional AI vs CodeRepair

### Traditional AI Coding Assistant

``` text
Issue
  ↓
LLM
  ↓
Suggestion
```

### CodeRepair

``` text
Issue
  ↓
Reason
  ↓
Select Tool
  ↓
Inspect Repository
  ↓
Analyze Evidence
  ↓
Identify Root Cause
  ↓
Generate Fix
  ↓
Run Tests
  ↓
Debug if Needed
  ↓
Validate
  ↓
Create Pull Request
```

CodeRepair focuses on **AI that can investigate and act**, rather than
only generate text.

------------------------------------------------------------------------

# 🔮 Future Improvements

-   AST-based code analysis
-   Semantic code search
-   Repository dependency graphs
-   Embedding-based repository indexing
-   More programming languages
-   Human approval checkpoints
-   Automatic rollback
-   GitHub Actions integration
-   Jira integration
-   Slack notifications
-   Security vulnerability scanning
-   Static analysis integration
-   Automatic regression-test generation
-   Code quality scoring
-   Agent evaluation and benchmarking

------------------------------------------------------------------------

# ⚠️ Limitations

CodeRepair is an AI-assisted engineering system and does not guarantee
that every generated fix is correct.

Potential limitations include:

-   LLM-generated fixes may be incorrect
-   Complex repositories may require human intervention
-   Tests may not cover every edge case
-   Large repositories can increase execution time and API usage
-   External LLM/GitHub services may become temporarily unavailable
-   Repository permissions can limit available operations

Always review generated changes before merging them into production
code.

------------------------------------------------------------------------

# 🧠 What This Project Demonstrates

CodeRepair demonstrates practical implementation of:

-   Agentic AI
-   Multi-Agent Systems
-   LangGraph
-   LangChain
-   Gemini
-   LLM Application Development
-   Tool Calling
-   Stateful AI Workflows
-   AI Code Analysis
-   Automated Debugging
-   AI Code Generation
-   Test Automation
-   GitHub API Integration
-   FastAPI
-   Next.js
-   PostgreSQL
-   SQLAlchemy
-   Docker
-   Git
-   REST APIs
-   Software Engineering Automation

------------------------------------------------------------------------

# ⭐ Project Highlights

``` text
✓ LangGraph-based stateful agent workflow
✓ Specialized AI agents
✓ Repository-aware investigation
✓ Tool-based code analysis
✓ AI root-cause detection
✓ Automated code-fix generation
✓ Test → Debug → Fix feedback loop
✓ GitHub branch / commit / PR automation
✓ Persistent investigation history
✓ Production-oriented architecture
```

------------------------------------------------------------------------

# 📄 License

This project is licensed under the MIT License.

------------------------------------------------------------------------

# 👨‍💻 Author

**Your Name**

B.Tech --- Mechatronics & Automation Engineering

Interests:

-   Agentic AI
-   Generative AI
-   AI Application Development
-   Software Engineering
-   Developer Tools
-   Full-Stack Development
