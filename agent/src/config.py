"""
Configuration module for Person 2 (AI Agent + Payment).

Uses environment-based typed configuration via pydantic-settings.
Direct environment variable names are mapped without prefix.

PHASE 1 ARCHITECTURAL BOUNDARY:
- Sensible defaults are provided for general runtime settings.
- Integration fields (RPC_URL, CONTRACT_ADDRESS, etc.) default to None.
- No network connections, RPC probes, or required-field blocking are performed during Phase 1.
"""

from functools import lru_cache
from typing import Optional

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded directly from environment variables.
    All integration fields are optional in Phase 1 to allow clean foundation instantiation.
    """

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
    )

    # Blockchain configuration (optional in Phase 1)
    RPC_URL: Optional[str] = Field(
        default=None,
        description="JSON-RPC endpoint for blockchain communication",
    )
    CONTRACT_ADDRESS: Optional[str] = Field(
        default=None,
        description="Deployed smart contract address",
    )
    CHAIN_ID: Optional[int] = Field(
        default=None,
        description="Target blockchain network chain ID",
    )
    AGENT_ADDRESS: Optional[str] = Field(
        default=None,
        description="Public wallet address of the agent",
    )
    AGENT_PRIVATE_KEY: Optional[SecretStr] = Field(
        default=None,
        description="Private key for transaction signing (stored as SecretStr)",
    )

    # Provider configuration (optional in Phase 1)
    PROVIDER_BASE_URL: Optional[str] = Field(
        default=None,
        description="Base URL for the external service provider",
    )

    # Agent runtime configuration
    AGENT_PORT: int = Field(
        default=8000,
        description="Port for agent service / dashboard API",
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Runtime environment (development, testing, production)",
    )
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Application logging verbosity",
    )

    @field_validator("AGENT_PORT")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError(f"AGENT_PORT must be between 1 and 65535, got {v}")
        return v

    @field_validator("CHAIN_ID")
    @classmethod
    def validate_chain_id(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError(f"CHAIN_ID must be a positive integer, got {v}")
        return v

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid_levels:
            raise ValueError(f"LOG_LEVEL must be one of {valid_levels}, got '{v}'")
        return upper

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_testing(self) -> bool:
        """Check if running in testing mode."""
        return self.ENVIRONMENT.lower() == "testing"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()


def reload_settings() -> Settings:
    """Clear cached settings and reload from environment (primarily for testing)."""
    get_settings.cache_clear()
    return get_settings()
