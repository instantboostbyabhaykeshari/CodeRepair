from langchain_core.tools import tool

import workspace_service


def make_read_tool(workspace):
    # Bind the workspace in Python so Gemini can only request a relative path.
    @tool
    def read_file(path: str) -> str:
        """Read one relevant UTF-8 source file inside this run's cloned repository."""
        return workspace_service.read_file(workspace, path)
    return read_file
