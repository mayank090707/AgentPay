from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class ProviderPricing:
    """Per-service unit pricing for a provider."""
    translation: float = 0.0    # price_per_unit per 100 chars
    compute: float = 0.0        # price_per_unit per compute unit
    storage: float = 0.0        # price_per_unit per MB
    summarization: float = 0.0  # price_per_unit per 100 words


@dataclass
class ProviderInfo:
    """Represents a registered service provider in the AgentPay network."""
    provider_id: str
    name: str
    wallet_address: str
    base_url: str
    pricing: ProviderPricing
    capability: str = "general"
    status: str = "Online"
    is_agent_compatible: bool = True
    description: str = ""


# ---------------------------------------------------------------------------
# In-memory Provider Registry (6 Providers across Translation & Summarization)
# ---------------------------------------------------------------------------
PROVIDER_REGISTRY: Dict[str, ProviderInfo] = {
    "alpha": ProviderInfo(
        provider_id="alpha",
        name="Translation Alpha",
        wallet_address="0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.005, compute=0.005, storage=0.005, summarization=0.005),
        capability="English → Hindi",
        status="Online",
        is_agent_compatible=True,
        description="High-efficiency translation service with 94% efficiency and fast speed.",
    ),
    "beta": ProviderInfo(
        provider_id="beta",
        name="Translation Beta",
        wallet_address="0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.003, compute=0.003, storage=0.003, summarization=0.003),
        capability="English → Hindi",
        status="Online",
        is_agent_compatible=True,
        description="Balanced translation service with 67% efficiency and optimal cost-speed ratio.",
    ),
    "gamma": ProviderInfo(
        provider_id="gamma",
        name="Translation Gamma",
        wallet_address="0xC3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.001, compute=0.001, storage=0.001, summarization=0.001),
        capability="English → Hindi",
        status="Online",
        is_agent_compatible=True,
        description="Budget translation service with 45% efficiency and economical cost.",
    ),
}


def get_provider(provider_id: str) -> Optional[ProviderInfo]:
    """Returns the ProviderInfo for a given provider_id, or None if not found."""
    return PROVIDER_REGISTRY.get(provider_id)


def get_all_providers() -> Dict[str, ProviderInfo]:
    """Returns the full provider registry."""
    return PROVIDER_REGISTRY
