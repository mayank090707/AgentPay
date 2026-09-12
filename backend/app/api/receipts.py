from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.quote import Quote
from backend.app.models.payment import Payment
from backend.app.models.delivery import Delivery
from backend.app.schemas.receipt import ReceiptResponse
from backend.app.config import settings

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.get("/{request_id}", response_model=ReceiptResponse)
def get_receipt_by_request_id(
    request_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve the signed receipt for a completed service request.
    """
    quote = db.query(Quote).filter(Quote.request_id == request_id).first()
    payment = db.query(Payment).filter(Payment.request_id == request_id).first()
    delivery = db.query(Delivery).filter(Delivery.request_id == request_id).first()

    if not quote or not payment or not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No completed delivery receipt found for request ID '{request_id}'."
        )

    return ReceiptResponse(
        receipt_id=delivery.receipt_id,
        request_id=request_id,
        quote_id=quote.id,
        tx_hash=payment.tx_hash,
        service_type=delivery.service_type,
        amount=payment.amount,
        currency=quote.currency,
        payer_address=payment.payer_address,
        provider_address=settings.PROVIDER_WALLET_ADDRESS,
        content_hash=delivery.content_hash,
        delivered_at=delivery.delivered_at,
        signature=delivery.receipt_signature
    )
