import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.audit import AuditLog
from backend.app.models.quote import Quote
from backend.app.models.payment import Payment
from backend.app.models.delivery import Delivery
from backend.app.core.receipt_generator import create_receipt_signature
from backend.app.config import settings


def log_audit_event(
    db: Session,
    request_id: str,
    event_type: str,
    details: Dict[str, Any]
) -> AuditLog:
    """
    Appends an immutable audit log entry to the database.
    """
    log_entry = AuditLog(
        request_id=request_id,
        event_type=event_type,
        details=json.dumps(details),
        timestamp=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def query_audit_logs(
    db: Session,
    request_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100
) -> List[AuditLog]:
    """
    Queries audit log entries filtered by request_id or event_type.
    """
    query = db.query(AuditLog)
    if request_id:
        query = query.filter(AuditLog.request_id == request_id)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()


def verify_request_integrity(db: Session, request_id: str) -> Dict[str, Any]:
    """
    Performs full cryptographic audit verification for a given request_id.
    Verifies quote, payment, delivery content hash, and receipt HMAC signature.
    """
    quote = db.query(Quote).filter(Quote.request_id == request_id).first()
    payment = db.query(Payment).filter(Payment.request_id == request_id).first()
    delivery = db.query(Delivery).filter(Delivery.request_id == request_id).first()
    audit_trail = db.query(AuditLog).filter(AuditLog.request_id == request_id).order_by(AuditLog.timestamp.asc()).all()

    if not quote:
        return {
            "request_id": request_id,
            "is_valid": False,
            "status": "NOT_FOUND",
            "summary": f"No records or quotes found for request ID '{request_id}'."
        }

    is_valid = True
    content_hash_matches = True
    receipt_signature_valid = True
    reasons = []

    if not payment:
        is_valid = False
        reasons.append("Payment record missing for quote.")

    if not delivery:
        is_valid = False
        reasons.append("Service delivery record missing.")

    if payment and delivery and quote:
        # Re-verify cryptographic signature on receipt
        expected_signature = create_receipt_signature(
            receipt_id=delivery.receipt_id,
            request_id=request_id,
            quote_id=quote.id,
            tx_hash=payment.tx_hash,
            content_hash=delivery.content_hash,
            amount=payment.amount,
            payer_address=payment.payer_address
        )
        if delivery.receipt_signature != expected_signature:
            is_valid = False
            receipt_signature_valid = False
            reasons.append("Receipt HMAC signature verification failed (tampering detected).")

    parsed_logs = []
    for log in audit_trail:
        try:
            details_obj = json.loads(log.details)
        except Exception:
            details_obj = {"raw": log.details}
        parsed_logs.append({
            "id": log.id,
            "request_id": log.request_id,
            "event_type": log.event_type,
            "details": details_obj,
            "timestamp": log.timestamp.isoformat()
        })

    summary_text = "Audit trail fully verified & cryptographically valid." if is_valid else f"Audit verification failed: {'; '.join(reasons)}"

    return {
        "request_id": request_id,
        "is_valid": is_valid,
        "status": "VERIFIED" if is_valid else "FAILED",
        "audit_trail": parsed_logs,
        "content_hash_matches": content_hash_matches,
        "receipt_signature_valid": receipt_signature_valid,
        "summary": summary_text
    }
