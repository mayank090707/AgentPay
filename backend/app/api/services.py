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
from backend.app.core.provider_registry import get_provider

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
    db: Session,
    provider_id: Optional[str] = None,
    x_request_id: Optional[str] = None,
):
    """
    Core HTTP 402 Handshake & Service Execution Handler.
    """
    # --------------------------------------------------
    # Resolve provider wallet address
    # --------------------------------------------------
    if provider_id is not None:
        provider = get_provider(provider_id)
        if provider is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider '{provider_id}' not found. Call GET /providers to list available providers."
            )
        resolved_wallet = provider.wallet_address
    else:
        resolved_wallet = settings.PROVIDER_WALLET_ADDRESS

    input_hash = compute_input_hash(payload)
    clean_request_id = x_request_id.strip() if x_request_id and x_request_id.strip() else None
    proof = parse_payment_proof(x_payment_proof)

    # -------------------------------------------------------------------------
    # IDEMPOTENCY & CONFLICT CHECK: PRIOR DELIVERY FOR THIS REQUEST_ID
    # -------------------------------------------------------------------------
    delivery_lookup_id = clean_request_id
    if not delivery_lookup_id and proof and proof.quote_id:
        prior_q = db.query(Quote).filter(Quote.id == proof.quote_id).first()
        if prior_q:
            delivery_lookup_id = prior_q.request_id

    if delivery_lookup_id:
        existing_delivery = db.query(Delivery).filter(Delivery.request_id == delivery_lookup_id).first()
        if existing_delivery:
            # Same request_id + different payload -> 409 Conflict
            if existing_delivery.input_hash != input_hash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="REQUEST_ID_REUSE_CONFLICT"
                )
            # Idempotent replay: return exact persisted successful response without re-executing
            if existing_delivery.output_data:
                try:
                    s_data = json.loads(existing_delivery.output_data)
                except Exception:
                    s_data = {"result": "processed", "payload": payload}
            else:
                s_data = {"result": "processed", "payload": payload}

            if existing_delivery.receipt_json:
                try:
                    r_data = json.loads(existing_delivery.receipt_json)
                except Exception:
                    r_data = {}
            else:
                r_data = {}

            if not r_data:
                q_rec = db.query(Quote).filter(Quote.id == existing_delivery.quote_id).first()
                p_rec = db.query(Payment).filter(Payment.request_id == existing_delivery.request_id).first()
                r_data = {
                    "receipt_id": existing_delivery.receipt_id,
                    "request_id": existing_delivery.request_id,
                    "quote_id": existing_delivery.quote_id,
                    "tx_hash": p_rec.tx_hash if p_rec else "UNKNOWN",
                    "service_type": existing_delivery.service_type,
                    "amount": p_rec.amount if p_rec else (q_rec.amount if q_rec else 0.0),
                    "currency": q_rec.currency if q_rec else "USDC",
                    "payer_address": p_rec.payer_address if p_rec else "UNKNOWN",
                    "provider_address": q_rec.provider_address if q_rec else settings.PROVIDER_WALLET_ADDRESS,
                    "content_hash": existing_delivery.content_hash,
                    "delivered_at": existing_delivery.delivered_at.isoformat(),
                    "signature": existing_delivery.receipt_signature
                }

            return ServiceSuccessResponse(
                status="success",
                request_id=existing_delivery.request_id,
                service_type=existing_delivery.service_type,
                data=s_data,
                content_hash=existing_delivery.content_hash,
                receipt=r_data
            )

    # ----------------------------------------------------
    # STEP 1: UNPAID REQUEST -> ISSUE OR REUSE HTTP 402 PAYMENT QUOTE
    # ----------------------------------------------------
    if not proof or not proof.quote_id or not proof.tx_hash:
        if clean_request_id:
            existing_quote = db.query(Quote).filter(Quote.request_id == clean_request_id).order_by(Quote.created_at.desc()).first()
            if existing_quote:
                # Same request_id + different payload -> 409 Conflict
                if existing_quote.input_hash and existing_quote.input_hash != input_hash:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="REQUEST_ID_REUSE_CONFLICT"
                    )
                # Same request_id + same payload -> reuse pending quote if not expired
                if existing_quote.status == QuoteStatus.PENDING and datetime.utcnow() <= existing_quote.expires_at:
                    challenge_payload = PaymentRequiredResponse(
                        error="Payment Required",
                        message="Payment quote issued. Please pay on-chain and resubmit request with header X-Payment-Proof.",
                        request_id=existing_quote.request_id,
                        quote_id=existing_quote.id,
                        service_type=existing_quote.service_type,
                        amount=existing_quote.amount,
                        currency=existing_quote.currency,
                        pay_to_address=existing_quote.provider_address,
                        expires_at=existing_quote.expires_at.isoformat()
                    )
                    return JSONResponse(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        content=challenge_payload.model_dump(),
                        headers={
                            "X-Payment-Required": "true",
                            "X-Payment-Quote-Id": existing_quote.id,
                            "X-Payment-Amount": str(existing_quote.amount),
                            "X-Payment-Asset": existing_quote.currency,
                            "X-Payment-Address": existing_quote.provider_address,
                            "X-Request-ID": existing_quote.request_id
                        }
                    )

        request_id = clean_request_id or str(uuid.uuid4())
        # Use provider-specific pricing when a provider_id is supplied;
        # fall back to the default global pricing catalog otherwise.
        if provider_id is not None:
            from backend.app.core.provider_registry import get_provider as _gp
            _provider = _gp(provider_id)  # already validated above
            _price_per_unit = getattr(_provider.pricing, service_type.lower(), None)
            if _price_per_unit is not None:
                # Replicate unit calculation using the provider's price_per_unit
                from backend.app.api.providers import _calculate_provider_price
                quote_amount = _calculate_provider_price(service_type, _price_per_unit, payload)
            else:
                quote_amount = calculate_service_price(service_type, payload)
        else:
            quote_amount = calculate_service_price(service_type, payload)
        now = datetime.utcnow()
        expires_at = now + timedelta(seconds=settings.QUOTE_EXPIRY_SECONDS)

        quote = Quote(
            request_id=request_id,
            service_type=service_type,
            amount=quote_amount,
            currency="USDC",
            provider_address=resolved_wallet,
            status=QuoteStatus.PENDING,
            input_hash=input_hash,
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
            pay_to_address=resolved_wallet,
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
                "X-Payment-Address": resolved_wallet,
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
            request_id=clean_request_id or "UNKNOWN",
            event_type="PAYMENT_VERIFICATION_FAILED",
            details={"quote_id": proof.quote_id, "error": f"Quote '{proof.quote_id}' not found.", "code": "QUOTE_NOT_FOUND"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment verification failed: Quote '{proof.quote_id}' not found."
        )

    # Request ID mismatch check if supplied in header
    if clean_request_id and quote.request_id != clean_request_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="REQUEST_ID_REUSE_CONFLICT"
        )

    # Check payload match against quote's input_hash
    if quote.input_hash and quote.input_hash != input_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="REQUEST_ID_REUSE_CONFLICT"
        )

    # Check whether delivery already exists for this quote or request
    existing_delivery = db.query(Delivery).filter(
        (Delivery.quote_id == quote.id) | (Delivery.request_id == quote.request_id)
    ).first()
    if existing_delivery:
        if existing_delivery.input_hash != input_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="REQUEST_ID_REUSE_CONFLICT"
            )
        # Idempotent replay
        if existing_delivery.output_data:
            try:
                s_data = json.loads(existing_delivery.output_data)
            except Exception:
                s_data = {"result": "processed", "payload": payload}
        else:
            s_data = {"result": "processed", "payload": payload}

        if existing_delivery.receipt_json:
            try:
                r_data = json.loads(existing_delivery.receipt_json)
            except Exception:
                r_data = {}
        else:
            r_data = {}

        if not r_data:
            p_rec = db.query(Payment).filter(Payment.request_id == existing_delivery.request_id).first()
            r_data = {
                "receipt_id": existing_delivery.receipt_id,
                "request_id": existing_delivery.request_id,
                "quote_id": existing_delivery.quote_id,
                "tx_hash": p_rec.tx_hash if p_rec else "UNKNOWN",
                "service_type": existing_delivery.service_type,
                "amount": p_rec.amount if p_rec else quote.amount,
                "currency": quote.currency,
                "payer_address": p_rec.payer_address if p_rec else "UNKNOWN",
                "provider_address": quote.provider_address or settings.PROVIDER_WALLET_ADDRESS,
                "content_hash": existing_delivery.content_hash,
                "delivered_at": existing_delivery.delivered_at.isoformat(),
                "signature": existing_delivery.receipt_signature
            }

        return ServiceSuccessResponse(
            status="success",
            request_id=existing_delivery.request_id,
            service_type=existing_delivery.service_type,
            data=s_data,
            content_hash=existing_delivery.content_hash,
            receipt=r_data
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
    delivery_input_hash = compute_input_hash(payload)
    content_hash = compute_content_hash(service_data)
    receipt = generate_payment_receipt(quote, payment, content_hash)
    receipt_dict = receipt.model_dump(mode="json")

    # Save Delivery Record
    delivery = Delivery(
        request_id=quote.request_id,
        quote_id=quote.id,
        service_type=service_type,
        input_hash=delivery_input_hash,
        content_hash=content_hash,
        output_data=json.dumps(service_data),
        receipt_json=json.dumps(receipt_dict),
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
        receipt=receipt_dict
    )


@router.post("/translate")
def service_translate(
    request: TranslationRequest,
    x_payment_proof: Optional[str] = Header(None, alias="X-Payment-Proof"),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    db: Session = Depends(get_db)
):
    """
    Simulated AI Translation Service endpoint with HTTP 402 payment flow.
    """
    return handle_service_execution("translation", request.model_dump(), x_payment_proof, db, provider_id=request.provider_id, x_request_id=x_request_id)


@router.post("/compute")
def service_compute(
    request: ComputeRequest,
    x_payment_proof: Optional[str] = Header(None, alias="X-Payment-Proof"),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    db: Session = Depends(get_db)
):
    """
    Simulated Heavy Compute Execution endpoint with HTTP 402 payment flow.
    """
    return handle_service_execution("compute", request.model_dump(), x_payment_proof, db, provider_id=request.provider_id, x_request_id=x_request_id)


@router.post("/storage")
def service_storage(
    request: StorageRequest,
    x_payment_proof: Optional[str] = Header(None, alias="X-Payment-Proof"),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    db: Session = Depends(get_db)
):
    """
    Simulated Cloud / IPFS Storage endpoint with HTTP 402 payment flow.
    """
    return handle_service_execution("storage", request.model_dump(), x_payment_proof, db, provider_id=request.provider_id, x_request_id=x_request_id)

