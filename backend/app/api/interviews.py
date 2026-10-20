from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.jobs import _get_owned_job
from app.api.resumes import _get_owned_resume
from app.db.session import get_db
from app.models import InterviewQuestion, InterviewSession, User
from app.schemas.interview import (
    AnswerSubmit, InterviewCreate, InterviewDetail, InterviewRead,
)
from app.services.interview_service import evaluate_answer, generate_questions, question_score
from app.services.llm_service import LLMBusyError, LLMError

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _get_owned_session(db: Session, session_id: int, user: User) -> InterviewSession:
    session = db.scalar(
        select(InterviewSession).where(
            InterviewSession.id == session_id, InterviewSession.user_id == user.id
        )
    )
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found")
    return session


def _ai_http_error(exc: LLMError) -> HTTPException:
    if isinstance(exc, LLMBusyError):
        return HTTPException(503, "AI service is busy. Please try again in a minute.")
    return HTTPException(502, "AI request failed. Please try again.")


@router.post("", response_model=InterviewDetail, status_code=status.HTTP_201_CREATED)
def create_interview(
    data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = _get_owned_resume(db, data.resume_id, current_user)
    job = _get_owned_job(db, data.job_id, current_user)
    if resume.analysis is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Analyze the resume first")
    if job.analysis is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Analyze the job description first")

    try:
        generated = generate_questions(
            job.title, data.difficulty, data.num_questions, resume.analysis, job.analysis
        )
    except LLMError as exc:
        raise _ai_http_error(exc) from exc

    session = InterviewSession(
        user_id=current_user.id,
        resume_id=resume.id,
        job_id=job.id,
        title=f"{job.title} interview"[:200],
        difficulty=data.difficulty,
        questions=[
            InterviewQuestion(position=i, category=category, question=text)
            for i, (category, text) in enumerate(generated, start=1)
        ],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[InterviewRead])
def list_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc())
    ).all()


@router.get("/{session_id}", response_model=InterviewDetail)
def get_interview(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_session(db, session_id, current_user)


@router.post("/{session_id}/questions/{question_id}/answer", response_model=InterviewDetail)
def submit_answer(
    session_id: int,
    question_id: int,
    data: AnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(db, session_id, current_user)
    question = next((q for q in session.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    if question.answer is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This question was already answered")

    answer = data.answer.strip()
    if not answer:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Answer cannot be empty")

    try:  # nothing is saved unless evaluation succeeds, so the user can resubmit
        feedback = evaluate_answer(
            session.title, session.difficulty, question.category, question.question, answer
        )
    except LLMError as exc:
        raise _ai_http_error(exc) from exc

    now = datetime.now(timezone.utc)
    question.answer = answer
    question.score = question_score(feedback)
    question.feedback = feedback.model_dump()
    question.answered_at = now

    if all(q.answer is not None for q in session.questions):
        session.status = "completed"
        session.overall_score = round(
            sum(q.score for q in session.questions) / len(session.questions)
        )
        session.completed_at = now

    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.delete(_get_owned_session(db, session_id, current_user))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)