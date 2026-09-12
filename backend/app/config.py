import os
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()

