from typing import Dict, Any, List
from datetime import datetime
from pydantic import BaseModel


class AuditLogItem(BaseModel):
    id: str
    request_id: str
    event_type: str
    details: Dict[str, Any]
    timestamp: datetime


class AuditLogsResponse(BaseModel):
    total: int
    logs: List[AuditLogItem]


class AuditVerificationResponse(BaseModel):
    request_id: str
    is_valid: bool
    status: str
    audit_trail: List[AuditLogItem]
    content_hash_matches: bool
    receipt_signature_valid: bool
    summary: str
