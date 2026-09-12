"""
Unit tests covering Phase 2 (Provider Wallet Configuration) and Phase 4 (ETH / Wei Consistency).
Covers:
A. Provider wallet address configuration
B. Invalid provider address rejection
C. ETH quote -> wei consistency
"""

from decimal import Decimal
import pytest
from web3 import Web3

from backend.app.config import Settings
from backend.app.core.currency import eth_to_wei, WEI_PER_ETH


# ==============================================================================
# A. Provider Wallet Address Configuration
# ==============================================================================

def test_provider_wallet_valid_checksum_configuration():
    """Verify provider wallet address is validated and converted to checksum format."""
    raw_addr = "0x742d35cc6634c0532925a3b844bc454e4438f44e"
    s = Settings(PROVIDER_WALLET_ADDRESS=raw_addr)
    assert s.PROVIDER_WALLET_ADDRESS == Web3.to_checksum_address(raw_addr)
    assert Web3.is_checksum_address(s.PROVIDER_WALLET_ADDRESS)


def test_provider_wallet_default_is_valid():
    """Verify default provider wallet is a valid Ethereum checksummed address."""
    s = Settings()
    assert Web3.is_address(s.PROVIDER_WALLET_ADDRESS)
    assert Web3.is_checksum_address(s.PROVIDER_WALLET_ADDRESS)


# ==============================================================================
# B. Invalid Provider Address Rejection
# ==============================================================================

def test_invalid_provider_wallet_address_rejected():
    """Verify invalid provider wallet addresses raise ValueError."""
    with pytest.raises(ValueError, match="Invalid Ethereum address for PROVIDER_WALLET_ADDRESS"):
        Settings(PROVIDER_WALLET_ADDRESS="not_an_ethereum_address")

    with pytest.raises(ValueError, match="Invalid Ethereum address for PROVIDER_WALLET_ADDRESS"):
        Settings(PROVIDER_WALLET_ADDRESS="0x1234")

    with pytest.raises(ValueError, match="PROVIDER_WALLET_ADDRESS cannot be empty"):
        Settings(PROVIDER_WALLET_ADDRESS="")


def test_invalid_contract_address_rejected():
    """Verify invalid CONTRACT_ADDRESS raises ValueError when set."""
    with pytest.raises(ValueError, match="Invalid Ethereum address for CONTRACT_ADDRESS"):
        Settings(CONTRACT_ADDRESS="invalid_contract_hex")

    # None or blank should be allowed (optional in dev)
    s = Settings(CONTRACT_ADDRESS=None)
    assert s.CONTRACT_ADDRESS is None

    s_empty = Settings(CONTRACT_ADDRESS="  ")
    assert s_empty.CONTRACT_ADDRESS is None


def test_invalid_verifier_type_rejected():
    """Verify unsupported PAYMENT_VERIFIER_TYPE raises ValueError."""
    with pytest.raises(ValueError, match="PAYMENT_VERIFIER_TYPE must be one of"):
        Settings(PAYMENT_VERIFIER_TYPE="unsupported_verifier")


# ==============================================================================
# C. ETH Quote -> Wei Consistency
# ==============================================================================

def test_eth_to_wei_deterministic_conversions():
    """Verify exact integer wei conversion for standard ETH quote amounts."""
    assert eth_to_wei(Decimal("1.0")) == 10**18
    assert eth_to_wei(Decimal("0.05")) == 50_000_000_000_000_000
    assert eth_to_wei("0.01") == 10_000_000_000_000_000
    assert eth_to_wei("0.000000000000000001") == 1  # Exactly 1 wei
    assert eth_to_wei(2) == 2 * 10**18


def test_eth_to_wei_sub_wei_precision_rejected():
    """Verify fractional amounts smaller than 1 wei (10^-18) raise ValueError."""
    with pytest.raises(ValueError, match="sub-wei precision"):
        eth_to_wei("0.0000000000000000001")


def test_eth_to_wei_non_positive_rejected():
    """Verify non-positive amounts raise ValueError."""
    with pytest.raises(ValueError, match="must be positive"):
        eth_to_wei("0")

    with pytest.raises(ValueError, match="must be positive"):
        eth_to_wei("-0.1")

    with pytest.raises(ValueError, match="cannot parse as Decimal"):
        eth_to_wei("invalid_amount")
