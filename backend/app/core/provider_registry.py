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
    "prov_trans_01": ProviderInfo(
        provider_id="prov_trans_01",
        name="Translation Provider A",
        wallet_address="0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00002, compute=0.00018, storage=0.00012, summarization=0.00014),
        capability="English → Hindi",
        status="Online",
        is_agent_compatible=True,
        description="Fast English to Hindi neural translation provider.",
    ),
    "prov_trans_02": ProviderInfo(
        provider_id="prov_trans_02",
        name="Translation Provider B",
        wallet_address="0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00003, compute=0.00020, storage=0.00015, summarization=0.00019),
        capability="English → Hindi / French",
        status="Online",
        is_agent_compatible=True,
        description="High precision English to Hindi/French translation.",
    ),
    "prov_trans_03": ProviderInfo(
        provider_id="prov_trans_03",
        name="Translation Provider C",
        wallet_address="0xC3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.000025, compute=0.00016, storage=0.00010, summarization=0.00016),
        capability="Multilingual Translation",
        status="Online",
        is_agent_compatible=True,
        description="Multilingual translation matrix supporting 50+ languages.",
    ),
    "prov_sum_01": ProviderInfo(
        provider_id="prov_sum_01",
        name="Summary Provider A",
        wallet_address="0xD4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00016, compute=0.00014, storage=0.00010, summarization=0.00010),
        capability="Concise Summary",
        status="Online",
        is_agent_compatible=True,
        description="Rapid concise key-points summarization engine.",
    ),
    "prov_sum_02": ProviderInfo(
        provider_id="prov_sum_02",
        name="Summary Provider B",
        wallet_address="0xE5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00019, compute=0.00022, storage=0.00014, summarization=0.00016),
        capability="Detailed Summary",
        status="Online",
        is_agent_compatible=True,
        description="Deep structural document summarization and technical insights.",
    ),
    "prov_sum_03": ProviderInfo(
        provider_id="prov_sum_03",
        name="Summary Provider C",
        wallet_address="0xF6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00014, compute=0.00015, storage=0.00011, summarization=0.00012),
        capability="Executive Summary",
        status="Online",
        is_agent_compatible=True,
        description="Executive brief summarization optimized for high-level decision makers.",
    ),
    # Backward compatibility aliases for legacy test suites
    "alpha": ProviderInfo(
        provider_id="alpha",
        name="Alpha AI",
        wallet_address="0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00010, compute=0.00018, storage=0.00012, summarization=0.00010),
        description="Premium AI services with high accuracy.",
    ),
    "beta": ProviderInfo(
        provider_id="beta",
        name="Beta Cloud",
        wallet_address="0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
        base_url="http://127.0.0.1:8000",
        pricing=ProviderPricing(translation=0.00002, compute=0.00012, storage=0.00008, summarization=0.00008),
        description="Cost-effective cloud AI services.",
    ),
}


def get_provider(provider_id: str) -> Optional[ProviderInfo]:
    """Returns the ProviderInfo for a given provider_id, or None if not found."""
    return PROVIDER_REGISTRY.get(provider_id)


def get_all_providers() -> Dict[str, ProviderInfo]:
    """Returns the full provider registry."""
    return PROVIDER_REGISTRY
