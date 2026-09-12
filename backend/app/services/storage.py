import hashlib
import time
from typing import Dict, Any, Optional


def store_object(key: str, value: str, ttl_seconds: Optional[int] = 3600) -> Dict[str, Any]:
    """
    Simulates decentralized / cloud storage service (e.g. IPFS / Arweave / S3).
    """
    start_time = time.time()
    
    value_bytes = value.encode('utf-8')
    size_bytes = len(value_bytes)
    size_mb = round(size_bytes / (1024 * 1024), 4)
    if size_mb == 0:
        size_mb = 0.001
        
    sha256_hash = hashlib.sha256(value_bytes).hexdigest()
    mock_cid = f"bafybeig{sha256_hash[:32]}"
    
    elapsed_ms = round((time.time() - start_time) * 1000 + 8, 2)
    
    return {
        "key": key,
        "content_identifier_cid": mock_cid,
        "payload_hash": sha256_hash,
        "size_bytes": size_bytes,
        "size_mb": size_mb,
        "ttl_seconds": ttl_seconds,
        "storage_location": f"ipfs://{mock_cid}/{key}",
        "status": "STORED",
        "timestamp_ms": int(time.time() * 1000),
        "write_latency_ms": elapsed_ms
    }
