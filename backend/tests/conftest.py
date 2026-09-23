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

@pytest.fixture(autouse=True)
def mock_gemini_translation_for_tests(monkeypatch, request):
    """
    Default fixture to simulate Gemini responses during standard integration tests,
    ensuring existing test suites run deterministically in CI without live API keys.
    Can be bypassed using @pytest.mark.no_mock_gemini.
    """
    if "no_mock_gemini" in request.keywords:
        return

    from backend.app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test_gemini_api_key_override")

    def _mock_translate_summary(text: str, source_lang: str, target_lang: str, api_key: str, model_name: str = "gemini-2.5-flash"):
        clean = text.strip().lower()
        if "hello" in clean:
            translated = "hola" if target_lang == "es" else f"[{target_lang.upper()}] {text}"
        else:
            translated = f"[{target_lang.upper()}] {text}"
        return {
            "translated_text": translated,
            "summary": f"Summary: {text.strip()[:40]}",
        }

    monkeypatch.setattr("backend.app.services.translation.generate_translation_and_summary", _mock_translate_summary)
