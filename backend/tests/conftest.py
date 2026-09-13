import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh in-memory database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Provides a FastAPI TestClient configured with in-memory DB override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    from backend.app.config import settings
    import backend.app.database as db_mod
    import backend.app.api.agent_run as agent_run_mod

    original_verifier = settings.PAYMENT_VERIFIER_TYPE
    settings.PAYMENT_VERIFIER_TYPE = "mock"

    orig_db_session_local = getattr(db_mod, "SessionLocal", None)
    orig_agent_session_local = getattr(agent_run_mod, "SessionLocal", None)

    # Point background task SessionLocal creation to TestingSessionLocal
    db_mod.SessionLocal = TestingSessionLocal
    agent_run_mod.SessionLocal = TestingSessionLocal

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

    settings.PAYMENT_VERIFIER_TYPE = original_verifier
    if orig_db_session_local:
        db_mod.SessionLocal = orig_db_session_local
    if orig_agent_session_local:
        agent_run_mod.SessionLocal = orig_agent_session_local
