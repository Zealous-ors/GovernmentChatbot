from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Tanzania Government Services AI Chatbot"
)


class ChatRequest(BaseModel):
    message: str


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.post("/chat")
def chat(request: ChatRequest):
    return {
        "message": request.message
    }
