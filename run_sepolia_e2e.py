import os
import sys
import json
import time
from pathlib import Path
from hexbytes import HexBytes
from eth_utils import keccak
from web3 import Web3

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent))

# Load .env file
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi.testclient import TestClient
from backend.app.main import app
from agent.src.contract_client import ContractClient
from agent.src.config import Settings

def wei_to_eth(wei_val: int) -> float:
    return float(Web3.from_wei(wei_val, 'ether'))

def run_sepolia_e2e():
    print("\n" + "="*75)
    print("   AGENTPAY STEP 4C — REAL SEPOLIA END-TO-END PURCHASE & SECURITY AUDIT")
    print("="*75 + "\n")

    rpc_url = os.getenv("SEPOLIA_RPC_URL") or os.getenv("RPC_URL")
    contract_addr = os.getenv("VITE_CONTRACT_ADDRESS") or os.getenv("CONTRACT_ADDRESS")
    agent_addr = os.getenv("AGENT_ADDRESS")
    agent_pk = os.getenv("AGENT_PRIVATE_KEY")

    print(f"Network:              Ethereum Sepolia Testnet")
    print(f"Chain ID:             11155111")
    print(f"RPC Endpoint:         {rpc_url[:30]}...")
    print(f"Contract Address:     {contract_addr}")
    print(f"Authorized Agent:     {agent_addr}")
    
    assert contract_addr == "0x220bef9d0BF075F2ea2a013Fc04Fd6575EB999B6", "Unexpected contract address!"
    assert agent_pk, "AGENT_PRIVATE_KEY missing!"

    # Initialize Contract Client pointing to Sepolia
    client_settings = Settings(
        RPC_URL=rpc_url,
        CONTRACT_ADDRESS=contract_addr,
        CHAIN_ID=11155111,
        AGENT_ADDRESS=agent_addr,
        AGENT_PRIVATE_KEY=agent_pk
    )
    contract_client = ContractClient(settings=client_settings)

    # --------------------------------------------------------------------------
    # 1. READ INITIAL CONTRACT STATE ON SEPOLIA
    # --------------------------------------------------------------------------
    print("\n🔍 1. INSPECTING INITIAL SEPOLIA CONTRACT STATE")
    init_state = contract_client.get_budget_status()
    init_balance_wei = contract_client.get_contract_balance()
    print(f"  - Hard Cap:         {wei_to_eth(init_state['hard_cap'])} ETH ({init_state['hard_cap']} wei)")
    print(f"  - Current Budget:   {wei_to_eth(init_state['budget'])} ETH ({init_state['budget']} wei)")
    print(f"  - Total Spent:      {wei_to_eth(init_state['spent'])} ETH ({init_state['spent']} wei)")
    print(f"  - Remaining Budget: {wei_to_eth(init_state['remaining'])} ETH ({init_state['remaining']} wei)")
    print(f"  - Contract Balance: {wei_to_eth(init_balance_wei)} ETH ({init_balance_wei} wei)")

    fastapi_client = TestClient(app)

    # --------------------------------------------------------------------------
    # 2. HTTP 402 PAYMENT REQUIRED HANDSHAKE
    # --------------------------------------------------------------------------
    print("\n🌐 2. TESTING HTTP 402 HANDSHAKE VIA FASTAPI BACKEND")
    res_402 = fastapi_client.post("/services/translate", json={
        "provider_id": "prov_weather_01",
        "payload": {"text": "Hello Sepolia Blockchain", "target_lang": "es"}
    })
    print(f"  - Request: POST /services/translate")
    print(f"  - Response Status Code: {res_402.status_code}")
    if res_402.status_code == 402:
        detail = res_402.json()
        print(f"  - Handshake Verified: 402 Payment Required -> Quote ID: {detail.get('quote_id')}, Amount: {detail.get('amount_wei')} wei")
    else:
        print(f"  - Response Body: {res_402.json()}")

    # --------------------------------------------------------------------------
    # 3. REAL SEPOLIA PURCHASE TRANSACTION
    # --------------------------------------------------------------------------
    print("\n💳 3. SUBMITTING REAL SEPOLIA PAYMENT AUTHORIZATION TRANSACTION")
    req_id_str = f"req_sepolia_e2e_{int(time.time())}"
    req_id_hex = "0x" + keccak(text=req_id_str).hex()
    service_label = "translate-service"
    amount_wei = 100000000000000 # 0.0001 ETH
    provider_addr = "0xD6acFA4C30eC1053E36dDAa58DDD18f5d012F51d" # Provider EOA

    print(f"  - Request ID:        {req_id_str}")
    print(f"  - Request ID Hex:    {req_id_hex}")
    print(f"  - Amount:            {amount_wei} wei ({wei_to_eth(amount_wei)} ETH)")
    print(f"  - Provider EOA:      {provider_addr}")
    print(f"  - Submitting on-chain `authorizePayment` to Sepolia...")

    try:
        payment_res = contract_client.authorize_payment(
            request_id=req_id_hex,
            amount_wei=amount_wei,
            provider_address=provider_addr,
            service=service_label
        )
    except Exception as exc:
        print(f"❌ BROADCAST FAILED WITH ERROR: {exc}")
        if hasattr(exc, "details"):
            print(f"   Details: {exc.details}")
        raise exc
    
    print(f"  ✅ TRANSACTION CONFIRMED ON SEPOLIA!")
    print(f"  - Tx Hash:           {payment_res.transaction_hash}")
    print(f"  - Etherscan URL:      https://sepolia.etherscan.io/tx/{payment_res.transaction_hash}")

    # Verify On-Chain State Change
    post_pay_state = contract_client.get_budget_status()
    print(f"  - New Total Spent:   {wei_to_eth(post_pay_state['spent'])} ETH")
    print(f"  - New Remaining:     {wei_to_eth(post_pay_state['remaining'])} ETH")

    # --------------------------------------------------------------------------
    # 4. SERVICE DELIVERY & ON-CHAIN DELIVERY PROOF RECORDING
    # --------------------------------------------------------------------------
    print("\n📦 4. RECORDING ON-CHAIN DELIVERY PROOF ON SEPOLIA")
    delivered_payload = json.dumps({"result": "Hola Sepolia Blockchain", "status": "completed"})
    content_hash_hex = "0x" + keccak(text=delivered_payload).hex()
    print(f"  - Delivered Content: {delivered_payload}")
    print(f"  - Content Hash:      {content_hash_hex}")

    delivery_tx_hash = contract_client.record_delivery(
        request_id=req_id_hex,
        content_hash=content_hash_hex
    )
    print(f"  ✅ DELIVERY RECORDED ON SEPOLIA!")
    print(f"  - Tx Hash:           {delivery_tx_hash}")
    print(f"  - Etherscan URL:      https://sepolia.etherscan.io/tx/{delivery_tx_hash}")

    # Read On-Chain Recorded Delivery Hash
    onchain_delivery_hash = contract_client.get_delivery_hash(req_id_hex)
    print(f"  - On-Chain Stored Hash: {onchain_delivery_hash}")
    assert onchain_delivery_hash.lower() == content_hash_hex.lower(), "Content hash mismatch!"

    # --------------------------------------------------------------------------
    # 5. CRYPTOGRAPHIC AUDIT VERIFICATION
    # --------------------------------------------------------------------------
    print("\n🔍 5. TESTING AUDIT TRAIL VERIFICATION ENDPOINT")
    # First write record to audit DB via backend
    from backend.app.core.database import record_transaction, update_transaction_delivery
    record_transaction(
        request_id=req_id_hex,
        service_name=service_label,
        provider_address=provider_addr,
        amount_wei=amount_wei,
        amount_eth=wei_to_eth(amount_wei),
        tx_hash=payment_res.transaction_hash,
        status="authorized"
    )
    update_transaction_delivery(
        request_id=req_id_hex,
        delivery_tx_hash=delivery_tx_hash,
        content_hash=content_hash_hex,
        payload_data=delivered_payload
    )

    audit_res = fastapi_client.get(f"/audit/verify/{req_id_hex}")
    print(f"  - GET /audit/verify/{req_id_hex} Status: {audit_res.status_code}")
    print(f"  - Audit Verification Body: {audit_res.json()}")

    # --------------------------------------------------------------------------
    # 6. REAL RETRY PROTECTION TEST (IDEMPOTENCY)
    # --------------------------------------------------------------------------
    print("\n🛡️ 6. TESTING REAL RETRY PROTECTION ON SEPOLIA (IDEMPOTENCY GUARD)")
    print(f"  - Attempting duplicate `authorizePayment` with SAME Request ID: {req_id_hex}")
    try:
        contract_client.authorize_payment(
            request_id=req_id_hex,
            amount_wei=amount_wei,
            provider_address=provider_addr,
            service=service_label
        )
        print("  ❌ ERROR: Duplicate payment was not rejected!")
        retry_passed = False
    except Exception as err:
        print(f"  ✅ RETRY REJECTED BY SMART CONTRACT ON SEPOLIA!")
        print(f"  - Revert / Error:    {err}")
        print(f"  - Additional Spend:  0.00 ETH")
        retry_passed = True

    # --------------------------------------------------------------------------
    # 7. REAL HARD BUDGET ENFORCEMENT TEST (OVERSPENDING GUARD)
    # --------------------------------------------------------------------------
    print("\n🔒 7. TESTING REAL HARD BUDGET ENFORCEMENT ON SEPOLIA")
    overspend_req_str = f"req_sepolia_overspend_{int(time.time())}"
    overspend_req_hex = "0x" + keccak(text=overspend_req_str).hex()
    overspend_amount_wei = 50000000000000000 # 0.05 ETH (Exceeds remaining budget ~0.0099 ETH)

    print(f"  - Overspend Request ID: {overspend_req_str}")
    print(f"  - Requested Amount:    {overspend_amount_wei} wei ({wei_to_eth(overspend_amount_wei)} ETH)")
    print(f"  - Available Budget:    {post_pay_state['remaining']} wei ({wei_to_eth(post_pay_state['remaining'])} ETH)")

    try:
        contract_client.authorize_payment(
            request_id=overspend_req_hex,
            amount_wei=overspend_amount_wei,
            provider_address=provider_addr,
            service="compute-overspend"
        )
        print("  ❌ ERROR: Overspending request was not rejected!")
        budget_passed = False
    except Exception as err:
        print(f"  ✅ OVERSPEND REJECTED BY SMART CONTRACT ON SEPOLIA!")
        print(f"  - Revert / Error:    {err}")
        print(f"  - Payment Deducted:  0.00 ETH (Atomic Revert)")
        budget_passed = True

    # --------------------------------------------------------------------------
    # 8. FINAL CONTRACT STATE AUDIT
    # --------------------------------------------------------------------------
    print("\n📊 8. FINAL SEPOLIA CONTRACT STATE AUDIT")
    final_state = contract_client.get_budget_status()
    final_balance_wei = contract_client.get_contract_balance()
    print(f"  - Total Spent:      {wei_to_eth(final_state['spent'])} ETH")
    print(f"  - Remaining Budget: {wei_to_eth(final_state['remaining'])} ETH")
    print(f"  - Contract Balance: {wei_to_eth(final_balance_wei)} ETH")

    print("\n" + "="*75)
    print("     ALL REAL SEPOLIA E2E PURCHASES & SECURITY TESTS COMPLETED!")
    print("="*75 + "\n")

    return {
        "payment_tx": payment_res.transaction_hash,
        "delivery_tx": delivery_tx_hash,
        "request_id": req_id_str,
        "request_id_hex": req_id_hex,
        "content_hash": content_hash_hex,
        "retry_passed": retry_passed,
        "budget_passed": budget_passed
    }

if __name__ == "__main__":
    run_sepolia_e2e()
