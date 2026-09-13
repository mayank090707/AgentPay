"""
Agent Goal Planner for Autonomous Machine Payment Pipelines.

Converts natural-language user goals into structured multi-service execution plans,
discovers independent providers from the provider registry, calculates expected quotes,
and evaluates plans against contract budget limits.
"""

from dataclasses import dataclass, field
import re
from typing import Dict, List, Optional

from backend.app.core.provider_registry import get_all_providers, ProviderInfo


@dataclass
class ServicePlanStep:
    """Represents a single service execution step in an AgentPlan."""
    step_number: int
    service: str
    reason: str
    input_dependency: Optional[str] = None
    provider_id: str = ""
    quote_eth: float = 0.0
    status: str = "PLANNED"


@dataclass
class AgentPlan:
    """Represents a full multi-service execution plan derived from a user goal."""
    goal: str
    normalized_goal: str
    steps: List[ServicePlanStep] = field(default_factory=list)
    total_planned_cost_eth: float = 0.0
    budget_status: str = "UNCHECKED"
    remaining_budget_eth: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "goal": self.goal,
            "normalized_goal": self.normalized_goal,
            "steps": [
                {
                    "step_number": s.step_number,
                    "service": s.service,
                    "reason": s.reason,
                    "input_dependency": s.input_dependency,
                    "provider_id": s.provider_id,
                    "quote_eth": round(s.quote_eth, 6),
                    "status": s.status,
                }
                for s in self.steps
            ],
            "total_planned_cost_eth": round(self.total_planned_cost_eth, 6),
            "budget_status": self.budget_status,
            "remaining_budget_eth": (
                round(self.remaining_budget_eth, 6)
                if self.remaining_budget_eth is not None
                else None
            ),
        }


class AgentPlanner:
    """
    Parses user goals, plans required service steps, selects optimal providers,
    aggregates costs, and checks budget availability.
    """

    # Service capability detection patterns
    PATTERNS = {
        "compute": [
            r"\banalyze\b", r"\banalysis\b", r"\bcompute\b", r"\bcalculate\b",
            r"\bmatrix\b", r"\btransform\b", r"\bprocess data\b", r"\bdataset\b"
        ],
        "translation": [
            r"\btranslate\b", r"\btranslation\b", r"\bhindi\b", r"\bfrench\b",
            r"\bspanish\b", r"\bgerman\b", r"\blanguage\b", r"\breport\b"
        ],
        "storage": [
            r"\bstore\b", r"\bstorage\b", r"\bsave\b", r"\bback\s*up\b",
            r"\bbackup\b", r"\barchive\b", r"\bipfs\b"
        ],
    }

    # Step execution ordering (e.g. compute data first -> translate results -> store output)
    EXECUTION_ORDER = ["compute", "translation", "storage"]

    # Step human-readable reasons
    REASONS = {
        "compute": "Perform data computation / matrix analysis task.",
        "translation": "Translate input text/document to requested target language.",
        "storage": "Persist result object in decentralized / cloud storage.",
    }

    def __init__(self, provider_registry: Optional[Dict[str, ProviderInfo]] = None):
        self.provider_registry = provider_registry or get_all_providers()

    def normalize_goal(self, goal: str) -> str:
        """Normalizes user goal string by lowering case and stripping extra whitespace."""
        if not goal:
            return ""
        return re.sub(r"\s+", " ", goal.strip().lower())

    def detect_services(self, normalized_goal: str) -> List[str]:
        """Detects required service capabilities from the normalized goal string."""
        if not normalized_goal:
            return []

        detected = set()

        # Specific word context checks
        for service, patterns in self.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, normalized_goal):
                    detected.add(service)
                    break

        # Order detected services logically
        ordered = [s for s in self.EXECUTION_ORDER if s in detected]
        return ordered

    def find_lowest_quote_provider(self, service: str) -> tuple[str, float]:
        """
        Discovers available providers for a service and selects the one with the lowest quote.
        Returns tuple of (provider_id, quote_eth).
        """
        best_provider_id = ""
        lowest_quote = float("inf")

        for p_id, provider in self.provider_registry.items():
            price = getattr(provider.pricing, service, None)
            if price is not None and price > 0:
                if price < lowest_quote:
                    lowest_quote = price
                    best_provider_id = p_id

        if not best_provider_id:
            return ("alpha", 0.0001)  # Fallback default

        return (best_provider_id, lowest_quote)

    def create_plan(self, goal: str) -> AgentPlan:
        """
        Converts a natural-language goal into a structured AgentPlan with provider selection
        and quote aggregation.
        """
        norm_goal = self.normalize_goal(goal)
        required_services = self.detect_services(norm_goal)

        steps: List[ServicePlanStep] = []
        total_cost = 0.0

        for idx, service in enumerate(required_services, start=1):
            provider_id, quote_eth = self.find_lowest_quote_provider(service)
            dependency = f"step_{idx-1}_output" if idx > 1 else None

            step = ServicePlanStep(
                step_number=idx,
                service=service,
                reason=self.REASONS.get(service, f"Execute {service} service."),
                input_dependency=dependency,
                provider_id=provider_id,
                quote_eth=quote_eth,
                status="PLANNED",
            )
            steps.append(step)
            total_cost += quote_eth

        return AgentPlan(
            goal=goal,
            normalized_goal=norm_goal,
            steps=steps,
            total_planned_cost_eth=round(total_cost, 6),
            budget_status="UNCHECKED",
        )

    def evaluate_budget(self, plan: AgentPlan, remaining_budget_eth: float) -> AgentPlan:
        """
        Checks plan total cost against the current remaining contract budget.
        Sets budget_status to WITHIN_BUDGET or BUDGET_EXCEEDED.
        """
        plan.remaining_budget_eth = remaining_budget_eth
        if plan.total_planned_cost_eth <= remaining_budget_eth:
            plan.budget_status = "WITHIN_BUDGET"
        else:
            plan.budget_status = "BUDGET_EXCEEDED"
        return plan
