"""
Contract client boundary for Person 2 (AI Agent + Payment).

Interacts directly with Person 1's AgentPay.sol smart contract using Web3.py.
Loads canonical ABI from contracts/artifacts-export/AgentPay.json.

ARCHITECTURAL PRINCIPLES:
- Smart contract is the sole security and spending authority.
- No Web3 internals leak into Orchestrator or ProviderClient.
- Strict native ETH / wei denomination.
- Invariant: Original RequestId (bytes32) is preserved without alteration.
- Private keys are accessed securely through SecretStr and never logged.
"""

from decimal import Decimal
import json
from pathlib import Path
from typing import Any, Dict, Optional, Union

from hexbytes import HexBytes
from pydantic import SecretStr
from web3 import Web3
from web3.contract.contract import Contract
from web3.exceptions import ContractCustomError, ContractLogicError, TransactionNotFound

from agent.src.config import Settings, get_settings
from agent.src.exceptions import (
    BudgetExceededError,
    ConfigurationError,
    ContractError,
    DuplicateRequestError,
    PaymentAuthorizationError,
    PaymentTransactionError,
    UnauthorizedAgentError,
)
from agent.src.logger import get_logger
from agent.src.models import PaymentResult, PaymentStatus, RequestId

logger = get_logger("agent.contract_client")

# Custom error selectors for AgentPay.sol (Solidity ^0.8.24)
# keccak256("ErrorName(...)")[:4]
ERROR_SELECTORS = {
    "0x028d7b37": "BudgetExceeded",             # BudgetExceeded(uint256,uint256)
    "0x913b28b7": "HardCapExceeded",            # HardCapExceeded(uint256,uint256)
    "0x1f274737": "AlreadyProcessed",           # AlreadyProcessed(bytes32)
    "0x2c5211c6": "NotAgent",                   # NotAgent()
    "0x30cd7471": "NotOwner",                   # NotOwner()
    "0xd92e233d": "ZeroAddress",                # ZeroAddress()
    "0x1f2a2005": "ZeroAmount",                 # ZeroAmount()
    "0x90b98a11": "EmptyService",               # EmptyService()
    "0xb2a8cb90": "InsufficientContractBalance",# InsufficientContractBalance(uint256,uint256)
    "0x90b8ec18": "TransferFailed",             # TransferFailed()
    "0x0d3e52ee": "AlreadyDelivered",           # AlreadyDelivered(bytes32)
    "0x7509d73d": "NotProcessed",               # NotProcessed(bytes32)
}


def to_bytes32(val: Union[str, RequestId, bytes, HexBytes]) -> HexBytes:
    """Normalize a 32-byte hex string or RequestId to HexBytes(32)."""
    if isinstance(val, (bytes, HexBytes)):
        if len(val) != 32:
            raise ValueError(f"Expected 32 bytes, got {len(val)}")
        return HexBytes(val)
    s = str(val).strip()
    if not s.startswith("0x"):
        s = f"0x{s}"
    if len(s) != 66:
        raise ValueError(f"Expected 66-character hex string (0x + 64 hex), got '{s}' (len {len(s)})")
    return HexBytes(s)


class ContractClient:
    """
    Client boundary managing Web3 interactions with the AgentPay smart contract.
    Supports injected Web3 instances and mock providers for testing.
    """

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        contract_address: Optional[str] = None,
        agent_address: Optional[str] = None,
        agent_private_key: Optional[SecretStr] = None,
        abi_path: Optional[Union[str, Path]] = None,
        web3_instance: Optional[Web3] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.rpc_url = rpc_url or self.settings.RPC_URL
        self.contract_address_raw = contract_address or self.settings.CONTRACT_ADDRESS
        self.agent_address_raw = agent_address or self.settings.AGENT_ADDRESS
        self.agent_private_key = agent_private_key or self.settings.AGENT_PRIVATE_KEY
        self.chain_id = self.settings.CHAIN_ID or 11155111

        # Web3 Initialization
        if web3_instance is not None:
            self.w3 = web3_instance
        elif self.rpc_url:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        else:
            self.w3 = Web3()

        # Contract coordinates
        self.contract_address: Optional[str] = None
        if self.contract_address_raw:
            try:
                self.contract_address = Web3.to_checksum_address(self.contract_address_raw)
            except Exception as e:
                raise ConfigurationError(
                    f"Invalid CONTRACT_ADDRESS: {self.contract_address_raw}",
                    code="INVALID_CONTRACT_ADDRESS",
                    details={"error": str(e)},
                ) from e

        self.agent_address: Optional[str] = None
        if self.agent_address_raw:
            try:
                self.agent_address = Web3.to_checksum_address(self.agent_address_raw)
            except Exception as e:
                raise ConfigurationError(
                    f"Invalid AGENT_ADDRESS: {self.agent_address_raw}",
                    code="INVALID_AGENT_ADDRESS",
                    details={"error": str(e)},
                ) from e

        # Load canonical ABI
        self.abi = self._load_canonical_abi(abi_path)

        # Build contract instance if address is configured
        self.contract: Optional[Contract] = None
        if self.contract_address:
            self.contract = self.w3.eth.contract(
                address=self.contract_address,
                abi=self.abi,
            )

    def _load_canonical_abi(self, abi_path: Optional[Union[str, Path]] = None) -> list[Dict[str, Any]]:
        """Load the canonical ABI from artifacts-export/AgentPay.json."""
        candidates = []
        if abi_path:
            candidates.append(Path(abi_path))

        # Standard project layout candidates
        workspace_root = Path(__file__).resolve().parent.parent.parent
        candidates.extend([
            workspace_root / "contracts" / "artifacts-export" / "AgentPay.json",
            workspace_root / "artifacts-export" / "AgentPay.json",
            Path("contracts/artifacts-export/AgentPay.json"),
            Path("artifacts-export/AgentPay.json"),
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, dict) and "abi" in data:
                            return data["abi"]
                        if isinstance(data, list):
                            return data
                except Exception as e:
                    logger.warning("Failed to load ABI candidate %s: %s", path, e)

        # If running in a test or unconfigured environment without files, fail or return empty
        raise ConfigurationError(
            "Canonical AgentPay ABI artifact not found in expected locations: "
            + ", ".join(str(p) for p in candidates),
            code="MISSING_ABI_ARTIFACT",
        )

    def _ensure_ready(self, require_signer: bool = False) -> None:
        """Verify contract client has required coordinates configured."""
        if not self.contract or not self.contract_address:
            raise ConfigurationError(
                "ContractClient is not configured with CONTRACT_ADDRESS",
                code="MISSING_CONTRACT_ADDRESS",
            )
        if require_signer:
            if not self.agent_private_key:
                raise ConfigurationError(
                    "ContractClient is not configured with AGENT_PRIVATE_KEY for signing",
                    code="MISSING_AGENT_KEY",
                )
            if not self.agent_address:
                raise ConfigurationError(
                    "ContractClient is not configured with AGENT_ADDRESS",
                    code="MISSING_AGENT_ADDRESS",
                )

    def is_processed(self, request_id: Union[str, RequestId]) -> bool:
        """Query contract isProcessed(bytes32) to verify if request was paid."""
        self._ensure_ready(require_signer=False)
        req_b32 = to_bytes32(request_id)
        try:
            return bool(self.contract.functions.isProcessed(req_b32).call())
        except Exception as exc:
            raise ContractError(
                f"Failed to check isProcessed on contract: {str(exc)}",
                code="CONTRACT_READ_ERROR",
                request_id=str(request_id),
            ) from exc

    def get_budget_status(self) -> Dict[str, int]:
        """
        Query contract getBudgetStatus() returning hardCap, budget, spent, remaining in wei.
        """
        self._ensure_ready(require_signer=False)
        try:
            hard_cap, budget, spent, remaining = self.contract.functions.getBudgetStatus().call()
            return {
                "hard_cap": hard_cap,
                "budget": budget,
                "spent": spent,
                "remaining": remaining,
            }
        except Exception as exc:
            raise ContractError(
                f"Failed to retrieve budget status from contract: {str(exc)}",
                code="CONTRACT_READ_ERROR",
            ) from exc

    def get_contract_balance(self) -> int:
        """Query contract ETH balance in wei."""
        self._ensure_ready(require_signer=False)
        try:
            return int(self.contract.functions.getContractBalance().call())
        except Exception as exc:
            raise ContractError(
                f"Failed to retrieve contract balance: {str(exc)}",
                code="CONTRACT_READ_ERROR",
            ) from exc

    def get_delivery_hash(self, request_id: Union[str, RequestId]) -> str:
        """Query contract getDeliveryHash(bytes32) returning hex string."""
        self._ensure_ready(require_signer=False)
        req_b32 = to_bytes32(request_id)
        try:
            res = self.contract.functions.getDeliveryHash(req_b32).call()
            return HexBytes(res).to_0x_hex()
        except Exception as exc:
            raise ContractError(
                f"Failed to get delivery hash from contract: {str(exc)}",
                code="CONTRACT_READ_ERROR",
                request_id=str(request_id),
            ) from exc

    def get_payment(self, request_id: Union[str, RequestId]) -> Dict[str, Any]:
        """Query contract getPayment(bytes32) returning dict representation of PaymentRecord."""
        self._ensure_ready(require_signer=False)
        req_b32 = to_bytes32(request_id)
        try:
            rec = self.contract.functions.getPayment(req_b32).call()
            return {
                "request_id": HexBytes(rec[0]).to_0x_hex(),
                "service": rec[1],
                "provider": rec[2],
                "amount": rec[3],
                "content_hash": HexBytes(rec[4]).to_0x_hex(),
                "paid_at": rec[5],
                "delivered_at": rec[6],
                "delivered": rec[7],
            }
        except Exception as exc:
            raise ContractError(
                f"Failed to get payment from contract: {str(exc)}",
                code="CONTRACT_READ_ERROR",
                request_id=str(request_id),
            ) from exc

    @staticmethod
    def is_valid_address(address: Optional[str]) -> bool:
        """Check if an address string is a valid EVM hex address."""
        if not address or not isinstance(address, str):
            return False
        return Web3.is_address(address)

    def authorize_payment(
        self,
        request_id: Union[str, RequestId],
        amount_wei: int,
        provider_address: str,
        service: str,
    ) -> PaymentResult:
        """
        Execute authorizePayment(bytes32, uint256, address, string) on AgentPay.sol.
        Atomically authorizes and executes native ETH transfer on-chain.
        """
        self._ensure_ready(require_signer=True)
        req_id_str = str(request_id)
        req_b32 = to_bytes32(request_id)

        if amount_wei <= 0:
            raise ValueError(f"amount_wei must be positive, got {amount_wei}")

        try:
            checksum_provider = Web3.to_checksum_address(provider_address)
        except Exception as exc:
            raise PaymentAuthorizationError(
                f"Invalid provider address '{provider_address}': {exc}",
                code="INVALID_PROVIDER_ADDRESS",
                request_id=req_id_str,
            ) from exc

        if not service or not service.strip():
            raise PaymentAuthorizationError(
                "Service label cannot be empty for contract payment authorization",
                code="EMPTY_SERVICE",
                request_id=req_id_str,
            )

        # Idempotency check before transaction broadcast
        if self.is_processed(req_id_str):
            raise DuplicateRequestError(
                f"Smart contract indicates request_id '{req_id_str}' has already been processed",
                code="ALREADY_PROCESSED",
                request_id=req_id_str,
            )

        # Build transaction
        try:
            nonce = self.w3.eth.get_transaction_count(self.agent_address, "pending")
            gas_price = self.w3.eth.gas_price

            tx_data = self.contract.functions.authorizePayment(
                req_b32,
                amount_wei,
                checksum_provider,
                service.strip(),
            ).build_transaction({
                "from": self.agent_address,
                "nonce": nonce,
                "gasPrice": gas_price,
                "chainId": self.chain_id,
            })

            # Estimate gas with a safety buffer
            try:
                estimated_gas = self.w3.eth.estimate_gas(tx_data)
                tx_data["gas"] = int(estimated_gas * 1.2)
            except Exception as est_err:
                # If gas estimation failed due to a contract revert, map revert reason immediately
                self._handle_revert(est_err, req_id_str)
                tx_data["gas"] = 300000

        except ContractError:
            raise
        except Exception as exc:
            raise PaymentAuthorizationError(
                f"Failed to construct authorizePayment transaction: {str(exc)}",
                code="TX_BUILD_FAILED",
                request_id=req_id_str,
            ) from exc

        # Sign and broadcast
        try:
            signed_tx = self.w3.eth.account.sign_transaction(
                tx_data,
                private_key=self.agent_private_key.get_secret_value(),
            )
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = HexBytes(tx_hash).to_0x_hex()
            logger.info(
                "authorizePayment transaction broadcast: tx_hash=%s request_id=%s amount_wei=%d",
                tx_hash_hex, req_id_str, amount_wei,
            )
        except Exception as exc:
            self._handle_revert(exc, req_id_str)
            raise PaymentTransactionError(
                f"Failed to broadcast payment transaction: {str(exc)}",
                code="BROADCAST_FAILED",
                request_id=req_id_str,
            ) from exc

        # Await transaction receipt
        try:
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if receipt.get("status") == 0:
                # Transaction mined but reverted
                raise PaymentAuthorizationError(
                    f"Transaction reverted on-chain: tx_hash={tx_hash_hex}",
                    code="TRANSACTION_REVERTED",
                    request_id=req_id_str,
                    details={"tx_hash": tx_hash_hex, "receipt": dict(receipt)},
                )
        except PaymentAuthorizationError:
            raise
        except Exception as exc:
            raise PaymentTransactionError(
                f"Error waiting for transaction receipt: {str(exc)}",
                code="RECEIPT_TIMEOUT",
                request_id=req_id_str,
                details={"tx_hash": tx_hash_hex},
            ) from exc

        amount_eth = Decimal(amount_wei) / Decimal(10**18)
        return PaymentResult(
            request_id=RequestId(req_id_str),
            amount=amount_eth,
            status=PaymentStatus.CONFIRMED,
            transaction_hash=tx_hash_hex,
        )

    def record_delivery(
        self,
        request_id: Union[str, RequestId],
        content_hash: str,
    ) -> str:
        """
        Execute recordDelivery(bytes32, bytes32) on AgentPay.sol.
        Permanently binds service fulfillment content hash to the payment on-chain.
        """
        self._ensure_ready(require_signer=True)
        req_id_str = str(request_id)
        req_b32 = to_bytes32(request_id)
        hash_b32 = to_bytes32(content_hash)

        try:
            nonce = self.w3.eth.get_transaction_count(self.agent_address, "pending")
            gas_price = self.w3.eth.gas_price

            tx_data = self.contract.functions.recordDelivery(
                req_b32,
                hash_b32,
            ).build_transaction({
                "from": self.agent_address,
                "nonce": nonce,
                "gasPrice": gas_price,
                "chainId": self.chain_id,
            })

            try:
                estimated_gas = self.w3.eth.estimate_gas(tx_data)
                tx_data["gas"] = int(estimated_gas * 1.2)
            except Exception:
                tx_data["gas"] = 150000

            signed_tx = self.w3.eth.account.sign_transaction(
                tx_data,
                private_key=self.agent_private_key.get_secret_value(),
            )
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = HexBytes(tx_hash).to_0x_hex()
            logger.info("recordDelivery broadcast: tx_hash=%s request_id=%s", tx_hash_hex, req_id_str)

            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if receipt.get("status") == 0:
                raise ContractError(
                    f"recordDelivery reverted on-chain: tx_hash={tx_hash_hex}",
                    code="RECORD_DELIVERY_REVERTED",
                    request_id=req_id_str,
                )
            return tx_hash_hex

        except ContractError:
            raise
        except Exception as exc:
            self._handle_revert(exc, req_id_str)
            raise ContractError(
                f"Failed to record delivery on-chain: {str(exc)}",
                code="RECORD_DELIVERY_FAILED",
                request_id=req_id_str,
            ) from exc

    def _handle_revert(self, exc: Exception, request_id: str) -> None:
        """Parse custom error or revert message from contract and raise typed domain error."""
        msg = str(exc)
        err_lower = msg.lower()

        # Check for custom error names or selectors
        if "budgetexceeded" in err_lower or "0x028d7b37" in err_lower:
            raise BudgetExceededError(
                f"Smart contract rejected payment: budget exceeded for request {request_id}",
                code="BUDGET_EXCEEDED",
                request_id=request_id,
                details={"raw_error": msg},
            ) from exc

        if "hardcapexceeded" in err_lower or "0x913b28b7" in err_lower:
            raise BudgetExceededError(
                f"Smart contract rejected payment: hard spending cap exceeded for request {request_id}",
                code="HARD_CAP_EXCEEDED",
                request_id=request_id,
                details={"raw_error": msg},
            ) from exc

        if "alreadyprocessed" in err_lower or "0x1f274737" in err_lower:
            raise DuplicateRequestError(
                f"Smart contract rejected payment: request {request_id} already processed",
                code="ALREADY_PROCESSED",
                request_id=request_id,
                details={"raw_error": msg},
            ) from exc

        if "notagent" in err_lower or "0x2c5211c6" in err_lower:
            raise UnauthorizedAgentError(
                f"Smart contract rejected caller: address {self.agent_address} is not the authorized agent",
                code="UNAUTHORIZED_AGENT",
                request_id=request_id,
                details={"raw_error": msg},
            ) from exc

        if "insufficientcontractbalance" in err_lower or "0xb2a8cb90" in err_lower:
            raise PaymentAuthorizationError(
                "Smart contract rejected payment: insufficient ETH balance in contract",
                code="INSUFFICIENT_CONTRACT_BALANCE",
                request_id=request_id,
                details={"raw_error": msg},
            ) from exc
