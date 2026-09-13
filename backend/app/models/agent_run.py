import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship

from backend.app.database import Base


class AgentRunStatus(str, enum.Enum):
    PLANNING = "PLANNING"
    PLANNED = "PLANNED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


class AgentRunStepStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    EXECUTING = "EXECUTING"
    FULFILLED = "FULFILLED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(255), index=True, nullable=False, unique=True)
    user_prompt = Column(Text, nullable=False)
    status = Column(SQLEnum(AgentRunStatus), default=AgentRunStatus.PLANNING, nullable=False)
    total_planned_cost_eth = Column(Float, nullable=False, default=0.0)
    total_actual_cost_eth = Column(Float, nullable=True)
    budget_remaining_eth = Column(Float, nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    steps = relationship("AgentRunStep", back_populates="agent_run", cascade="all, delete-orphan", order_by="AgentRunStep.step_number")


class AgentRunStep(Base):
    __tablename__ = "agent_run_steps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_run_id = Column(String(36), ForeignKey("agent_runs.id"), nullable=False, index=True)
    task_id = Column(String(255), index=True, nullable=False)
    step_number = Column(Integer, nullable=False)
    service = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    input_dependency = Column(String(255), nullable=True)
    provider_id = Column(String(50), nullable=False)
    quote_eth = Column(Float, nullable=False)
    status = Column(SQLEnum(AgentRunStepStatus), default=AgentRunStepStatus.PLANNED, nullable=False)
    transaction_hash = Column(String(255), nullable=True)
    content_hash = Column(String(255), nullable=True)
    result = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    agent_run = relationship("AgentRun", back_populates="steps")
