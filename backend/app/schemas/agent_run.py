from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class AgentRunRequest(BaseModel):
    """Payload for submitting a natural-language goal to the AI Agent Run engine."""
    prompt: str = Field(..., description="Natural language user goal or content to translate.")
    max_budget_eth: Optional[float] = Field(None, description="Optional spending limit requested by the user.")
    auto_execute: Optional[bool] = Field(False, description="Whether to automatically execute planned steps immediately after planning.")
    agent_mode: Optional[str] = Field(None, description="Demo intent / mode (e.g. 'translation').")


class AgentRunStepResponse(BaseModel):
    """Schema representing a single planned/executed service step in an Agent Run."""
    step: int = Field(..., description="1-indexed step number")
    service: str = Field(..., description="Service capability required ('translation', 'storage', 'compute')")
    reason: str = Field(..., description="Human-readable rationale for this execution step")
    input_dependency: Optional[str] = Field(None, description="Step dependency identifier (e.g. 'step_1_output')")
    provider_id: str = Field(..., description="Selected provider ID from provider registry")
    quote_eth: float = Field(..., description="ETH quote for this service step")
    status: str = Field("PLANNED", description="Status of the step ('PLANNED', 'EXECUTING', 'FULFILLED', 'BLOCKED', 'FAILED')")
    transaction_hash: Optional[str] = Field(None, description="On-chain Sepolia EVM payment transaction hash")
    content_hash: Optional[str] = Field(None, description="Cryptographic SHA-256 / IPFS hash of delivered payload")
    result: Optional[Any] = Field(None, description="Structured result / payload delivered by service provider")
    error_message: Optional[str] = Field(None, description="Error message if step failed or was blocked")


class AgentRunResponse(BaseModel):
    """Schema for the Agent Run response returned to the caller."""
    task_id: str = Field(..., description="Unique task identifier for tracking this Agent Run")
    user_prompt: str = Field(..., description="Original user prompt / goal")
    status: str = Field(..., description="Aggregate status ('PLANNING', 'PLANNED', 'EXECUTING', 'COMPLETED', 'BLOCKED', 'FAILED')")
    plan: List[AgentRunStepResponse] = Field(..., description="Ordered list of service execution steps")
    total_planned_cost_eth: float = Field(..., description="Aggregated planned ETH cost for all steps")
    total_actual_cost_eth: Optional[float] = Field(None, description="Actual total ETH spent on executed steps")
    budget_remaining_eth: Optional[float] = Field(None, description="Remaining contract budget at planning time")
    error_code: Optional[str] = Field(None, description="Error code if run was blocked or failed")
    error_message: Optional[str] = Field(None, description="Detailed error description if run was blocked or failed")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    started_at: Optional[str] = Field(None, description="ISO 8601 execution start timestamp")
    completed_at: Optional[str] = Field(None, description="ISO 8601 completion timestamp")
