"""
Integration tests for ContractClient with AgentPay.sol canonical ABI and custom error decoding.
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch
from hexbytes import HexBytes
import pytest
from pydantic import SecretStr

from agent.src.contract_client import ContractClient, to_bytes32
from agent.src.exceptions import (
    BudgetExceededError,
    ConfigurationError,
    DuplicateRequestError,
    UnauthorizedAgentError,
)
from agent.src.models import PaymentStatus, RequestId


def test_canonical_abi_loading() -> None:
    """Verify ContractClient loads the actual canonical ABI from contracts/artifacts-export/AgentPay.json."""
    client = ContractClient(
        contract_address="0x" + "11" * 20,
        agent_address="0x" + "22" * 20,
        agent_private_key=SecretStr("0x" + "aa" * 32),
    )
    assert client.abi is not None
    assert len(client.abi) > 0

    # Verify key function signatures from AgentPay.sol exist in ABI
    func_names = [item.get("name") for item in client.abi if item.get("type") == "function"]
    assert "authorizePayment" in func_names
    assert "recordDelivery" in func_names
    assert "isProcessed" in func_names
    assert "getBudgetStatus" in func_names
    assert "getContractBalance" in func_names

    # Verify custom errors exist in ABI
    error_names = [item.get("name") for item in client.abi if item.get("type") == "error"]
    assert "BudgetExceeded" in error_names
    assert "HardCapExceeded" in error_names
    assert "AlreadyProcessed" in error_names
    assert "NotAgent" in error_names


def test_to_bytes32_formatting() -> None:
    """Verify to_bytes32 accurately handles 32-byte hex strings and RequestIds."""
    req_id = RequestId.generate()
    b32 = to_bytes32(req_id)
    assert isinstance(b32, HexBytes)
    assert len(b32) == 32
    assert b32.to_0x_hex() == str(req_id).lower()

    # Content hash (SHA-256 without 0x)
    raw_sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    b32_hash = to_bytes32(raw_sha256)
    assert len(b32_hash) == 32
    assert b32_hash.to_0x_hex() == f"0x{raw_sha256}"


def test_contract_revert_budget_exceeded_mapping() -> None:
    """Verify custom error BudgetExceeded is mapped to BudgetExceededError."""
    client = ContractClient(
        contract_address="0x" + "11" * 20,
        agent_address="0x" + "22" * 20,
        agent_private_key=SecretStr("0x" + "aa" * 32),
    )

    with pytest.raises(BudgetExceededError) as exc_info:
        client._handle_revert(Exception("execution reverted: custom error 0x028d7b37 (BudgetExceeded)"), "0x123")

    assert exc_info.value.code == "BUDGET_EXCEEDED"
    assert "budget exceeded" in str(exc_info.value).lower()


def test_contract_revert_already_processed_mapping() -> None:
    """Verify custom error AlreadyProcessed is mapped to DuplicateRequestError."""
    client = ContractClient(
        contract_address="0x" + "11" * 20,
        agent_address="0x" + "22" * 20,
        agent_private_key=SecretStr("0x" + "aa" * 32),
    )

    with pytest.raises(DuplicateRequestError) as exc_info:
        client._handle_revert(Exception("execution reverted: custom error 0x1f274737 (AlreadyProcessed)"), "0x123")

    assert exc_info.value.code == "ALREADY_PROCESSED"


def test_contract_revert_not_agent_mapping() -> None:
    """Verify custom error NotAgent is mapped to UnauthorizedAgentError."""
    client = ContractClient(
        contract_address="0x" + "11" * 20,
        agent_address="0x" + "22" * 20,
        agent_private_key=SecretStr("0x" + "aa" * 32),
    )

    with pytest.raises(UnauthorizedAgentError) as exc_info:
        client._handle_revert(Exception("execution reverted: custom error 0x2c5211c6 (NotAgent)"), "0x123")

    assert exc_info.value.code == "UNAUTHORIZED_AGENT"


def test_is_valid_address() -> None:
    """Verify is_valid_address correctly identifies EVM hex addresses."""
    assert ContractClient.is_valid_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44e") is True
    assert ContractClient.is_valid_address("0x" + "00" * 20) is True
    assert ContractClient.is_valid_address("not_an_address") is False
    assert ContractClient.is_valid_address(None) is False
    assert ContractClient.is_valid_address("") is False


def test_get_payment_decoding() -> None:
    """Verify get_payment calls contract and returns typed dict representation."""
    client = ContractClient(
        contract_address="0x" + "11" * 20,
        agent_address="0x" + "22" * 20,
        agent_private_key=SecretStr("0x" + "aa" * 32),
    )
    req_id = RequestId.generate()
    mock_record = (
        HexBytes(req_id),
        "translation",
        "0x" + "33" * 20,
        10000000000000000,
        HexBytes("0x" + "44" * 32),
        1700000000,
        1700000010,
        True,
    )
    client.contract = MagicMock()
    client.contract.functions.getPayment.return_value.call.return_value = mock_record

    res = client.get_payment(req_id)
    assert res["request_id"] == str(req_id).lower()
    assert res["service"] == "translation"
    assert res["provider"] == "0x" + "33" * 20
    assert res["amount"] == 10000000000000000
    assert res["delivered"] is True

