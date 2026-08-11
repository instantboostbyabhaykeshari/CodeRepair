from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.repository import (
    clone_repository,
    list_repository_files,
)

router = APIRouter()


class RepositoryRequest(BaseModel):
    repository_url: str


@router.post("/inspect")
async def inspect_repository(request: RepositoryRequest):

    try:
        repository_path = clone_repository(
            request.repository_url
        )

        files = list_repository_files(
            repository_path
        )

        return {
            "repository": request.repository_url,
            "fileCount": len(files),
            "files": files[:200],
        }

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=f"Unable to inspect repository: {str(error)}",
        )