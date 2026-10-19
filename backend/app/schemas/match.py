from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MatchCreate(BaseModel):
    resume_id: int
    job_id: int
    force: bool = False


class MatchAdvice(BaseModel):
    summary: str
    recommendations: list[str]


class SkillMatch(BaseModel):
    requirement: str
    matched: bool
    matched_by: str | None = None


class ScoreComponent(BaseModel):
    name: str
    score: float
    max_score: float
    detail: str
    applicable: bool = True


class MatchResult(BaseModel):
    required: list[SkillMatch]
    preferred: list[SkillMatch]
    keywords: list[SkillMatch]
    components: list[ScoreComponent]


class MatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resume_id: int
    job_id: int
    match_percentage: int
    ats_score: int
    created_at: datetime


class MatchDetail(MatchRead):
    result: MatchResult
    advice: MatchAdvice | None = None