import os
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from web3 import Web3


class Settings(BaseSettings):
    PROJECT_NAME: str = "AgentPay Service Provider Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = ""

    # Database
    DATABASE_URL: str = "sqlite:///./agentpay.db"

    # Service Provider Wallet / Contract
    PROVIDER_WALLET_ADDRESS: str = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"

    # Cryptographic Secret for Receipt HMAC signing
    HMAC_SECRET: str = "agentpay_secret_key_change_in_production"

    # Default Quote Expiry (Seconds)
    QUOTE_EXPIRY_SECONDS: int = 300

    # Blockchain configuration for on-chain verification
    RPC_URL: Optional[str] = None
    CONTRACT_ADDRESS: Optional[str] = None
    PAYMENT_VERIFIER_TYPE: str = "mock"

    @field_validator("PROVIDER_WALLET_ADDRESS")
    @classmethod
    def validate_provider_wallet_address(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("PROVIDER_WALLET_ADDRESS cannot be empty")
        v = v.strip()
        if not Web3.is_address(v):
            raise ValueError(f"Invalid Ethereum address for PROVIDER_WALLET_ADDRESS: '{v}'")
        return Web3.to_checksum_address(v)

    @field_validator("CONTRACT_ADDRESS")
    @classmethod
    def validate_contract_address(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        v = str(v).strip()
        if not Web3.is_address(v):
            raise ValueError(f"Invalid Ethereum address for CONTRACT_ADDRESS: '{v}'")
        return Web3.to_checksum_address(v)

    @field_validator("PAYMENT_VERIFIER_TYPE")
    @classmethod
    def validate_verifier_type(cls, v: str) -> str:
        valid_types = {"mock", "on_chain"}
        clean = (v or "").strip().lower()
        if clean not in valid_types:
            raise ValueError(f"PAYMENT_VERIFIER_TYPE must be one of {valid_types}, got '{v}'")
        return clean

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()

