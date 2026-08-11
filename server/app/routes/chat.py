from fastapi import APIRouter
from pydantic import BaseModel
from google import genai

from app.config import GEMINI_API_KEY

router = APIRouter()

client = genai.Client(api_key=GEMINI_API_KEY)


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
async def chat(request: ChatRequest):

    prompt = f"""
You are an experienced software engineer helping diagnose
software development issues.

Analyze the following issue.

{request.message}

Return ONLY valid JSON in this exact structure:

{{
    "possibleCause": "Explain the likely cause",
    "rootCause": "Explain the technical root cause based on the information available",
    "suggestedFix": "Explain what should be changed",
    "codeFix": "Provide a small example code fix if possible"
}}

Important:
- Do not use markdown.
- Do not wrap the JSON in ```json.
- If there is not enough information to determine the exact root cause,
  clearly say that in rootCause.
- Do not pretend that you inspected a repository.
"""

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=prompt,
    )

    return {
        "response": response.text
    }