import os
import shutil
import tempfile

from git import Repo


IGNORED_DIRECTORIES = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
}


def clone_repository(repository_url: str) -> str:
    repository_path = tempfile.mkdtemp(prefix="devagent_")

    try:
        Repo.clone_from(
            repository_url,
            repository_path,
            depth=1,
        )

        return repository_path

    except Exception:
        shutil.rmtree(repository_path, ignore_errors=True)
        raise


def list_repository_files(repository_path: str) -> list[str]:
    files = []

    for root, directories, filenames in os.walk(repository_path):

        directories[:] = [
            directory
            for directory in directories
            if directory not in IGNORED_DIRECTORIES
        ]

        for filename in filenames:
            full_path = os.path.join(root, filename)

            relative_path = os.path.relpath(
                full_path,
                repository_path,
            )

            files.append(relative_path)

    return files