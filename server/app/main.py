from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.chat import router as chat_router
from app.routes.repository import router as repository_router

app = FastAPI(
    title="PatchPilot — AI Software Engineering Agent",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(
    repository_router,
    prefix="/api/repository"
)


@app.get("/")
def root():
    return {
        "message": "PatchPilot - AI Software Engineering Agent API is running"
    }