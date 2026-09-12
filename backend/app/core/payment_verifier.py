"""
Payment verification subsystem for Person 3 (Service Provider Backend).

Supports:
- MockPaymentVerifier for deterministic local and unit testing.
- OnChainPaymentVerifier for real on-chain native ETH payment verification via RPC.
- Configurable verifier factory with seamless proxy delegation.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal
from typing import Optional, Tuple
import eth_abi
from hexbytes import HexBytes
from sqlalchemy.orm import Session
from web3 import Web3

from backend.app.config import settings
from backend.app.core.currency import eth_to_wei
from backend.app.models.payment import Payment
from backend.app.models.quote import Quote, QuoteStatus
from backend.app.schemas.payment import PaymentVerifyRequest

# Canonical keccak256 hash for AgentPay.sol event:
# event PaymentAuthorized(bytes32 indexed requestId, string service, address indexed provider, uint256 amount, uint256 totalSpent, uint256 remainingBudget);
PAYMENT_AUTHORIZED_TOPIC = "0x54160f2d61934056de7716cb1f163fd236370ea949c7f6c89ae7367dddc165cd"


class PaymentVerificationError(Exception):
    def __init__(self, message: str, code: str = "INVALID_PAYMENT"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class AbstractPaymentVerifier(ABC):
    @abstractmethod
    def verify_payment(self, db: Session, proof: PaymentVerifyRequest) -> Tuple[Payment, Quote]:
        """
        Verifies a payment proof against an issued quote.
        Returns the (Payment, Quote) tuple on success or raises PaymentVerificationError.
        """
        pass


class MockPaymentVerifier(AbstractPaymentVerifier):
    """
    Deterministic in-memory/database verifier for unit tests and local test workflows.
    Does not require a live RPC connection.
    """

    def verify_payment(self, db: Session, proof: PaymentVerifyRequest) -> Tuple[Payment, Quote]:
        # 1. Fetch Quote
        quote = db.query(Quote).filter(Quote.id == proof.quote_id).first()
        if not quote:
            raise PaymentVerificationError(f"Quote '{proof.quote_id}' not found.", code="QUOTE_NOT_FOUND")

        # 2. Check if quote already paid
        if quote.status == QuoteStatus.PAID:
            raise PaymentVerificationError(f"Quote '{proof.quote_id}' has already been paid.", code="QUOTE_ALREADY_PAID")

        # 3. Check quote expiration
        if datetime.utcnow() > quote.expires_at:
            quote.status = QuoteStatus.EXPIRED
            db.commit()
            raise PaymentVerificationError(f"Quote '{proof.quote_id}' has expired.", code="QUOTE_EXPIRED")

        # 4. Check for transaction hash replay / double spending
        existing_payment = db.query(Payment).filter(Payment.tx_hash == proof.tx_hash).first()
        if existing_payment:
            raise PaymentVerificationError(
                f"Transaction hash '{proof.tx_hash}' has already been processed for request '{existing_payment.request_id}'. Double-spending attempt rejected.",
                code="DOUBLE_SPENDING_DETECTED",
            )

        # 5. Validate transaction hash format (Hex starting with 0x or mock_tx_)
        tx_hash_clean = proof.tx_hash.strip().lower()
        if not (tx_hash_clean.startswith("0x") or tx_hash_clean.startswith("mock_tx_")):
            raise PaymentVerificationError(
                f"Invalid transaction hash format '{proof.tx_hash}'. Expected hexadecimal hash or mock_tx_ prefix.",
                code="INVALID_TX_FORMAT",
            )

        # 6. Mark quote as PAID and record Payment
        quote.status = QuoteStatus.PAID

        payment = Payment(
            quote_id=quote.id,
            request_id=quote.request_id,
            tx_hash=proof.tx_hash,
            payer_address=proof.payer_address,
            amount=quote.amount,
            verified_at=datetime.utcnow(),
        )

        db.add(payment)
        db.commit()
        db.refresh(payment)
        db.refresh(quote)

        return payment, quote


class OnChainPaymentVerifier(AbstractPaymentVerifier):
    """
    On-chain payment verifier inspecting live Ethereum / Sepolia transactions via JSON-RPC.
    Validates:
    - tx_hash format and existence on-chain.
    - Transaction execution success (receipt.status == 1).
    - Native ETH transfer to quoted provider address.
    - Exact amount in integer wei matching the quoted ETH amount.
    - Integration with AgentPay.sol authorizePayment() via PaymentAuthorized event log.
    - Preserves quote-request-payment identity and double-spending protection.
    """

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        contract_address: Optional[str] = None,
        provider_wallet_address: Optional[str] = None,
        web3_instance: Optional[Web3] = None,
    ) -> None:
        self.rpc_url = rpc_url or settings.RPC_URL
        self.contract_address = (
            Web3.to_checksum_address(contract_address or settings.CONTRACT_ADDRESS)
            if (contract_address or settings.CONTRACT_ADDRESS)
            else None
        )
        self.provider_wallet_address = Web3.to_checksum_address(
            provider_wallet_address or settings.PROVIDER_WALLET_ADDRESS
        )

        if web3_instance is not None:
            self.w3 = web3_instance
        elif self.rpc_url:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        else:
            self.w3 = None

    def verify_payment(self, db: Session, proof: PaymentVerifyRequest) -> Tuple[Payment, Quote]:
        # 1. Fetch Quote
        quote = db.query(Quote).filter(Quote.id == proof.quote_id).first()
        if not quote:
            raise PaymentVerificationError(f"Quote '{proof.quote_id}' not found.", code="QUOTE_NOT_FOUND")

        # 2. Check if quote already paid
        if quote.status == QuoteStatus.PAID:
            raise PaymentVerificationError(f"Quote '{proof.quote_id}' has already been paid.", code="QUOTE_ALREADY_PAID")

        # 3. Check quote expiration
        if datetime.utcnow() > quote.expires_at:
            quote.status = QuoteStatus.EXPIRED
            db.commit()
            raise PaymentVerificationError(f"Quote '{proof.quote_id}' has expired.", code="QUOTE_EXPIRED")

        # 4. Check for transaction hash replay / double spending in DB
        existing_payment = db.query(Payment).filter(Payment.tx_hash == proof.tx_hash).first()
        if existing_payment:
            raise PaymentVerificationError(
                f"Transaction hash '{proof.tx_hash}' has already been processed for request '{existing_payment.request_id}'. Double-spending attempt rejected.",
                code="DOUBLE_SPENDING_DETECTED",
            )

        # 5. Validate transaction hash format (must be 66-char hex starting with 0x)
        tx_hash_clean = proof.tx_hash.strip()
        if not (tx_hash_clean.startswith("0x") and len(tx_hash_clean) == 66):
            raise PaymentVerificationError(
                f"Invalid transaction hash format '{proof.tx_hash}'. Expected 32-byte hex string (0x + 64 hex characters).",
                code="INVALID_TX_FORMAT",
            )
        try:
            int(tx_hash_clean, 16)
        except ValueError:
            raise PaymentVerificationError(
                f"Invalid transaction hash hex characters: '{proof.tx_hash}'.",
                code="INVALID_TX_FORMAT",
            )

        # 6. Verify RPC connection availability
        if self.w3 is None:
            raise PaymentVerificationError(
                "On-chain verification failed: RPC_URL is not configured on the provider.",
                code="RPC_NOT_CONFIGURED",
            )

        # 7. Fetch transaction receipt
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash_clean)
        except Exception as exc:
            raise PaymentVerificationError(
                f"Failed to fetch transaction receipt for '{tx_hash_clean}': {str(exc)}",
                code="RPC_ERROR",
            ) from exc

        if receipt is None:
            raise PaymentVerificationError(
                f"Transaction '{tx_hash_clean}' not found on-chain or still pending.",
                code="TRANSACTION_NOT_FOUND",
            )

        # 8. Verify transaction status
        status_val = receipt.get("status")
        if status_val != 1:
            raise PaymentVerificationError(
                f"Transaction '{tx_hash_clean}' reverted or failed on-chain (status={status_val}).",
                code="TRANSACTION_REVERTED",
            )

        # 9. Fetch transaction details
        try:
            tx = self.w3.eth.get_transaction(tx_hash_clean)
        except Exception as exc:
            raise PaymentVerificationError(
                f"Failed to fetch transaction details for '{tx_hash_clean}': {str(exc)}",
                code="RPC_ERROR",
            ) from exc

        if tx is None:
            raise PaymentVerificationError(
                f"Transaction '{tx_hash_clean}' not found.",
                code="TRANSACTION_NOT_FOUND",
            )

        # 10. Convert quoted ETH amount to exact integer wei
        expected_wei = eth_to_wei(quote.amount)
        expected_provider = Web3.to_checksum_address(quote.provider_address or self.provider_wallet_address)

        # 11. Inspect on-chain payment facts
        # Check Topology A: AgentPay smart contract authorizePayment() event log
        verified_via_contract = False
        logs = receipt.get("logs", [])
        for log in logs:
            topics = log.get("topics", [])
            if not topics:
                continue

            topic0 = HexBytes(topics[0]).to_0x_hex().lower()
            if topic0 == PAYMENT_AUTHORIZED_TOPIC.lower():
                # Verify contract address if configured
                if self.contract_address:
                    log_addr = Web3.to_checksum_address(log.get("address", ""))
                    if log_addr != self.contract_address:
                        continue

                # Topic 1: requestId (bytes32)
                # Topic 2: provider (address padded to 32 bytes)
                if len(topics) >= 3:
                    log_provider_raw = HexBytes(topics[2]).to_0x_hex()
                    log_provider = Web3.to_checksum_address("0x" + log_provider_raw[-40:])

                    # Decode event data: (string service, uint256 amount, uint256 totalSpent, uint256 remainingBudget)
                    data_bytes = HexBytes(log.get("data", b""))
                    try:
                        decoded_data = eth_abi.decode(["string", "uint256", "uint256", "uint256"], data_bytes)
                        amount_wei = decoded_data[1]
                    except Exception as dec_err:
                        raise PaymentVerificationError(
                            f"Failed to decode PaymentAuthorized event data: {dec_err}",
                            code="EVENT_DECODE_ERROR",
                        ) from dec_err

                    # Verify recipient
                    if log_provider != expected_provider:
                        raise PaymentVerificationError(
                            f"Recipient address mismatch in contract payment: expected '{expected_provider}', got '{log_provider}'.",
                            code="RECIPIENT_MISMATCH",
                        )

                    # Verify amount in wei
                    if amount_wei != expected_wei:
                        raise PaymentVerificationError(
                            f"Payment amount mismatch in contract payment: expected {expected_wei} wei ({quote.amount} ETH), got {amount_wei} wei.",
                            code="AMOUNT_MISMATCH",
                        )

                    # Verify request_id if quote has a 32-byte hex request_id
                    clean_req_id = quote.request_id.strip()
                    if clean_req_id.startswith("0x") and len(clean_req_id) == 66:
                        log_req_id = HexBytes(topics[1]).to_0x_hex().lower()
                        if log_req_id != clean_req_id.lower():
                            raise PaymentVerificationError(
                                f"Request ID mismatch in contract payment: expected '{clean_req_id}', got '{log_req_id}'.",
                                code="REQUEST_ID_MISMATCH",
                            )

                    verified_via_contract = True
                    break

        # Check Topology B: Direct Native ETH transfer (if not verified via AgentPay contract event)
        if not verified_via_contract:
            tx_to = Web3.to_checksum_address(tx.get("to")) if tx.get("to") else None
            tx_val = tx.get("value", 0)

            if tx_to == expected_provider:
                if tx_val != expected_wei:
                    raise PaymentVerificationError(
                        f"Direct ETH payment amount mismatch: expected {expected_wei} wei ({quote.amount} ETH), got {tx_val} wei.",
                        code="AMOUNT_MISMATCH",
                    )
            else:
                raise PaymentVerificationError(
                    f"Transaction '{tx_hash_clean}' did not pay quoted provider address '{expected_provider}'.",
                    code="RECIPIENT_MISMATCH",
                )

        # 12. Mark quote as PAID and record Payment in DB
        quote.status = QuoteStatus.PAID
        payer = tx.get("from") or proof.payer_address

        payment = Payment(
            quote_id=quote.id,
            request_id=quote.request_id,
            tx_hash=tx_hash_clean,
            payer_address=Web3.to_checksum_address(payer) if Web3.is_address(payer) else str(payer),
            amount=quote.amount,
            verified_at=datetime.utcnow(),
        )

        db.add(payment)
        db.commit()
        db.refresh(payment)
        db.refresh(quote)

        return payment, quote


# ---------------------------------------------------------------------------
# Verifier Factory & Proxy
# ---------------------------------------------------------------------------

_active_verifier: Optional[AbstractPaymentVerifier] = None


def get_payment_verifier() -> AbstractPaymentVerifier:
    """Retrieve the globally configured payment verifier instance."""
    global _active_verifier
    if _active_verifier is not None:
        return _active_verifier

    if settings.PAYMENT_VERIFIER_TYPE == "on_chain":
        return OnChainPaymentVerifier()

    return MockPaymentVerifier()


def set_payment_verifier(verifier: Optional[AbstractPaymentVerifier]) -> None:
    """Set or override the active payment verifier (useful in integration testing)."""
    global _active_verifier
    _active_verifier = verifier


class PaymentVerifierProxy(AbstractPaymentVerifier):
    """
    Proxy object delegating dynamically to the active verifier.
    Ensures that existing imports (`from backend.app.core.payment_verifier import payment_verifier`)
    seamlessly respect runtime configuration and test overrides.
    """

    def verify_payment(self, db: Session, proof: PaymentVerifyRequest) -> Tuple[Payment, Quote]:
        return get_payment_verifier().verify_payment(db, proof)


payment_verifier = PaymentVerifierProxy()
