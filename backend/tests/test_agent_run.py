"""
Backend tests for POST /agent/run endpoint, DB task tracking, and pre-execution budget enforcement.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
import backend.app.models  # noqa: F401
from backend.app.models.agent_run import AgentRun, AgentRunStep, AgentRunStatus, AgentRunStepStatus

# In-memory SQLite for testing with StaticPool
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


# 1. Valid translation goal
def test_valid_translation_goal(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Translate this text into Hindi"})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "PLANNED"
    assert len(data["plan"]) == 1
    assert data["plan"][0]["service"] == "translation"
    assert data["plan"][0]["step"] == 1
    assert data["plan"][0]["input_dependency"] is None


# 2. Valid storage goal
def test_valid_storage_goal(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Store this file in IPFS"})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "PLANNED"
    assert len(data["plan"]) == 1
    assert data["plan"][0]["service"] == "storage"


# 3. Translation + storage goal
def test_translation_and_storage_goal(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Translate this document to Hindi and store the result"})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "PLANNED"
    assert len(data["plan"]) == 2
    assert data["plan"][0]["service"] == "translation"
    assert data["plan"][1]["service"] == "storage"
    assert data["plan"][1]["input_dependency"] == "step_1_output"


# 4. Compute + translation + storage goal
def test_compute_translation_storage_goal(client: TestClient):
    response = client.post("/agent/run", json={
        "prompt": "Analyze the dataset, translate the report, and store the archive"
    })
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "PLANNED"
    assert len(data["plan"]) == 3
    assert data["plan"][0]["service"] == "compute"
    assert data["plan"][1]["service"] == "translation"
    assert data["plan"][2]["service"] == "storage"


# 5. Unsupported goal
def test_unsupported_goal(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Make me a sandwich"})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "FAILED"
    assert data["error_code"] == "UNSUPPORTED_GOAL"
    assert len(data["plan"]) == 0


# 6. AgentRun is persisted in DB
def test_agent_run_persisted(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Translate this text"})
    data = response.json()
    task_id = data["task_id"]

    db = TestingSessionLocal()
    run_record = db.query(AgentRun).filter(AgentRun.task_id == task_id).first()
    assert run_record is not None
    assert run_record.user_prompt == "Translate this text"
    assert run_record.status == AgentRunStatus.PLANNED
    db.close()


# 7. AgentRunStep records are persisted in DB
def test_agent_run_steps_persisted(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Translate text and store it"})
    data = response.json()
    task_id = data["task_id"]

    db = TestingSessionLocal()
    step_records = db.query(AgentRunStep).filter(AgentRunStep.task_id == task_id).all()
    assert len(step_records) == 2
    assert step_records[0].service == "translation"
    assert step_records[1].service == "storage"
    db.close()


# 8. Total planned cost is persisted correctly
def test_total_planned_cost_persisted(client: TestClient):
    response = client.post("/agent/run", json={"prompt": "Translate this text and store it"})
    data = response.json()
    task_id = data["task_id"]

    db = TestingSessionLocal()
    run_record = db.query(AgentRun).filter(AgentRun.task_id == task_id).first()
    assert run_record.total_planned_cost_eth > 0
    assert round(run_record.total_planned_cost_eth, 6) == round(data["total_planned_cost_eth"], 6)
    db.close()


# 9. Within-budget plan returns PLANNED
def test_within_budget_plan(client: TestClient):
    response = client.post("/agent/run", json={
        "prompt": "Translate this text",
        "max_budget_eth": 0.01
    })
    data = response.json()
    assert data["status"] == "PLANNED"
    assert data["error_code"] is None


# 10. Budget-exceeded plan returns BLOCKED
def test_budget_exceeded_plan(client: TestClient):
    response = client.post("/agent/run", json={
        "prompt": "Translate this text and store it",
        "max_budget_eth": 0.000001  # Extremely tiny budget below quote
    })
    data = response.json()
    assert data["status"] == "BLOCKED"
    assert data["error_code"] == "BUDGET_EXCEEDED"
    assert "PRE_EXECUTION_BUDGET_BLOCK" in data["error_message"]


# 11. Budget-exceeded plan sends NO blockchain transaction
def test_budget_exceeded_sends_no_blockchain_tx(client: TestClient):
    response = client.post("/agent/run", json={
        "prompt": "Translate this text and store it",
        "max_budget_eth": 0.000001
    })
    data = response.json()

    # Steps are persisted as PLANNED, but run status is BLOCKED without tx_hash
    for step in data["plan"]:
        assert step.get("transaction_hash") is None

    db = TestingSessionLocal()
    run_record = db.query(AgentRun).filter(AgentRun.task_id == data["task_id"]).first()
    assert run_record.status == AgentRunStatus.BLOCKED
    assert run_record.error_code == "BUDGET_EXCEEDED"
    db.close()


# 12. Existing routes remain unaffected
def test_existing_routes_unaffected(client: TestClient):
    resp_health = client.get("/health")
    assert resp_health.status_code == 200

    resp_providers = client.get("/providers")
    assert resp_providers.status_code == 200

    resp_audit = client.get("/audit/logs")
    assert resp_audit.status_code == 200


# 13. Valid budget comparison: 0.00013 ETH planned vs 0.0100 ETH remaining -> NOT BLOCKED
def test_valid_budget_comparison_not_blocked(client: TestClient):
    response = client.post("/agent/run", json={
        "prompt": "Translate 'Hello World' into Hindi and store the result",
        "max_budget_eth": 0.0100
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PLANNED"
    assert data["total_planned_cost_eth"] < 0.0100
    assert data["error_code"] is None


# 14. Exact budget boundary: max_budget_eth equal to planned cost -> NOT BLOCKED
def test_exact_budget_boundary_not_blocked(client: TestClient):
    # First plan to get exact planned cost
    resp1 = client.post("/agent/run", json={"prompt": "Translate this text"})
    planned_cost = resp1.json()["total_planned_cost_eth"]

    # Submit with max_budget_eth set to exact planned cost
    resp2 = client.post("/agent/run", json={
        "prompt": "Translate this text",
        "max_budget_eth": planned_cost
    })
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["status"] == "PLANNED"
    assert data["error_code"] is None


# 15. Task persistence and retrieval via GET /agent/run/{task_id}
def test_get_agent_run_task_retrieval(client: TestClient):
    post_resp = client.post("/agent/run", json={"prompt": "Translate text and store it"})
    task_id = post_resp.json()["task_id"]

    get_resp = client.get(f"/agent/run/{task_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["task_id"] == task_id
    assert data["user_prompt"] == "Translate text and store it"
    assert data["status"] == "PLANNED"
    assert len(data["plan"]) == 2
