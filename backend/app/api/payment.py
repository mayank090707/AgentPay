from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.payment import PaymentVerifyRequest, PaymentVerifyResponse
from backend.app.models.quote import Quote
from backend.app.core.payment_verifier import payment_verifier, PaymentVerificationError
from backend.app.core.audit_logger import log_audit_event

router = APIRouter(prefix="/payment", tags=["Payment Verification"])


@router.post("/verify", response_model=PaymentVerifyResponse)
def verify_payment_endpoint(
    request: PaymentVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Independent endpoint to verify payment transactions for a quote.
    """
    try:
        payment, quote = payment_verifier.verify_payment(db, request)
        log_audit_event(
            db=db,
            request_id=quote.request_id,
            event_type="PAYMENT_VERIFIED",
            details={
                "quote_id": quote.id,
                "tx_hash": payment.tx_hash,
                "payer": payment.payer_address,
                "amount": payment.amount
            }
        )
        return PaymentVerifyResponse(
            status="PAID",
            quote_id=quote.id,
            request_id=quote.request_id,
            tx_hash=payment.tx_hash,
            amount=payment.amount,
            currency=quote.currency,
            verified_at=payment.verified_at
        )
    except PaymentVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )


@router.get("/quote/{quote_id}")
def get_quote_status(
    quote_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve quote status by quote_id.
    """
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quote ID '{quote_id}' not found."
        )
    return {
        "quote_id": quote.id,
        "request_id": quote.request_id,
        "service_type": quote.service_type,
        "amount": quote.amount,
        "currency": quote.currency,
        "status": quote.status,
        "created_at": quote.created_at,
        "expires_at": quote.expires_at
    }
