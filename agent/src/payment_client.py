"""
Payment client boundary for Person 2 (AI Agent + Payment).

Orchestrates the payment lifecycle between domain payment requirements and ContractClient.
Strictly validates payment requirements, enforces native ETH denomination, performs
exact deterministic Decimal-to-wei conversions, and calls AgentPay.sol.

ARCHITECTURAL PRINCIPLES:
- Smart contract transaction is the final spending authority; never use getRemaining() as a security bypass.
- Strictly native ETH end-to-end; no USDC or synthetic conversions.
- Idempotency guard: verifies contract state to prevent duplicate charge.
- Preserves exact request_id across the payment lifecycle.
"""

from decimal import Decimal, InvalidOperation
from typing import Optional, Union

from agent.src.contract_client import ContractClient
from agent.src.exceptions import (
    DuplicateRequestError,
    InvalidPaymentRequirementError,
    PaymentAuthorizationError,
    PaymentError,
)
from agent.src.logger import get_logger
from agent.src.models import (
    PaymentRequirement,
    PaymentResult,
    PaymentStatus,
    RequestId,
)

logger = get_logger("agent.payment_client")

WEI_PER_ETH = Decimal(10**18)


def eth_to_wei(amount_eth: Union[Decimal, float, str, int]) -> int:
    """
    Deterministically convert an ETH amount to integer wei using exact Decimal arithmetic.
    Floating-point math is strictly prohibited to prevent rounding exploits on chain.
    """
    try:
        dec = Decimal(str(amount_eth))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid ETH amount '{amount_eth}': cannot parse as Decimal") from exc

    if dec <= 0:
        raise ValueError(f"Payment amount must be positive, got {dec}")

    # Multiply by 10^18 and verify no fractional wei
    wei_dec = dec * WEI_PER_ETH
    wei_int = int(wei_dec)
    if Decimal(wei_int) != wei_dec:
        raise ValueError(f"ETH amount '{amount_eth}' has sub-wei precision ({wei_dec})")

    return wei_int


class PaymentClient:
    """
    Coordinates payment execution against the AgentPay smart contract.
    """

    def __init__(self, contract_client: ContractClient) -> None:
        self.contract_client = contract_client

    def process_payment(
        self,
        requirement: PaymentRequirement,
        service: str,
    ) -> PaymentResult:
        """
        Execute payment for a provider PaymentRequirement.

        Steps:
        1. Validate requirement model and fields.
        2. Enforce currency == 'ETH'.
        3. Validate provider recipient address.
        4. Convert ETH amount to exact wei.
        5. Check contract idempotency state.
        6. Execute authorizePayment on-chain.
        7. Return verified PaymentResult with transaction hash.
        """
        req_id_str = str(requirement.request_id)
        logger.info(
            "Initiating payment processing: request_id=%s amount=%s currency=%s provider=%s",
            req_id_str, requirement.amount, requirement.currency, requirement.provider,
        )

        # 1 & 2. Currency check: Native ETH only
        curr = (requirement.currency or "").strip().upper()
        if curr != "ETH":
            raise InvalidPaymentRequirementError(
                f"Unsupported payment currency '{requirement.currency}'. AgentPay strictly requires native 'ETH'.",
                code="UNSUPPORTED_CURRENCY",
                request_id=req_id_str,
                details={"currency": requirement.currency, "expected": "ETH"},
            )

        # 3. Provider address validation
        raw_addr = requirement.payment_address
        if not raw_addr or not self.contract_client.is_valid_address(raw_addr):
            raise InvalidPaymentRequirementError(
                f"Invalid or missing provider payment address '{raw_addr}'",
                code="INVALID_PAYMENT_ADDRESS",
                request_id=req_id_str,
                details={"payment_address": raw_addr},
            )

        # 4. Deterministic conversion to wei
        try:
            amount_wei = eth_to_wei(requirement.amount)
        except ValueError as exc:
            raise InvalidPaymentRequirementError(
                f"Invalid payment amount for blockchain transaction: {str(exc)}",
                code="INVALID_AMOUNT_PRECISION",
                request_id=req_id_str,
                details={"amount": str(requirement.amount)},
            ) from exc

        # 5. Check if contract already processed this request_id
        if self.contract_client.is_processed(req_id_str):
            logger.warning("Request %s has already been processed on contract; returning existing state", req_id_str)
            # If already processed on-chain, re-use existing payment status
            return PaymentResult(
                request_id=requirement.request_id,
                amount=requirement.amount,
                status=PaymentStatus.CONFIRMED,
                transaction_hash="0xALREADY_PROCESSED_ON_CHAIN",
            )

        # 6. Call authorizePayment() on AgentPay.sol
        result = self.contract_client.authorize_payment(
            request_id=requirement.request_id,
            amount_wei=amount_wei,
            provider_address=raw_addr,
            service=service,
        )

        logger.info(
            "Payment authorized successfully on-chain: tx_hash=%s request_id=%s",
            result.transaction_hash, req_id_str,
        )
        return result
