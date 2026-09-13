from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, status

from backend.app.core.provider_registry import get_all_providers, get_provider
from backend.app.schemas.service import (
    ProviderCompareItem,
    ProviderCompareResponse,
    ProviderInfo,
    ProviderListResponse,
    ProviderServicePricing,
)

router = APIRouter(prefix="/providers", tags=["Provider Discovery"])

# Unit labels per service, consistent with the main pricing catalog
_SERVICE_UNITS = {
    "translation": "100 chars",
    "compute": "compute unit",
    "storage": "MB",
    "summarization": "100 words",
}

# Supported service types for comparison
_SUPPORTED_SERVICES = {"translation", "compute", "storage", "summarization"}


def _calculate_provider_price(
    service_type: str,
    price_per_unit: float,
    payload: Dict[str, Any],
) -> float:
    """
    Calculates the exact price for a provider given a service type and payload,
    using the same sizing logic as calculate_service_price() in pricing.py.
    """
    if service_type == "translation":
        text = payload.get("text", "")
        char_count = len(text)
        units = max(1, (char_count + 99) // 100)
        return round(units * price_per_unit, 6)

    elif service_type == "summarization":
        text = payload.get("text", "")
        word_count = len(text.split())
        units = max(1, (word_count + 99) // 100)
        return round(units * price_per_unit, 6)

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
        return round(units * price_per_unit, 6)

    elif service_type == "storage":
        value = payload.get("value", "")
        size_bytes = len(value.encode("utf-8"))
        size_mb = size_bytes / (1024 * 1024)
        if size_mb < 0.01:
            size_mb = 0.5  # minimum charge equivalent
        return round(max(0.00005, size_mb * price_per_unit), 6)

    return round(price_per_unit, 6)


def _build_provider_schema(provider) -> ProviderInfo:
    """Converts a ProviderInfo registry object into the API schema."""
    services = {
        "translation": ProviderServicePricing(
            service_type="translation",
            price_per_unit=provider.pricing.translation,
            unit=_SERVICE_UNITS["translation"],
        ),
        "summarization": ProviderServicePricing(
            service_type="summarization",
            price_per_unit=getattr(provider.pricing, "summarization", 0.00010),
            unit=_SERVICE_UNITS["summarization"],
        ),
        "compute": ProviderServicePricing(
            service_type="compute",
            price_per_unit=provider.pricing.compute,
            unit=_SERVICE_UNITS["compute"],
        ),
        "storage": ProviderServicePricing(
            service_type="storage",
            price_per_unit=provider.pricing.storage,
            unit=_SERVICE_UNITS["storage"],
        ),
    }
    return ProviderInfo(
        provider_id=provider.provider_id,
        name=provider.name,
        wallet_address=provider.wallet_address,
        base_url=provider.base_url,
        description=provider.description,
        services=services,
    )


@router.get("", response_model=ProviderListResponse)
def list_providers():
    """
    Returns all registered service providers with their complete pricing catalogs.
    Use this endpoint to discover available providers before selecting one.
    """
    registry = get_all_providers()
    providers = [_build_provider_schema(p) for p in registry.values()]
    return ProviderListResponse(total=len(providers), providers=providers)


@router.get("/compare/{service_type}", response_model=ProviderCompareResponse)
def compare_providers(
    service_type: str,
    # Translation sizing params
    text: Optional[str] = Query(None, description="Text to translate (for translation pricing)"),
    # Compute sizing params
    operation: Optional[str] = Query(None, description="Compute operation (for compute pricing)"),
    matrix_size: Optional[int] = Query(None, description="Matrix size for matrix_multiply"),
    dimension: Optional[int] = Query(None, description="Dimension for data_embedding"),
    # Storage sizing params
    value: Optional[str] = Query(None, description="Storage value (for storage pricing)"),
):
    """
    Compares all registered providers for the given service type.
    Returns providers sorted cheapest-first based on the exact pricing logic.

    This endpoint does NOT create a quote and does NOT initiate payment.
    Use it to select the cheapest (or preferred) provider before making a service request.
    """
    service_type_lower = service_type.lower()
    if service_type_lower not in _SUPPORTED_SERVICES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported service type '{service_type}'. Supported: {sorted(_SUPPORTED_SERVICES)}.",
        )

    # Build payload from query params for pricing calculation
    payload: Dict[str, Any] = {}
    if service_type_lower == "translation":
        payload["text"] = text or ""
    elif service_type_lower == "compute":
        payload["operation"] = operation or ""
        params: Dict[str, Any] = {}
        if matrix_size is not None:
            params["matrix_size"] = matrix_size
        if dimension is not None:
            params["dimension"] = dimension
        payload["params"] = params
    elif service_type_lower == "storage":
        payload["value"] = value or ""

    registry = get_all_providers()
    items = []
    for provider in registry.values():
        price_per_unit = getattr(provider.pricing, service_type_lower)
        calculated_price = _calculate_provider_price(service_type_lower, price_per_unit, payload)
        items.append(
            ProviderCompareItem(
                provider_id=provider.provider_id,
                name=provider.name,
                wallet_address=provider.wallet_address,
                base_url=provider.base_url,
                service_type=service_type_lower,
                calculated_price=calculated_price,
                currency="ETH",
            )
        )

    # Sort cheapest-first
    items.sort(key=lambda x: x.calculated_price)

    return ProviderCompareResponse(service_type=service_type_lower, providers=items)
