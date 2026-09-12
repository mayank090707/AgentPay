from abc import ABC, abstractmethod
from datetime import datetime
from typing import Tuple, Optional
from sqlalchemy.orm import Session

from backend.app.models.quote import Quote, QuoteStatus
from backend.app.models.payment import Payment
from backend.app.schemas.payment import PaymentVerifyRequest


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
                code="DOUBLE_SPENDING_DETECTED"
            )

        # 5. Validate transaction hash format (Hex starting with 0x or mock_tx_)
        tx_hash_clean = proof.tx_hash.strip().lower()
        if not (tx_hash_clean.startswith("0x") or tx_hash_clean.startswith("mock_tx_")):
            raise PaymentVerificationError(
                f"Invalid transaction hash format '{proof.tx_hash}'. Expected hexadecimal hash or mock_tx_ prefix.",
                code="INVALID_TX_FORMAT"
            )

        # 6. Mark quote as PAID and record Payment
        quote.status = QuoteStatus.PAID
        
        payment = Payment(
            quote_id=quote.id,
            request_id=quote.request_id,
            tx_hash=proof.tx_hash,
            payer_address=proof.payer_address,
            amount=quote.amount,
            verified_at=datetime.utcnow()
        )
        
        db.add(payment)
        db.commit()
        db.refresh(payment)
        db.refresh(quote)

        return payment, quote


# Global default verifier instance
payment_verifier = MockPaymentVerifier()
