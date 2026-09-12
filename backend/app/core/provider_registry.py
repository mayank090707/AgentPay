from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class ProviderPricing:
    """Per-service unit pricing for a provider."""
    translation: float  # price_per_unit per 100 chars
    compute: float      # price_per_unit per compute unit
    storage: float      # price_per_unit per MB


@dataclass
class ProviderInfo:
    """Represents a registered service provider in the AgentPay network."""
    provider_id: str
    name: str
    wallet_address: str
    base_url: str
    pricing: ProviderPricing
    description: str = ""


# ---------------------------------------------------------------------------
# In-memory Provider Registry
# Add new providers here to extend to 4-5 later.
# ---------------------------------------------------------------------------
PROVIDER_REGISTRY: Dict[str, ProviderInfo] = {
    "alpha": ProviderInfo(
        provider_id="alpha",
        name="Alpha AI",
        wallet_address="0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(
            translation=0.03,
            compute=0.05,
            storage=0.02,
        ),
        description="Premium AI services with high accuracy and reliability.",
    ),
    "beta": ProviderInfo(
        provider_id="beta",
        name="Beta Cloud",
        wallet_address="0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(
            translation=0.01,
            compute=0.04,
            storage=0.03,
        ),
        description="Cost-effective cloud AI services with competitive pricing.",
    ),
}


def get_provider(provider_id: str) -> Optional[ProviderInfo]:
    """Returns the ProviderInfo for a given provider_id, or None if not found."""
    return PROVIDER_REGISTRY.get(provider_id)


def get_all_providers() -> Dict[str, ProviderInfo]:
    """Returns the full provider registry."""
    return PROVIDER_REGISTRY
