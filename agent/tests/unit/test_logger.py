"""Unit tests for structured logging and targeted secret masking."""

import io
import logging

from agent.src.logger import (
    clear_secrets,
    configure_logging,
    get_logger,
    register_secret,
)


def test_public_identifiers_preserved_in_logs() -> None:
    """
    CRITICAL ARCHITECTURAL TEST:
    Verify that request IDs, transaction hashes, and addresses are NOT masked by logger.
    """
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    configure_logging(level="DEBUG", handler=handler)

    logger = get_logger("test_identifiers")

    req_id = "0x" + "11" * 32
    tx_hash = "0x" + "22" * 32
    contract_addr = "0x" + "33" * 20
    provider_addr = "0x" + "44" * 20

    logger.info(
        f"Processing req={req_id} tx={tx_hash} contract={contract_addr} provider={provider_addr}",
        extra={"request_id": req_id, "stage": "PAYMENT_CONFIRMED"},
    )
    handler.flush()
    output = stream.getvalue()

    # All public hex identifiers must remain visible and legible
    assert req_id in output
    assert tx_hash in output
    assert contract_addr in output
    assert provider_addr in output
    assert "[req:" + req_id + "]" in output
    assert "[stage:PAYMENT_CONFIRMED]" in output


def test_registered_secret_masked() -> None:
    """Verify that explicitly registered secrets are scrubbed from log output."""
    clear_secrets()
    raw_secret = "0x9999999999999999999999999999999999999999999999999999999999999999"
    register_secret(raw_secret)

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    configure_logging(level="DEBUG", handler=handler)

    logger = get_logger("test_secrets")
    logger.info(f"Attempting signature with key {raw_secret}")
    handler.flush()
    output = stream.getvalue()

    assert raw_secret not in output
    assert "[REDACTED_SECRET]" in output
    clear_secrets()


def test_labeled_secret_masked() -> None:
    """Verify labeled parameters like private_key=... are scrubbed even if not pre-registered."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    configure_logging(level="DEBUG", handler=handler)

    logger = get_logger("test_labeled")
    logger.info("Connecting with private_key=0xabcdef1234567890abcdef")
    handler.flush()
    output = stream.getvalue()

    assert "0xabcdef1234567890abcdef" not in output
    assert "[REDACTED_SECRET]" in output


def test_contextual_defaults() -> None:
    """Verify contextual formatting outputs '-' when request_id or stage is not passed."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    configure_logging(level="INFO", handler=handler)

    logger = get_logger("test_defaults")
    logger.info("Generic message without context")
    handler.flush()
    output = stream.getvalue()

    assert "[req:-]" in output
    assert "[stage:-]" in output
    assert "Generic message without context" in output
