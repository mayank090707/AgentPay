import hmac
import hashlib
import uuid
from datetime import datetime
from typing import Dict, Any

from backend.app.config import settings
from backend.app.models.quote import Quote
from backend.app.models.payment import Payment
from backend.app.schemas.receipt import ReceiptResponse


def create_receipt_signature(
    receipt_id: str,
    request_id: str,
    quote_id: str,
    tx_hash: str,
    content_hash: str,
    amount: float,
    payer_address: str,
    secret_key: str = settings.HMAC_SECRET
) -> str:
    """
    Computes a cryptographic HMAC-SHA256 signature for the receipt fields.
    """
    signature_base = f"{receipt_id}:{request_id}:{quote_id}:{tx_hash}:{content_hash}:{amount:.4f}:{payer_address}:{settings.PROVIDER_WALLET_ADDRESS}"
    return hmac.new(
        secret_key.encode('utf-8'),
        signature_base.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


def generate_payment_receipt(
    quote: Quote,
    payment: Payment,
    content_hash: str
) -> ReceiptResponse:
    """
    Generates a cryptographically signed receipt object for a completed service delivery.
    """
    receipt_id = str(uuid.uuid4())
    delivered_at = datetime.utcnow()
    
    signature = create_receipt_signature(
        receipt_id=receipt_id,
        request_id=quote.request_id,
        quote_id=quote.id,
        tx_hash=payment.tx_hash,
        content_hash=content_hash,
        amount=payment.amount,
        payer_address=payment.payer_address
    )
    
    return ReceiptResponse(
        receipt_id=receipt_id,
        request_id=quote.request_id,
        quote_id=quote.id,
        tx_hash=payment.tx_hash,
        service_type=quote.service_type,
        amount=payment.amount,
        currency=quote.currency,
        payer_address=payment.payer_address,
        provider_address=settings.PROVIDER_WALLET_ADDRESS,
        content_hash=content_hash,
        delivered_at=delivered_at,
        signature=signature
    )


def verify_receipt_signature(receipt: ReceiptResponse) -> bool:
    """
    Verifies the HMAC-SHA256 signature of a receipt object.
    """
    expected_sig = create_receipt_signature(
        receipt_id=receipt.receipt_id,
        request_id=receipt.request_id,
        quote_id=receipt.quote_id,
        tx_hash=receipt.tx_hash,
        content_hash=receipt.content_hash,
        amount=receipt.amount,
        payer_address=receipt.payer_address
    )
    return hmac.compare_digest(expected_sig, receipt.signature)
