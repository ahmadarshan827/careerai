from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.jobs import _get_owned_job
from app.api.resumes import _get_owned_resume
from app.db.session import get_db
from app.models import Match, User
from app.schemas.match import MatchCreate, MatchDetail, MatchRead
from app.services.llm_service import LLMError
from app.services.match_advice import build_advice
from app.services.skill_matcher import compute_match

router = APIRouter(prefix="/matches", tags=["matches"])


def _get_owned_match(db: Session, match_id: int, user: User) -> Match:
    match = db.scalar(select(Match).where(Match.id == match_id, Match.user_id == user.id))
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    return match


@router.post("", response_model=MatchDetail)
def create_or_update_match(
    data: MatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = _get_owned_resume(db, data.resume_id, current_user)
    job = _get_owned_job(db, data.job_id, current_user)
    if resume.analysis is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Analyze the resume first")
    if job.analysis is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Analyze the job description first")

    match = db.scalar(
        select(Match).where(Match.resume_id == resume.id, Match.job_id == job.id)
    )
    if match is not None and match.advice is not None and not data.force:
        return match  # cached: no recompute, no AI call

    skills = resume.analysis.get("technical_skills") or resume.analysis.get("skills", [])
    computed = compute_match(
        resume.extracted_text, skills, resume.analysis.get("resume_score", 0), job.analysis
    )

    try:
        advice = build_advice(job.title, resume.analysis, computed).model_dump()
    except LLMError:
        advice = None  # the computed scores are still useful without written advice

    if match is None:
        match = Match(user_id=current_user.id, resume_id=resume.id, job_id=job.id)
        db.add(match)
    match.match_percentage = computed["match_percentage"]
    match.ats_score = computed["ats_score"]
    match.result = computed["result"]
    match.advice = advice
    db.commit()
    db.refresh(match)
    return match


@router.get("", response_model=list[MatchRead])
def list_matches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(Match).where(Match.user_id == current_user.id).order_by(Match.created_at.desc())
    ).all()


@router.get("/{match_id}", response_model=MatchDetail)
def get_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_match(db, match_id, current_user)