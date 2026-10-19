from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.matches import _get_owned_match
from app.db.session import get_db
from app.models import JobDescription, Resume, Roadmap, RoadmapStep, User
from app.schemas.roadmap import RoadmapCreate, RoadmapDetail, StepUpdate
from app.services.llm_service import LLMBusyError, LLMError
from app.services.roadmap_service import build_roadmap

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


def _get_owned_roadmap(db: Session, roadmap_id: int, user: User) -> Roadmap:
    roadmap = db.scalar(
        select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == user.id)
    )
    if roadmap is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found")
    return roadmap


@router.post("", response_model=RoadmapDetail)
def create_roadmap(
    data: RoadmapCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_owned_match(db, data.match_id, current_user)
    existing = db.scalar(select(Roadmap).where(Roadmap.match_id == match.id))
    if existing is not None and not data.force:
        return existing  # cached: keeps the user's progress, no AI call

    missing = [i for i in match.result["required"] + match.result["preferred"] if not i["matched"]]
    if not missing:
        raise HTTPException(status.HTTP_409_CONFLICT, "No missing skills found for this match")

    job = db.get(JobDescription, match.job_id)
    resume = db.get(Resume, match.resume_id)

    try:
        plan = build_roadmap(job.title, data.weeks, match.result, resume.analysis or {})
    except LLMBusyError as exc:
        raise HTTPException(503, "AI service is busy. Please try again in a minute.") from exc
    except LLMError as exc:
        raise HTTPException(502, "Roadmap generation failed. Please try again.") from exc

    if existing is not None:
        db.delete(existing)
        db.flush()  # remove the old row before inserting one with the same match_id

    roadmap = Roadmap(
        user_id=current_user.id,
        match_id=match.id,
        title=plan.title[:200],
        summary=plan.summary,
        final_project=plan.final_project,
        steps=[
            RoadmapStep(week=i, focus=w.focus, skills=w.skills, tasks=w.tasks)
            for i, w in enumerate(plan.weeks, start=1)
        ],
    )
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)
    return roadmap


@router.get("", response_model=list[RoadmapDetail])
def list_roadmaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(Roadmap)
        .where(Roadmap.user_id == current_user.id)
        .order_by(Roadmap.created_at.desc())
    ).all()


@router.get("/{roadmap_id}", response_model=RoadmapDetail)
def get_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_roadmap(db, roadmap_id, current_user)


@router.patch("/{roadmap_id}/steps/{step_id}", response_model=RoadmapDetail)
def update_step(
    roadmap_id: int,
    step_id: int,
    data: StepUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roadmap = _get_owned_roadmap(db, roadmap_id, current_user)
    step = next((s for s in roadmap.steps if s.id == step_id), None)
    if step is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    step.completed = data.completed
    step.completed_at = datetime.now(timezone.utc) if data.completed else None
    db.commit()
    db.refresh(roadmap)
    return roadmap


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.delete(_get_owned_roadmap(db, roadmap_id, current_user))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)