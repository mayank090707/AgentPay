from typing import Dict, Any
from backend.app.schemas.service import ServicePriceInfo, PricingCatalogResponse
from backend.app.config import settings

PRICING_CATALOG: Dict[str, ServicePriceInfo] = {
    "translation": ServicePriceInfo(
        service_type="translation",
        unit="100 chars",
        price_per_unit=0.01,
        currency="ETH",
        description="AI text translation (0.01 ETH per 100 characters, min 0.01 ETH)"
    ),
    "compute": ServicePriceInfo(
        service_type="compute",
        unit="compute unit",
        price_per_unit=0.05,
        currency="ETH",
        description="High-performance execution engine (0.05 ETH per compute unit)"
    ),
    "storage": ServicePriceInfo(
        service_type="storage",
        unit="MB",
        price_per_unit=0.02,
        currency="ETH",
        description="Cloud/IPFS decentralized storage (0.02 ETH per MB, min 0.01 ETH)"
    )
}


def get_pricing_catalog() -> PricingCatalogResponse:
    """Returns the service provider's public pricing catalog."""
    return PricingCatalogResponse(
        provider_address=settings.PROVIDER_WALLET_ADDRESS,
        services=PRICING_CATALOG
    )


def calculate_service_price(service_type: str, payload: Dict[str, Any]) -> float:
    """
    Calculates the exact quote amount for a service request based on input parameters.
    """
    service_type = service_type.lower()
    if service_type not in PRICING_CATALOG:
        # Default price for custom/unknown services
        return 0.05

    if service_type == "translation":
        text = payload.get("text", "")
        char_count = len(text)
        units = max(1, (char_count + 99) // 100)
        return round(units * PRICING_CATALOG["translation"].price_per_unit, 4)

    elif service_type == "compute":
        operation = payload.get("operation", "")
        params = payload.get("params", {})
        if operation == "matrix_multiply":
            size = params.get("matrix_size", 100)
            units = max(1, size // 10)
        elif operation == "data_embedding":
            dim = params.get("dimension", 128)
            units = max(1, dim // 32)
        else:
            units = 1
        return round(units * PRICING_CATALOG["compute"].price_per_unit, 4)

    elif service_type == "storage":
        value = payload.get("value", "")
        size_bytes = len(value.encode('utf-8'))
        size_mb = size_bytes / (1024 * 1024)
        if size_mb < 0.01:
            size_mb = 0.5  # minimum charge equivalent
        return round(max(0.01, size_mb * PRICING_CATALOG["storage"].price_per_unit), 4)

    return 0.05
