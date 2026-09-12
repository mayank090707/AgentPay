"""Unit tests for Settings and environment configuration."""

import pytest
from pydantic import ValidationError

from agent.src.config import Settings, get_settings, reload_settings


def test_settings_clean_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that Settings instantiates cleanly with zero environment variables."""
    # Ensure no environment variables interfere
    for var in [
        "RPC_URL",
        "CONTRACT_ADDRESS",
        "CHAIN_ID",
        "AGENT_ADDRESS",
        "AGENT_PRIVATE_KEY",
        "PROVIDER_BASE_URL",
        "AGENT_PORT",
        "ENVIRONMENT",
        "LOG_LEVEL",
    ]:
        monkeypatch.delenv(var, raising=False)

    settings = Settings()

    # Blockchain/provider fields default to None in Phase 1
    assert settings.RPC_URL is None
    assert settings.CONTRACT_ADDRESS is None
    assert settings.CHAIN_ID is None
    assert settings.AGENT_ADDRESS is None
    assert settings.AGENT_PRIVATE_KEY is None
    assert settings.PROVIDER_BASE_URL is None

    # Sensible defaults for runtime
    assert settings.AGENT_PORT == 8000
    assert settings.ENVIRONMENT == "development"
    assert settings.LOG_LEVEL == "INFO"
    assert not settings.is_production
    assert not settings.is_testing


def test_settings_direct_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that direct environment variable names without AGENT_ prefix are loaded."""
    test_key = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f360ef0"
    monkeypatch.setenv("RPC_URL", "https://sepolia.infura.io/v3/test")
    monkeypatch.setenv("CONTRACT_ADDRESS", "0x1111111111111111111111111111111111111111")
    monkeypatch.setenv("CHAIN_ID", "11155111")
    monkeypatch.setenv("AGENT_ADDRESS", "0x2222222222222222222222222222222222222222")
    monkeypatch.setenv("AGENT_PRIVATE_KEY", test_key)
    monkeypatch.setenv("PROVIDER_BASE_URL", "https://api.provider.example.com")
    monkeypatch.setenv("AGENT_PORT", "9000")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")

    settings = Settings()

    assert settings.RPC_URL == "https://sepolia.infura.io/v3/test"
    assert settings.CONTRACT_ADDRESS == "0x1111111111111111111111111111111111111111"
    assert settings.CHAIN_ID == 11155111
    assert settings.AGENT_ADDRESS == "0x2222222222222222222222222222222222222222"
    assert settings.PROVIDER_BASE_URL == "https://api.provider.example.com"
    assert settings.AGENT_PORT == 9000
    assert settings.ENVIRONMENT == "production"
    assert settings.LOG_LEVEL == "DEBUG"
    assert settings.is_production


def test_secret_str_private_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify AGENT_PRIVATE_KEY is protected as SecretStr and does not leak in str/repr."""
    raw_key = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f360ef0"
    monkeypatch.setenv("AGENT_PRIVATE_KEY", raw_key)

    settings = Settings()
    assert settings.AGENT_PRIVATE_KEY is not None
    # SecretStr hides secret in str() and repr()
    assert raw_key not in str(settings.AGENT_PRIVATE_KEY)
    assert raw_key not in repr(settings.AGENT_PRIVATE_KEY)
    assert raw_key not in repr(settings)
    # Underlying value is retrievable safely when required
    assert settings.AGENT_PRIVATE_KEY.get_secret_value() == raw_key


def test_invalid_port_validation() -> None:
    """Verify port validation rejects out-of-range values."""
    with pytest.raises(ValidationError):
        Settings(AGENT_PORT=0)

    with pytest.raises(ValidationError):
        Settings(AGENT_PORT=70000)


def test_invalid_chain_id_validation() -> None:
    """Verify chain ID validation rejects non-positive values."""
    with pytest.raises(ValidationError):
        Settings(CHAIN_ID=-1)

    with pytest.raises(ValidationError):
        Settings(CHAIN_ID=0)


def test_invalid_log_level_validation() -> None:
    """Verify log level validation rejects unsupported log levels."""
    with pytest.raises(ValidationError):
        Settings(LOG_LEVEL="TRACE")


def test_get_and_reload_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify singleton caching and reload behavior."""
    monkeypatch.setenv("ENVIRONMENT", "testing")
    s1 = reload_settings()
    assert s1.ENVIRONMENT == "testing"
    assert s1.is_testing

    # Cached
    s2 = get_settings()
    assert s1 is s2
