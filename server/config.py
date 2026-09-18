"""Backend environment settings. This is the only place that loads .env."""

import os
from pathlib import Path

from dotenv import load_dotenv

SERVER_DIR = Path(__file__).resolve().parent
load_dotenv(SERVER_DIR / ".env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
GIT_AUTHOR_NAME = os.getenv("GIT_AUTHOR_NAME", "Issue Solver")
GIT_AUTHOR_EMAIL = os.getenv("GIT_AUTHOR_EMAIL", "issue-solver@users.noreply.github.com")
WORKSPACE_ROOT = SERVER_DIR / ".workspaces"
MAX_FILE_BYTES = 40000
MAX_CONTEXT_CHARS = 120000
MAX_FILES = 12


def redact(text):
    for secret in (GOOGLE_API_KEY, GITHUB_TOKEN, os.getenv("LANGSMITH_API_KEY", "")):
        if secret:
            text = text.replace(secret, "[redacted]")
    return text
