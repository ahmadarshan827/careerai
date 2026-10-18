from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import JobDescription, User
from app.schemas.job import JobCreate, JobDetail, JobRead
from app.services.job_analysis import analyze_job_text
from app.services.llm_service import LLMBusyError, LLMError

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_owned_job(db: Session, job_id: int, user: User) -> JobDescription:
    job = db.scalar(
        select(JobDescription).where(
            JobDescription.id == job_id, JobDescription.user_id == user.id
        )
    )
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job description not found")
    return job


@router.post("", response_model=JobDetail, status_code=status.HTTP_201_CREATED)
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = JobDescription(
        user_id=current_user.id,
        title=data.title.strip(),
        company=(data.company or "").strip() or None,
        raw_text=data.raw_text.strip(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=list[JobRead])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(JobDescription)
        .where(JobDescription.user_id == current_user.id)
        .order_by(JobDescription.created_at.desc())
    ).all()


@router.get("/{job_id}", response_model=JobDetail)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_job(db, job_id, current_user)


@router.post("/{job_id}/analyze", response_model=JobDetail)
def analyze_job(
    job_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_owned_job(db, job_id, current_user)
    if job.analysis is not None and not force:
        return job  # cached: no AI call, no quota used

    try:
        analysis = analyze_job_text(job.raw_text)
    except LLMBusyError as exc:
        raise HTTPException(503, "AI service is busy. Please try again in a minute.") from exc
    except LLMError as exc:
        raise HTTPException(502, "AI analysis failed. Please try again.") from exc

    job.analysis = analysis.model_dump()
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.delete(_get_owned_job(db, job_id, current_user))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)