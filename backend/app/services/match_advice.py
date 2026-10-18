from app.schemas.match import MatchAdvice
from app.services.llm_service import generate_structured

SYSTEM_INSTRUCTION = (
    "You are a career coach. Use ONLY the facts provided. Never claim the candidate "
    "has a skill or experience that is not listed. The scores were computed by a "
    "program and are rough estimates: do not recalculate them. Give at most 6 "
    "concrete, prioritized recommendations that close the missing required skills "
    "first, then preferred ones. Where it is plausible, say how an existing project "
    "or experience could demonstrate a missing skill. Keep each recommendation to "
    "one or two sentences. The summary is two or three sentences."
)


def build_advice(job_title: str, resume_analysis: dict, computed: dict) -> MatchAdvice:
    result = computed["result"]

    def names(items, matched):
        return [i["requirement"] for i in items if i["matched"] == matched]

    prompt = "\n".join(
        [
            f"Target role: {job_title}",
            f"Estimated match: {computed['match_percentage']}%",
            f"Estimated ATS-style score: {computed['ats_score']}/100",
            f"Required skills the resume covers: {names(result['required'], True)}",
            f"Required skills missing: {names(result['required'], False)}",
            f"Preferred skills the resume covers: {names(result['preferred'], True)}",
            f"Preferred skills missing: {names(result['preferred'], False)}",
            f"Keywords missing: {names(result['keywords'], False)}",
            f"Candidate projects: {resume_analysis.get('projects', [])}",
            f"Candidate experience: {resume_analysis.get('experience', [])}",
        ]
    )
    return generate_structured(prompt, MatchAdvice, SYSTEM_INSTRUCTION)