from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class JobAnalysis(BaseModel):
    summary: str
    required_skills: list[str]
    preferred_skills: list[str]
    technologies: list[str]
    experience_requirements: list[str]
    education_requirements: list[str]
    keywords: list[str]
    responsibilities: list[str]


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    raw_text: str = Field(min_length=100, max_length=20000)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str | None
    created_at: datetime


class JobDetail(JobRead):
    raw_text: str
    analysis: JobAnalysis | None = None