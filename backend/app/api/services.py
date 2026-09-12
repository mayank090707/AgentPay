import json
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.schemas.service import (
    PricingCatalogResponse,
    TranslationRequest,
    ComputeRequest,
    StorageRequest,
    PaymentRequiredResponse,
    ServiceSuccessResponse,
    PaymentProof
)
from backend.app.core.pricing import get_pricing_catalog, calculate_service_price
from backend.app.core.payment_verifier import payment_verifier, PaymentVerificationError
from backend.app.core.hashing import compute_input_hash, compute_content_hash
from backend.app.core.receipt_generator import generate_payment_receipt
from backend.app.core.audit_logger import log_audit_event
from backend.app.models.quote import Quote, QuoteStatus
from backend.app.models.delivery import Delivery
from backend.app.models.payment import Payment

# Import simulated service functions
from backend.app.services.translation import translate_text
from backend.app.services.compute import run_compute
from backend.app.services.storage import store_object

router = APIRouter(prefix="/services", tags=["Services & HTTP 402"])


@router.get("/pricing", response_model=PricingCatalogResponse)
def list_service_pricing():
    """Retrieve public pricing catalog and provider wallet details."""
    return get_pricing_catalog()


def parse_payment_proof(x_payment_proof: Optional[str]) -> Optional[PaymentProof]:
    """Helper to parse payment proof from request header."""
    if not x_payment_proof:
        return None
    try:
        data = json.loads(x_payment_proof)
        return PaymentProof(
            quote_id=data.get("quote_id", ""),
            tx_hash=data.get("tx_hash", ""),
            payer_address=data.get("payer_address", data.get("payer", ""))
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Payment-Proof header JSON format."
        )


def handle_service_execution(
    service_type: str,
    payload: dict,
    x_payment_proof: Optional[str],
    db: Session
):
    """
    Core HTTP 402 Handshake & Service Execution Handler.
    """
    proof = parse_payment_proof(x_payment_proof)

    # ----------------------------------------------------
    # STEP 1: UNPAID REQUEST -> ISSUE HTTP 402 PAYMENT QUOTE
    # ----------------------------------------------------
    if not proof or not proof.quote_id or not proof.tx_hash:
        request_id = str(uuid.uuid4())
        quote_amount = calculate_service_price(service_type, payload)
        now = datetime.utcnow()
        expires_at = now + timedelta(seconds=settings.QUOTE_EXPIRY_SECONDS)

        quote = Quote(
            request_id=request_id,
            service_type=service_type,
            amount=quote_amount,
            currency="USDC",
            provider_address=settings.PROVIDER_WALLET_ADDRESS,
            status=QuoteStatus.PENDING,
            created_at=now,
            expires_at=expires_at
        )
        db.add(quote)
        db.commit()
        db.refresh(quote)

        # Log quote creation in audit trail
        log_audit_event(
            db=db,
            request_id=request_id,
            event_type="QUOTE_CREATED",
            details={
                "quote_id": quote.id,
                "service_type": service_type,
                "amount": quote_amount,
                "currency": "USDC",
                "expires_at": expires_at.isoformat()
            }
        )

        challenge_payload = PaymentRequiredResponse(
            error="Payment Required",
            message="Payment quote issued. Please pay on-chain and resubmit request with header X-Payment-Proof.",
            request_id=request_id,
            quote_id=quote.id,
            service_type=service_type,
            amount=quote_amount,
            currency="USDC",
            pay_to_address=settings.PROVIDER_WALLET_ADDRESS,
            expires_at=expires_at.isoformat()
        )

        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content=challenge_payload.model_dump(),
            headers={
                "X-Payment-Required": "true",
                "X-Payment-Quote-Id": quote.id,
                "X-Payment-Amount": str(quote_amount),
                "X-Payment-Asset": "USDC",
                "X-Payment-Address": settings.PROVIDER_WALLET_ADDRESS,
                "X-Request-ID": request_id
            }
        )

    # ----------------------------------------------------
    # STEP 2: PAID REQUEST -> VERIFY PAYMENT & DELIVER SERVICE
    # ----------------------------------------------------
    quote = db.query(Quote).filter(Quote.id == proof.quote_id).first()
    if not quote:
        log_audit_event(
            db=db,
            request_id="UNKNOWN",
            event_type="PAYMENT_VERIFICATION_FAILED",
            details={"quote_id": proof.quote_id, "error": f"Quote '{proof.quote_id}' not found.", "code": "QUOTE_NOT_FOUND"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment verification failed: Quote '{proof.quote_id}' not found."
        )

    # Check whether delivery already exists for this quote
    existing_delivery = db.query(Delivery).filter(Delivery.quote_id == quote.id).first()
    if existing_delivery:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Service has already been delivered for quote '{quote.id}'."
        )

    if quote.status == QuoteStatus.PAID:
        payment = db.query(Payment).filter(Payment.quote_id == quote.id).first()
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quote '{quote.id}' is marked PAID but payment record was not found."
            )
        if payment.tx_hash != proof.tx_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Submitted transaction hash does not match the payment record for quote '{quote.id}'."
            )
    elif quote.status == QuoteStatus.PENDING:
        try:
            from backend.app.schemas.payment import PaymentVerifyRequest
            verify_req = PaymentVerifyRequest(
                quote_id=proof.quote_id,
                tx_hash=proof.tx_hash,
                payer_address=proof.payer_address or "0xClientPayerAddress"
            )
            payment, quote = payment_verifier.verify_payment(db, verify_req)
        except PaymentVerificationError as e:
            log_audit_event(
                db=db,
                request_id=quote.request_id if quote else "UNKNOWN",
                event_type="PAYMENT_VERIFICATION_FAILED",
                details={"quote_id": proof.quote_id, "error": e.message, "code": e.code}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment verification failed: {e.message}"
            )

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
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment verification failed: Quote '{quote.id}' is {quote.status.value}."
        )

    # Execute service payload
    if service_type == "translation":
        service_data = translate_text(
            text=payload.get("text", ""),
            source_lang=payload.get("source_lang", "auto"),
            target_lang=payload.get("target_lang", "en")
        )
    elif service_type == "compute":
        service_data = run_compute(
            operation=payload.get("operation", "matrix_multiply"),
            params=payload.get("params", {})
        )
    elif service_type == "storage":
        service_data = store_object(
            key=payload.get("key", "default"),
            value=payload.get("value", ""),
            ttl_seconds=payload.get("ttl_seconds", 3600)
        )
    else:
        service_data = {"result": "processed", "payload": payload}

    # Compute hashes & receipt
    input_hash = compute_input_hash(payload)
    content_hash = compute_content_hash(service_data)
    receipt = generate_payment_receipt(quote, payment, content_hash)

    # Save Delivery Record
    delivery = Delivery(
        request_id=quote.request_id,
        quote_id=quote.id,
        service_type=service_type,
        input_hash=input_hash,
        content_hash=content_hash,
        receipt_id=receipt.receipt_id,
        receipt_signature=receipt.signature,
        delivered_at=datetime.utcnow()
    )
    db.add(delivery)
    db.commit()

    log_audit_event(
        db=db,
        request_id=quote.request_id,
        event_type="SERVICE_DELIVERED",
        details={
            "service_type": service_type,
            "content_hash": content_hash,
            "receipt_id": receipt.receipt_id,
            "receipt_signature": receipt.signature
        }
    )

    return ServiceSuccessResponse(
        status="success",
        request_id=quote.request_id,
        service_type=service_type,
        data=service_data,
        content_hash=content_hash,
        receipt=receipt.model_dump()
    )


@router.post("/translate")
def service_translate(
    request: TranslationRequest,
    x_payment_proof: Optional[str] = Header(None, alias="X-Payment-Proof"),
    db: Session = Depends(get_db)
):
    """
    Simulated AI Translation Service endpoint with HTTP 402 payment flow.
    """
    return handle_service_execution("translation", request.model_dump(), x_payment_proof, db)


@router.post("/compute")
def service_compute(
    request: ComputeRequest,
    x_payment_proof: Optional[str] = Header(None, alias="X-Payment-Proof"),
    db: Session = Depends(get_db)
):
    """
    Simulated Heavy Compute Execution endpoint with HTTP 402 payment flow.
    """
    return handle_service_execution("compute", request.model_dump(), x_payment_proof, db)


@router.post("/storage")
def service_storage(
    request: StorageRequest,
    x_payment_proof: Optional[str] = Header(None, alias="X-Payment-Proof"),
    db: Session = Depends(get_db)
):
    """
    Simulated Cloud / IPFS Storage endpoint with HTTP 402 payment flow.
    """
    return handle_service_execution("storage", request.model_dump(), x_payment_proof, db)
