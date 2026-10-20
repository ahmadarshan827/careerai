from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class GeneratedQuestion(BaseModel):  # shapes we ask Gemini to return
    category: str
    question: str


class GeneratedQuestions(BaseModel):
    questions: list[GeneratedQuestion]


class AnswerFeedback(BaseModel):
    relevance: int
    technical_correctness: int
    clarity: int
    completeness: int
    communication: int
    strengths: list[str]
    improvements: list[str]
    improved_answer: str


class InterviewCreate(BaseModel):
    resume_id: int
    job_id: int
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    num_questions: int = Field(default=5, ge=3, le=10)


class AnswerSubmit(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    category: str
    question: str
    answer: str | None
    score: int | None
    feedback: AnswerFeedback | None


class InterviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resume_id: int
    job_id: int
    title: str
    difficulty: str
    status: str
    overall_score: int | None
    created_at: datetime


class InterviewDetail(InterviewRead):
    questions: list[QuestionRead]

    @computed_field
    @property
    def answered_count(self) -> int:
        return sum(q.answer is not None for q in self.questions)