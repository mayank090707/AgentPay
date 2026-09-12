"""
Unit & integration tests for OnChainPaymentVerifier covering:
D. Successful on-chain verification using deterministic mock chain fixture
E. Wrong recipient rejection
F. Wrong amount rejection
G. Failed transaction rejection
H. Replayed tx/payment rejection
"""

from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
import eth_abi
from hexbytes import HexBytes
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from web3 import Web3

from backend.app.core.currency import eth_to_wei
from backend.app.core.payment_verifier import (
    OnChainPaymentVerifier,
    PaymentVerificationError,
    PAYMENT_AUTHORIZED_TOPIC,
)
from backend.app.database import Base
from backend.app.models.payment import Payment
from backend.app.models.quote import Quote, QuoteStatus
from backend.app.schemas.payment import PaymentVerifyRequest

# In-memory test db
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def mock_web3():
    """Mock Web3 instance simulating RPC calls."""
    w3 = MagicMock(spec=Web3)
    w3.eth = MagicMock()
    return w3


def create_test_quote(
    db,
    quote_id="quote-100",
    request_id="0x" + "aa" * 32,
    amount=0.05,
    currency="ETH",
    provider_address="0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    status=QuoteStatus.PENDING,
    expired=False,
):
    expires_at = datetime.utcnow() - timedelta(minutes=1) if expired else datetime.utcnow() + timedelta(minutes=5)
    quote = Quote(
        id=quote_id,
        request_id=request_id,
        service_type="compute",
        amount=amount,
        currency=currency,
        provider_address=Web3.to_checksum_address(provider_address),
        status=status,
        input_hash="hash123",
        created_at=datetime.utcnow(),
        expires_at=expires_at,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    return quote


# ==============================================================================
# D. Successful On-Chain Verification
# ==============================================================================

def test_onchain_verification_contract_event_success(db_session, mock_web3):
    """Verify OnChainPaymentVerifier successfully validates an AgentPay.sol PaymentAuthorized event."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    req_id = "0x" + "11" * 32
    tx_hash = "0x" + "ff" * 32
    agent_addr = "0x" + "22" * 20
    amount_eth = 0.05
    amount_wei = eth_to_wei(amount_eth)

    quote = create_test_quote(
        db=db_session,
        quote_id="q-contract-success",
        request_id=req_id,
        amount=amount_eth,
        provider_address=provider_addr,
    )

    # Encode PaymentAuthorized event data: (service, amount, totalSpent, remainingBudget)
    event_data = eth_abi.encode(
        ["string", "uint256", "uint256", "uint256"],
        ["compute", amount_wei, amount_wei, 990000000000000000],
    )

    # Pad provider address to 32 bytes for topic 2
    provider_topic = HexBytes(HexBytes(provider_addr).rjust(32, b"\0"))

    mock_receipt = {
        "status": 1,
        "logs": [
            {
                "topics": [
                    HexBytes(PAYMENT_AUTHORIZED_TOPIC),
                    HexBytes(req_id),
                    provider_topic,
                ],
                "data": HexBytes(event_data),
            }
        ],
    }
    mock_tx = {
        "hash": tx_hash,
        "from": agent_addr,
        "to": "0x" + "33" * 20,  # Contract address
        "value": 0,
    }

    mock_web3.eth.get_transaction_receipt.return_value = mock_receipt
    mock_web3.eth.get_transaction.return_value = mock_tx

    verifier = OnChainPaymentVerifier(
        provider_wallet_address=provider_addr,
        web3_instance=mock_web3,
    )

    proof = PaymentVerifyRequest(
        quote_id=quote.id,
        tx_hash=tx_hash,
        payer_address=agent_addr,
    )

    payment, updated_quote = verifier.verify_payment(db_session, proof)

    assert updated_quote.status == QuoteStatus.PAID
    assert payment.quote_id == quote.id
    assert payment.tx_hash == tx_hash
    assert payment.amount == amount_eth
    assert payment.payer_address == Web3.to_checksum_address(agent_addr)


def test_onchain_verification_direct_eth_transfer_success(db_session, mock_web3):
    """Verify OnChainPaymentVerifier successfully validates direct native ETH transfer to provider."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    tx_hash = "0x" + "ee" * 32
    payer_addr = "0x" + "55" * 20
    amount_eth = 0.02
    amount_wei = eth_to_wei(amount_eth)

    quote = create_test_quote(
        db=db_session,
        quote_id="q-direct-success",
        amount=amount_eth,
        provider_address=provider_addr,
    )

    mock_receipt = {"status": 1, "logs": []}
    mock_tx = {
        "hash": tx_hash,
        "from": payer_addr,
        "to": provider_addr,
        "value": amount_wei,
    }

    mock_web3.eth.get_transaction_receipt.return_value = mock_receipt
    mock_web3.eth.get_transaction.return_value = mock_tx

    verifier = OnChainPaymentVerifier(
        provider_wallet_address=provider_addr,
        web3_instance=mock_web3,
    )

    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash=tx_hash, payer_address=payer_addr)
    payment, updated_quote = verifier.verify_payment(db_session, proof)

    assert updated_quote.status == QuoteStatus.PAID
    assert payment.amount == amount_eth
    assert payment.tx_hash == tx_hash


# ==============================================================================
# E. Wrong Recipient Rejection
# ==============================================================================

def test_wrong_recipient_in_contract_log_rejected(db_session, mock_web3):
    """Verify contract payment log with wrong recipient address is rejected."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    wrong_provider = "0x" + "99" * 20
    tx_hash = "0x" + "dd" * 32
    amount_wei = eth_to_wei(0.05)

    quote = create_test_quote(
        db=db_session,
        quote_id="q-wrong-recipient",
        amount=0.05,
        provider_address=provider_addr,
    )

    event_data = eth_abi.encode(
        ["string", "uint256", "uint256", "uint256"],
        ["compute", amount_wei, amount_wei, 990000000000000000],
    )
    wrong_topic = HexBytes(HexBytes(wrong_provider).rjust(32, b"\0"))

    mock_web3.eth.get_transaction_receipt.return_value = {
        "status": 1,
        "logs": [
            {
                "topics": [
                    HexBytes(PAYMENT_AUTHORIZED_TOPIC),
                    HexBytes(quote.request_id),
                    wrong_topic,
                ],
                "data": HexBytes(event_data),
            }
        ],
    }
    mock_web3.eth.get_transaction.return_value = {"hash": tx_hash, "from": "0x1", "to": "0x2", "value": 0}

    verifier = OnChainPaymentVerifier(provider_wallet_address=provider_addr, web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash=tx_hash, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "RECIPIENT_MISMATCH"
    assert "Recipient address mismatch" in exc_info.value.message


# ==============================================================================
# F. Wrong Amount Rejection
# ==============================================================================

def test_wrong_amount_in_contract_log_rejected(db_session, mock_web3):
    """Verify contract payment log with lower amount than quoted is rejected."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    tx_hash = "0x" + "cc" * 32
    quoted_amount = 0.05
    paid_amount_wei = eth_to_wei(0.01)  # Underpayment!

    quote = create_test_quote(
        db=db_session,
        quote_id="q-wrong-amount",
        amount=quoted_amount,
        provider_address=provider_addr,
    )

    event_data = eth_abi.encode(
        ["string", "uint256", "uint256", "uint256"],
        ["compute", paid_amount_wei, paid_amount_wei, 990000000000000000],
    )
    provider_topic = HexBytes(HexBytes(provider_addr).rjust(32, b"\0"))

    mock_web3.eth.get_transaction_receipt.return_value = {
        "status": 1,
        "logs": [
            {
                "topics": [
                    HexBytes(PAYMENT_AUTHORIZED_TOPIC),
                    HexBytes(quote.request_id),
                    provider_topic,
                ],
                "data": HexBytes(event_data),
            }
        ],
    }
    mock_web3.eth.get_transaction.return_value = {"hash": tx_hash, "from": "0x1", "to": "0x2", "value": 0}

    verifier = OnChainPaymentVerifier(provider_wallet_address=provider_addr, web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash=tx_hash, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "AMOUNT_MISMATCH"
    assert "Payment amount mismatch" in exc_info.value.message


# ==============================================================================
# G. Failed Transaction Rejection
# ==============================================================================

def test_reverted_transaction_rejected(db_session, mock_web3):
    """Verify transaction with receipt.status == 0 is rejected."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    tx_hash = "0x" + "bb" * 32

    quote = create_test_quote(db=db_session, quote_id="q-reverted", provider_address=provider_addr)

    mock_web3.eth.get_transaction_receipt.return_value = {"status": 0, "logs": []}

    verifier = OnChainPaymentVerifier(provider_wallet_address=provider_addr, web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash=tx_hash, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "TRANSACTION_REVERTED"
    assert "reverted or failed" in exc_info.value.message


def test_transaction_not_found_rejected(db_session, mock_web3):
    """Verify non-existent or unmined transaction is rejected."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    tx_hash = "0x" + "aa" * 32

    quote = create_test_quote(db=db_session, quote_id="q-not-found", provider_address=provider_addr)

    mock_web3.eth.get_transaction_receipt.return_value = None

    verifier = OnChainPaymentVerifier(provider_wallet_address=provider_addr, web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash=tx_hash, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "TRANSACTION_NOT_FOUND"


# ==============================================================================
# H. Replayed Tx / Payment Rejection
# ==============================================================================

def test_double_spending_replayed_tx_hash_rejected(db_session, mock_web3):
    """Verify attempting to reuse an already processed tx_hash for a second quote is rejected."""
    provider_addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    tx_hash = "0x" + "77" * 32

    # Existing payment in DB with this tx_hash
    prior_payment = Payment(
        quote_id="prior-quote",
        request_id="prior-request",
        tx_hash=tx_hash,
        payer_address="0x1",
        amount=0.01,
        verified_at=datetime.utcnow(),
    )
    db_session.add(prior_payment)
    db_session.commit()

    # New quote attempting to claim same tx_hash
    new_quote = create_test_quote(db=db_session, quote_id="q-new", provider_address=provider_addr)

    verifier = OnChainPaymentVerifier(provider_wallet_address=provider_addr, web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=new_quote.id, tx_hash=tx_hash, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "DOUBLE_SPENDING_DETECTED"
    assert "Double-spending attempt rejected" in exc_info.value.message


def test_quote_already_paid_rejected(db_session, mock_web3):
    """Verify re-submitting payment for a quote already marked PAID is rejected."""
    quote = create_test_quote(db=db_session, quote_id="q-already-paid", status=QuoteStatus.PAID)
    verifier = OnChainPaymentVerifier(web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash="0x" + "11" * 32, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "QUOTE_ALREADY_PAID"


def test_expired_quote_rejected(db_session, mock_web3):
    """Verify submitting payment proof for an expired quote is rejected."""
    quote = create_test_quote(db=db_session, quote_id="q-expired", expired=True)
    verifier = OnChainPaymentVerifier(web3_instance=mock_web3)
    proof = PaymentVerifyRequest(quote_id=quote.id, tx_hash="0x" + "11" * 32, payer_address="0x1")

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, proof)

    assert exc_info.value.code == "QUOTE_EXPIRED"


def test_invalid_tx_hash_format_rejected(db_session, mock_web3):
    """Verify invalid tx_hash string formats are rejected."""
    quote = create_test_quote(db=db_session, quote_id="q-invalid-tx")
    verifier = OnChainPaymentVerifier(web3_instance=mock_web3)

    with pytest.raises(PaymentVerificationError) as exc_info:
        verifier.verify_payment(db_session, PaymentVerifyRequest(quote_id=quote.id, tx_hash="not_a_hex", payer_address="0x1"))

    assert exc_info.value.code == "INVALID_TX_FORMAT"
