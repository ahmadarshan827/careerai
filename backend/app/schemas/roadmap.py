from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class WeekPlan(BaseModel):
    week: int
    focus: str
    skills: list[str]
    tasks: list[str]


class RoadmapPlan(BaseModel):  # the shape we ask Gemini to return
    title: str
    summary: str
    weeks: list[WeekPlan]
    final_project: str


class RoadmapCreate(BaseModel):
    match_id: int
    weeks: int = Field(default=4, ge=1, le=8)
    force: bool = False


class StepUpdate(BaseModel):
    completed: bool


class StepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    week: int
    focus: str
    skills: list[str]
    tasks: list[str]
    completed: bool


class RoadmapDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    match_id: int
    title: str
    summary: str
    final_project: str | None
    created_at: datetime
    steps: list[StepRead]

    @computed_field
    @property
    def progress(self) -> int:
        if not self.steps:
            return 0
        return round(100 * sum(s.completed for s in self.steps) / len(self.steps))