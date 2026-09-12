import hashlib
import json
from typing import Any, Union


def compute_sha256(data: Union[str, bytes, dict]) -> str:
    """
    Computes a deterministic SHA-256 hash string for string, bytes, or dictionary inputs.
    """
    if isinstance(data, dict):
        # Sort keys deterministically for consistent JSON hashing
        data_bytes = json.dumps(data, sort_keys=True, separators=(',', ':')).encode('utf-8')
    elif isinstance(data, str):
        data_bytes = data.encode('utf-8')
    elif isinstance(data, bytes):
        data_bytes = data
    else:
        data_bytes = str(data).encode('utf-8')

    return hashlib.sha256(data_bytes).hexdigest()


def compute_input_hash(payload: Any) -> str:
    """Computes SHA-256 hash of service input parameters."""
    return compute_sha256(payload)


def compute_content_hash(output_payload: Any) -> str:
    """Computes SHA-256 hash of delivered service output data."""
    return compute_sha256(output_payload)
