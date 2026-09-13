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
            r"\bspanish\b", r"\bgerman\b", r"\blanguage\b"
        ],
        "summarization": [
            r"\bsummarize\b", r"\bsummary\b", r"\bsummarise\b", r"\bshort summary\b",
            r"\bbrief summary\b", r"\bcondense\b", r"\bkey points\b"
        ],
        "storage": [
            r"\bstore\b", r"\bstorage\b", r"\bsave\b", r"\bback\s*up\b",
            r"\bbackup\b", r"\barchive\b", r"\bipfs\b"
        ],
    }

    # Default fallback step execution ordering
    EXECUTION_ORDER = ["compute", "translation", "summarization", "storage"]

    # Step human-readable reasons
    REASONS = {
        "compute": "Perform data computation / matrix analysis task.",
        "translation": "Translate input text/document to requested target language.",
        "summarization": "Condense input text into a concise structured summary.",
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
        """Detects required service capabilities ordered by occurrence in user prompt."""
        if not normalized_goal:
            return []

        first_matches = []

        for service, patterns in self.PATTERNS.items():
            min_pos = float("inf")
            for pattern in patterns:
                m = re.search(pattern, normalized_goal)
                if m:
                    if m.start() < min_pos:
                        min_pos = m.start()
            if min_pos < float("inf"):
                first_matches.append((min_pos, service))

        # Sort by match position in original prompt to preserve goal dependency order
        first_matches.sort(key=lambda x: x[0])
        return [s for _, s in first_matches]

    def find_lowest_quote_provider(self, service: str) -> tuple[str, float, str]:
        """
        Discovers available providers for a service capability, compares valid quotes,
        and selects the provider with the lowest quote.
        Returns tuple of (provider_id, quote_eth, selection_reason).
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
            return ("prov_trans_01", 0.00002, "Default provider assignment")

        reason = f"Lowest valid quote for requested capability ({service}: {lowest_quote:.6f} ETH)."
        return (best_provider_id, lowest_quote, reason)

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
            provider_id, quote_eth, quote_reason = self.find_lowest_quote_provider(service)
            dependency = f"step_{idx-1}_output" if idx > 1 else None

            step = ServicePlanStep(
                step_number=idx,
                service=service,
                reason=quote_reason,
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

    def create_translation_plan(self, content: str) -> AgentPlan:
        """
        Creates a single-step translation plan into Hindi for arbitrary user content.
        Discovers available translation providers from provider registry based on lowest quote.
        """
        provider_id, quote_eth, quote_reason = self.find_lowest_quote_provider("translation")
        clean_text = (content or "").strip()
        step = ServicePlanStep(
            step_number=1,
            service="translation",
            reason=f"Translate user content into Hindi ({quote_reason})",
            input_dependency=None,
            provider_id=provider_id,
            quote_eth=quote_eth,
            status="PLANNED",
        )
        return AgentPlan(
            goal=f"Translate '{clean_text}' into Hindi",
            normalized_goal=self.normalize_goal(clean_text),
            steps=[step],
            total_planned_cost_eth=round(quote_eth, 6),
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
