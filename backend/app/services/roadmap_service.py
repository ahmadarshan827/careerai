from app.schemas.roadmap import RoadmapPlan
from app.services.llm_service import LLMError, generate_structured

SYSTEM_INSTRUCTION = (
    "You are a career coach building a learning roadmap. Use ONLY the facts provided. "
    "Never claim the candidate already has a skill that is not listed as covered. "
    "Plan exactly the requested number of weeks, one entry per week, numbered from 1. "
    "Cover the missing required skills first, then the missing preferred ones, grouping "
    "related skills in the same week. Each week has a short focus, the skills it covers, "
    "and 3 to 5 concrete hands-on tasks that produce something the candidate can show. "
    "Do not include URLs or invent course names, books or links. final_project is one "
    "project idea that combines the new skills, built on one of the candidate's existing "
    "projects when that is plausible. summary is two or three sentences."
)


def _names(items: list[dict], matched: bool) -> list[str]:
    return [i["requirement"] for i in items if i["matched"] == matched]


def build_roadmap(job_title: str, weeks: int, result: dict, resume_analysis: dict) -> RoadmapPlan:
    prompt = "\n".join(
        [
            f"Target role: {job_title}",
            f"Number of weeks: {weeks}",
            f"Skills the candidate already covers: "
            f"{_names(result['required'], True) + _names(result['preferred'], True)}",
            f"Missing required skills: {_names(result['required'], False)}",
            f"Missing preferred skills: {_names(result['preferred'], False)}",
            f"Candidate projects: {resume_analysis.get('projects', [])}",
            f"Candidate experience: {resume_analysis.get('experience', [])}",
        ]
    )
    plan = generate_structured(prompt, RoadmapPlan, SYSTEM_INSTRUCTION)
    plan.weeks = plan.weeks[:weeks]
    if not plan.weeks:
        raise LLMError("AI returned an empty roadmap")
    return plan