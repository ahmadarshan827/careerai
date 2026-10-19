from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, false, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Roadmap(Base):
    __tablename__ = "roadmaps"
    __table_args__ = (UniqueConstraint("match_id", name="uq_roadmaps_match"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    final_project: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    steps: Mapped[list["RoadmapStep"]] = relationship(
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapStep.week",
    )


class RoadmapStep(Base):
    __tablename__ = "roadmap_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    roadmap_id: Mapped[int] = mapped_column(
        ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    week: Mapped[int] = mapped_column(nullable=False)
    focus: Mapped[str] = mapped_column(Text, nullable=False)
    skills: Mapped[list] = mapped_column(JSONB, nullable=False)
    tasks: Mapped[list] = mapped_column(JSONB, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false())
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    roadmap: Mapped["Roadmap"] = relationship(back_populates="steps")