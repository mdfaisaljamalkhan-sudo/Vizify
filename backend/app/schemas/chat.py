from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    extracted_text: str
    dashboard_context: dict


class ChatResponse(BaseModel):
    response: str
