"""
Structured logging module for Person 2 (AI Agent + Payment).

Features:
- Structured format with timestamp, level, logger name, request_id, and stage.
- TargetedSecretFilter to protect private keys without obliterating public hex identifiers.
- Contextual logging preservation: request IDs, transaction hashes, contract addresses,
  and provider addresses are explicitly preserved.
"""

import logging
import re
import threading
from typing import Optional, Set

_LOCK = threading.Lock()
_REGISTERED_SECRETS: Set[str] = set()

# Targeted regex patterns for explicitly labeled secrets (e.g. private_key=... or secret: ...)
_LABELED_SECRET_PATTERN = re.compile(
    r"(?i)\b(private[_-]?key|secret|authorization|api[_-]?key)\s*([:=])\s*['\"]?([a-zA-Z0-9_\-]{8,})['\"]?",
)


def register_secret(secret: Optional[str]) -> None:
    """
    Register a sensitive string (e.g. private key value) to be scrubbed by the logger.
    Only non-empty secrets of length >= 8 are registered to avoid accidental short string collisions.
    """
    if not secret:
        return
    cleaned = secret.strip()
    if len(cleaned) >= 8:
        with _LOCK:
            _REGISTERED_SECRETS.add(cleaned)


def clear_secrets() -> None:
    """Clear all registered secrets (useful in testing)."""
    with _LOCK:
        _REGISTERED_SECRETS.clear()


class TargetedSecretFilter(logging.Filter):
    """
    Scrub registered secrets and labeled sensitive parameters from log records.

    ARCHITECTURAL RULE:
    Preserves normal hex identifiers such as request_id, transaction_hash,
    contract_address, and provider addresses. Never blindly masks 64-char hex strings.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # Mask message text
        if isinstance(record.msg, str):
            record.msg = self._sanitize_text(record.msg)

        # Mask args if string arguments were passed
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self._sanitize_value(v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self._sanitize_value(arg) for arg in record.args)

        # Ensure contextual fields exist on record
        if not hasattr(record, "request_id") or record.request_id is None:
            record.request_id = "-"
        if not hasattr(record, "stage") or record.stage is None:
            record.stage = "-"

        return True

    def _sanitize_value(self, val: object) -> object:
        if isinstance(val, str):
            return self._sanitize_text(val)
        return val

    def _sanitize_text(self, text: str) -> str:
        # First scrub labeled secrets (e.g., private_key=0x123...)
        sanitized = _LABELED_SECRET_PATTERN.sub(r"\1\2[REDACTED_SECRET]", text)

        # Next scrub exact registered secret values
        with _LOCK:
            secrets_copy = list(_REGISTERED_SECRETS)

        for secret in secrets_copy:
            if secret in sanitized:
                sanitized = sanitized.replace(secret, "[REDACTED_SECRET]")

        return sanitized


class ContextualFormatter(logging.Formatter):
    """
    Formatter producing structured logs with request_id and stage context.
    """

    DEFAULT_FORMAT = (
        "%(asctime)s [%(levelname)s] [%(name)s] [req:%(request_id)s] [stage:%(stage)s] %(message)s"
    )

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None) -> None:
        super().__init__(fmt=fmt or self.DEFAULT_FORMAT, datefmt=datefmt or "%Y-%m-%d %H:%M:%S")


def configure_logging(
    level: str = "INFO",
    handler: Optional[logging.Handler] = None,
    clear_handlers: bool = True,
) -> None:
    """
    Configure the root agent logger hierarchy with targeted secret filtering and contextual formatting.
    """
    agent_logger = logging.getLogger("agent")
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    agent_logger.setLevel(numeric_level)

    target_handler = handler or logging.StreamHandler()
    target_handler.setFormatter(ContextualFormatter())
    if not any(isinstance(f, TargetedSecretFilter) for f in target_handler.filters):
        target_handler.addFilter(TargetedSecretFilter())

    if clear_handlers or handler is not None:
        agent_logger.handlers.clear()
        agent_logger.addHandler(target_handler)
    elif not agent_logger.handlers:
        agent_logger.addHandler(target_handler)

    agent_logger.propagate = False


def get_logger(name: str) -> logging.Logger:
    """
    Obtain a named logger scoped under the 'agent' namespace.
    """
    if not name.startswith("agent"):
        logger_name = f"agent.{name}"
    else:
        logger_name = name

    logger = logging.getLogger(logger_name)
    # Ensure default filter is on the logger if no handlers are set up yet
    if not any(isinstance(f, TargetedSecretFilter) for f in logger.filters):
        logger.addFilter(TargetedSecretFilter())
    return logger
