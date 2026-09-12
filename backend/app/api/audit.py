import json
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.audit import AuditLogsResponse, AuditLogItem, AuditVerificationResponse
from backend.app.core.audit_logger import query_audit_logs, verify_request_integrity

router = APIRouter(prefix="/audit", tags=["Audit & Security"])


@router.get("/logs", response_model=AuditLogsResponse)
def get_audit_logs(
    request_id: Optional[str] = Query(None, description="Filter logs by request ID"),
    event_type: Optional[str] = Query(None, description="Filter logs by event type (e.g. QUOTE_CREATED, PAYMENT_VERIFIED, SERVICE_DELIVERED)"),
    limit: int = Query(100, ge=1, le=1000, description="Max logs to return"),
    db: Session = Depends(get_db)
):
    """
    Query audit trail log records.
    """
    db_logs = query_audit_logs(db, request_id=request_id, event_type=event_type, limit=limit)
    items = []
    for log in db_logs:
        try:
            details_dict = json.loads(log.details)
        except Exception:
            details_dict = {"raw": log.details}

        items.append(AuditLogItem(
            id=log.id,
            request_id=log.request_id,
            event_type=event_type or log.event_type,
            details=details_dict,
            timestamp=log.timestamp
        ))

    return AuditLogsResponse(
        total=len(items),
        logs=items
    )


@router.get("/verify/{request_id}", response_model=AuditVerificationResponse)
def verify_audit_trail_endpoint(
    request_id: str,
    db: Session = Depends(get_db)
):
    """
    Cryptographic verification endpoint for a service request lifecycle.
    Validates quote, payment, service delivery, content hash, and HMAC receipt signature integrity.
    """
    result = verify_request_integrity(db, request_id)
    if result["status"] == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["summary"]
        )

    log_items = [
        AuditLogItem(
            id=item["id"],
            request_id=item["request_id"],
            event_type=item["event_type"],
            details=item["details"],
            timestamp=item["timestamp"]
        )
        for item in result["audit_trail"]
    ]

    return AuditVerificationResponse(
        request_id=result["request_id"],
        is_valid=result["is_valid"],
        status=result["status"],
        audit_trail=log_items,
        content_hash_matches=result["content_hash_matches"],
        receipt_signature_valid=result["receipt_signature_valid"],
        summary=result["summary"]
    )
