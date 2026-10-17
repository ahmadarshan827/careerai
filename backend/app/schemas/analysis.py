from pydantic import BaseModel


class ResumeAnalysis(BaseModel):
    summary: str
    technical_skills: list[str]
    soft_skills: list[str]
    education: list[str]
    experience: list[str]
    projects: list[str]
    certifications: list[str]
    strengths: list[str]
    weaknesses: list[str]
    missing_information: list[str]
    improvement_suggestions: list[str]
    resume_score: int
    score_reasoning: str