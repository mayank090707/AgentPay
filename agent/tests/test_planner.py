"""
Unit tests for agent/src/planner.py (AgentPlanner).
"""

import pytest
from agent.src.planner import AgentPlanner, AgentPlan, ServicePlanStep
from backend.app.core.provider_registry import ProviderInfo, ProviderPricing


@pytest.fixture
def planner() -> AgentPlanner:
    return AgentPlanner()


# 1. Translation-only goal
def test_translation_only_goal(planner: AgentPlanner):
    goal = "Translate this text into Hindi"
    plan = planner.create_plan(goal)

    assert plan.goal == goal
    assert len(plan.steps) == 1
    assert plan.steps[0].service == "translation"
    assert plan.steps[0].input_dependency is None
    assert plan.steps[0].step_number == 1


# 2. Storage-only goal
def test_storage_only_goal(planner: AgentPlanner):
    goal = "Store this file in cloud storage"
    plan = planner.create_plan(goal)

    assert len(plan.steps) == 1
    assert plan.steps[0].service == "storage"
    assert plan.steps[0].input_dependency is None


# 3. Translation + storage goal
def test_translation_and_storage_goal(planner: AgentPlanner):
    goal = "Translate this document to French and store the result"
    plan = planner.create_plan(goal)

    assert len(plan.steps) == 2
    assert plan.steps[0].service == "translation"
    assert plan.steps[0].input_dependency is None

    assert plan.steps[1].service == "storage"
    assert plan.steps[1].input_dependency == "step_1_output"


# 4. Compute + translation + storage goal
def test_compute_translation_storage_goal(planner: AgentPlanner):
    goal = "Analyze the dataset, translate the report, and store the archive"
    plan = planner.create_plan(goal)

    assert len(plan.steps) == 3
    assert plan.steps[0].service == "compute"
    assert plan.steps[0].input_dependency is None

    assert plan.steps[1].service == "translation"
    assert plan.steps[1].input_dependency == "step_1_output"

    assert plan.steps[2].service == "storage"
    assert plan.steps[2].input_dependency == "step_2_output"


# 5. Unknown goal
def test_unknown_goal(planner: AgentPlanner):
    goal = "Make me a sandwich"
    plan = planner.create_plan(goal)

    assert plan.goal == goal
    assert len(plan.steps) == 0
    assert plan.total_planned_cost_eth == 0.0


# 6. Provider discovery
def test_provider_discovery(planner: AgentPlanner):
    provider_id, quote = planner.find_lowest_quote_provider("translation")
    assert provider_id in planner.provider_registry
    assert quote > 0.0


# 7. Lowest valid provider selection
def test_lowest_valid_provider_selection():
    custom_registry = {
        "expensive_alpha": ProviderInfo(
            provider_id="expensive_alpha",
            name="Expensive Alpha",
            wallet_address="0x111",
            base_url="http://localhost",
            pricing=ProviderPricing(translation=0.0010, compute=0.0020, storage=0.0030)
        ),
        "cheap_beta": ProviderInfo(
            provider_id="cheap_beta",
            name="Cheap Beta",
            wallet_address="0x222",
            base_url="http://localhost",
            pricing=ProviderPricing(translation=0.0001, compute=0.0002, storage=0.0003)
        ),
    }

    planner = AgentPlanner(provider_registry=custom_registry)
    provider_id, quote = planner.find_lowest_quote_provider("translation")

    assert provider_id == "cheap_beta"
    assert quote == 0.0001


# 8. Quote aggregation
def test_quote_aggregation(planner: AgentPlanner):
    goal = "Analyze this matrix and store the file"
    plan = planner.create_plan(goal)

    expected_total = sum(step.quote_eth for step in plan.steps)
    assert round(plan.total_planned_cost_eth, 6) == round(expected_total, 6)


# 9. Within-budget plan
def test_within_budget_plan(planner: AgentPlanner):
    goal = "Translate this text"
    plan = planner.create_plan(goal)

    # Remaining budget (0.01 ETH) is greater than translation cost (~0.00005 ETH)
    evaluated_plan = planner.evaluate_budget(plan, remaining_budget_eth=0.01)

    assert evaluated_plan.budget_status == "WITHIN_BUDGET"
    assert evaluated_plan.remaining_budget_eth == 0.01


# 10. Budget-exceeded plan
def test_budget_exceeded_plan(planner: AgentPlanner):
    goal = "Analyze data, translate report, and store file"
    plan = planner.create_plan(goal)

    # Remaining budget (0.00001 ETH) is smaller than total planned cost (~0.00025 ETH)
    evaluated_plan = planner.evaluate_budget(plan, remaining_budget_eth=0.00001)

    assert evaluated_plan.budget_status == "BUDGET_EXCEEDED"
    assert evaluated_plan.remaining_budget_eth == 0.00001
