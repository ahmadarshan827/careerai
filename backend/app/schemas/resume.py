from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.analysis import ResumeAnalysis


class ResumeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    created_at: datetime


class ResumeDetail(ResumeRead):
    extracted_text: str
    analysis: ResumeAnalysis | None = None