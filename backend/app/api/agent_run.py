import json
import logging
import os
import re
import time
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from eth_utils import keccak
from pydantic import SecretStr

from backend.app.database import get_db, SessionLocal
from backend.app.config import settings
from backend.app.core.audit_logger import log_audit_event
from backend.app.models.agent_run import AgentRun, AgentRunStep, AgentRunStatus, AgentRunStepStatus
from backend.app.models.quote import Quote, QuoteStatus
from backend.app.schemas.agent_run import AgentRunRequest, AgentRunResponse, AgentRunStepResponse
from backend.app.api.security_demo import is_kill_switch_active
from agent.src.planner import AgentPlanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Agent Run"])


def _get_contract_client():
    """Helper to initialize ContractClient for read-only budget queries if env vars exist."""
    try:
        from agent.src.contract_client import ContractClient
        from agent.src.config import Settings as AgentSettings

        rpc_url = os.getenv("RPC_URL") or os.getenv("SEPOLIA_RPC_URL") or getattr(settings, "RPC_URL", "")
        contract_addr = os.getenv("CONTRACT_ADDRESS") or os.getenv("VITE_CONTRACT_ADDRESS") or getattr(settings, "CONTRACT_ADDRESS", "")
        agent_addr = os.getenv("AGENT_ADDRESS")
        agent_pk = os.getenv("AGENT_PRIVATE_KEY")

        if not rpc_url or not contract_addr or not agent_addr or not agent_pk:
            return None

        agent_settings = AgentSettings(
            RPC_URL=rpc_url,
            CONTRACT_ADDRESS=contract_addr,
            CHAIN_ID=int(os.getenv("CHAIN_ID") or os.getenv("VITE_CHAIN_ID") or 11155111),
            AGENT_ADDRESS=agent_addr,
            AGENT_PRIVATE_KEY=SecretStr(agent_pk),
            PROVIDER_BASE_URL=os.getenv("PROVIDER_BASE_URL") or "http://localhost:8000",
        )
        return ContractClient(settings=agent_settings)
    except Exception as e:
        logger.warning(f"Could not initialize ContractClient for read-only budget check: {e}")
        return None


def get_remaining_contract_budget(db: Session) -> float:
    """
    Safely reads the remaining contract budget from Sepolia contract or DB fallback.
    Does NOT execute any blockchain transaction.
    """
    cc = _get_contract_client()
    if cc:
        try:
            status_dict = cc.get_budget_status()
            remaining_wei = Decimal(str(status_dict["remaining"]))
            return float(remaining_wei / Decimal(10**18))
        except Exception as e:
            logger.warning(f"Contract get_budget_status query failed: {e}")

    # Fallback to hard cap minus paid DB quotes
    hard_cap = Decimal(str(getattr(settings, "HARD_CAP_ETH", 0.05)))
    paid_quotes = db.query(Quote).filter(Quote.status == QuoteStatus.PAID).all()
    spent = sum(Decimal(str(q.amount)) for q in paid_quotes)
    return float(max(Decimal(0), hard_cap - spent))


def _extract_translation_text(prompt: str) -> str:
    """Helper to extract quote text or main text to translate from user prompt."""
    match = re.search(r"['\"]([^'\"]+)['\"]", prompt)
    if match:
        return match.group(1)
    
    clean = re.sub(r"(?i)^(translate|please translate)\s+", "", prompt.strip())
    clean = re.sub(r"(?i)\s+and\s+store.*$", "", clean)
    clean = re.sub(r"(?i)\s+into\s+[a-z]+$", "", clean)
    clean = re.sub(r"(?i)\s+to\s+[a-z]+$", "", clean)
    return clean.strip() or "Hello World"


def _execute_service_step(
    step: AgentRunStep,
    payload: Dict[str, Any],
    db: Session
) -> Dict[str, Any]:
    """
    Executes a single service step using the HTTP 402 -> Sepolia Smart Contract -> Delivery pipeline.
    Reuses existing Orchestrator / handle_service_execution infrastructure.
    """
    service_type = step.service.lower()
    provider_id = step.provider_id or "alpha"

    # Check if full on-chain Orchestrator env is available
    rpc_url = os.getenv("RPC_URL") or os.getenv("SEPOLIA_RPC_URL") or settings.RPC_URL
    contract_addr = os.getenv("CONTRACT_ADDRESS") or os.getenv("VITE_CONTRACT_ADDRESS") or settings.CONTRACT_ADDRESS
    agent_addr = os.getenv("AGENT_ADDRESS") or settings.PROVIDER_WALLET_ADDRESS
    agent_pk = os.getenv("AGENT_PRIVATE_KEY")

    req_id_str = "0x" + keccak(text=f"step_{step.id}_{time.time()}").hex()

    if rpc_url and contract_addr and agent_addr and agent_pk:
        from agent.src.orchestrator import Orchestrator
        from agent.src.provider_client import ProviderClient
        from agent.src.contract_client import ContractClient
        from agent.src.payment_client import PaymentClient
        from agent.src.models import ServiceRequest, RequestId
        from agent.src.config import Settings as AgentSettings

        agent_settings = AgentSettings(
            RPC_URL=rpc_url,
            CONTRACT_ADDRESS=contract_addr,
            CHAIN_ID=int(os.getenv("CHAIN_ID") or os.getenv("VITE_CHAIN_ID") or 11155111),
            AGENT_ADDRESS=agent_addr,
            AGENT_PRIVATE_KEY=SecretStr(agent_pk),
            PROVIDER_BASE_URL=os.getenv("PROVIDER_BASE_URL") or "http://localhost:8000",
        )

        env_provider_url = (
            os.getenv("PROVIDER_BASE_URL") 
            or os.getenv("PROVIDER_URL") 
            or os.getenv("RENDER_EXTERNAL_URL") 
            or ""
        ).strip()
        for path_suffix in ["/services/translation", "/services/translate", "/services/compute", "/services/storage", "/services"]:
            if env_provider_url.rstrip("/").endswith(path_suffix):
                env_provider_url = env_provider_url.rstrip("/")[:-len(path_suffix)].rstrip("/")
                break

        is_external_provider = (
            env_provider_url != "" 
            and not env_provider_url.startswith("http://localhost") 
            and not env_provider_url.startswith("http://127.0.0.1")
            and not env_provider_url.startswith("http://testserver")
        )

        if is_external_provider:
            provider_client = ProviderClient(base_url=env_provider_url)
        else:
            from fastapi.testclient import TestClient
            from backend.app.main import app
            test_client = TestClient(app, base_url="http://testserver")
            provider_client = ProviderClient(base_url="http://testserver", http_client=test_client)

        contract_client = ContractClient(settings=agent_settings)
        payment_client = PaymentClient(contract_client=contract_client)

        orchestrator = Orchestrator(
            provider_client=provider_client,
            contract_client=contract_client,
            payment_client=payment_client,
            payer_address=agent_addr,
        )

        endpoint_mapping = {
            "translation": "/services/translate",
            "translate": "/services/translate",
            "compute": "/services/compute",
            "storage": "/services/storage",
            "summarization": "/services/summarize",
            "summarize": "/services/summarize",
        }
        endpoint_path = endpoint_mapping.get(service_type.lower(), f"/services/{service_type}")

        service_req = ServiceRequest(
            service=service_type,
            provider=provider_id,
            payload=payload,
            request_id=RequestId(req_id_str)
        )
        try:
            result_obj = orchestrator.run(service_req, endpoint_path=endpoint_path)
            res_data = getattr(result_obj, "result_data", None) or getattr(result_obj, "result", None) or {}
            if hasattr(result_obj, "delivery_result") and result_obj.delivery_result:
                res_data = result_obj.delivery_result.result or res_data
            tx_hash_val = (
                getattr(result_obj, "payment_reference", None)
                or getattr(result_obj, "transaction_hash", None)
                or getattr(result_obj, "tx_hash", None)
            )
            if not tx_hash_val and hasattr(result_obj, "result") and isinstance(result_obj.result, dict):
                tx_hash_val = result_obj.result.get("tx_hash") or result_obj.result.get("transaction_hash")

            return {
                "request_id": req_id_str,
                "transaction_hash": tx_hash_val or "0x" + "1"*64,
                "content_hash": getattr(result_obj, "content_hash", None) or "0x" + "0"*64,
                "data": res_data,
                "amount": step.quote_eth,
            }
        except Exception as e:
            logger.error(f"Orchestrator execution error for step {step.step_number}: {e}")
            raise e

    # Local backend execution fallback (HTTP 402 + DB logging)
    from backend.app.api.services import handle_service_execution

    def generate_payment_proof(quote_id: str, tx_hash: str, payer_address: str) -> str:
        return json.dumps({
            "quote_id": quote_id,
            "tx_hash": tx_hash,
            "payer_address": payer_address
        })

    # Step A: Initiate request without proof -> get 402 Payment Required quote
    resp = handle_service_execution(service_type, payload, None, db, provider_id=provider_id, x_request_id=req_id_str)
    if isinstance(resp, JSONResponse) and resp.status_code == 402:
        body = json.loads(resp.body.decode("utf-8"))
        quote_id = body["quote_id"]
        quote_amount = body["amount"]

        # Step B: Generate payment proof (tx_hash) & complete payment
        mock_tx_hash = "0x" + keccak(text=f"tx_{quote_id}_{time.time()}").hex()
        proof_header = generate_payment_proof(quote_id, mock_tx_hash, agent_addr)

        # Mark quote paid and create payment record for local fallback
        from backend.app.models.payment import Payment
        q = db.query(Quote).filter(Quote.id == quote_id).first()
        if q:
            q.status = QuoteStatus.PAID
            pmt = db.query(Payment).filter(Payment.quote_id == q.id).first()
            if not pmt:
                pmt = Payment(
                    quote_id=q.id,
                    request_id=q.request_id,
                    tx_hash=mock_tx_hash,
                    payer_address=agent_addr,
                    amount=q.amount,
                    verified_at=datetime.utcnow()
                )
                db.add(pmt)
            db.commit()

        # Step C: Resubmit request with X-Payment-Proof -> get delivery & content_hash
        success_resp = handle_service_execution(service_type, payload, proof_header, db, provider_id=provider_id, x_request_id=req_id_str)
        if hasattr(success_resp, "data"):
            return {
                "request_id": req_id_str,
                "transaction_hash": mock_tx_hash,
                "content_hash": success_resp.content_hash,
                "data": success_resp.data,
                "amount": quote_amount,
            }

    raise RuntimeError(f"Service execution failed for step {step.step_number} ({service_type})")


def execute_agent_run_task(agent_run: AgentRun, db: Session) -> AgentRun:
    """
    Executes all planned steps in an AgentRun sequentially, chaining real output data from
    step N-1 into step N. Reuses existing HTTP 402 and smart contract payment infrastructure.
    """
    if is_kill_switch_active(db):
        agent_run.status = AgentRunStatus.BLOCKED
        agent_run.error_code = "KILL_SWITCH_ACTIVE"
        agent_run.error_message = "Agent execution is temporarily disabled by the emergency kill switch."
        db.commit()
        log_audit_event(
            db=db,
            request_id=agent_run.task_id,
            event_type="KILL_SWITCH_ACTIVE",
            details={
                "task_id": agent_run.task_id,
                "error_code": "KILL_SWITCH_ACTIVE",
                "error_message": agent_run.error_message,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        )
        return agent_run

    if agent_run.status == AgentRunStatus.BLOCKED:
        return agent_run

    agent_run.status = AgentRunStatus.EXECUTING
    agent_run.started_at = datetime.utcnow()
    db.commit()

    accumulated_output = None
    total_actual_spent = 0.0

    for step in agent_run.steps:
        logger.info("[STEP START] task_id=%s step_number=%d service=%s", agent_run.task_id, step.step_number, step.service)
        step.status = AgentRunStepStatus.EXECUTING
        db.commit()

        # Build payload with real data chaining
        service_type = step.service.lower()
        payload = {"provider_id": step.provider_id}

        if service_type == "translation":
            input_text = accumulated_output if (step.input_dependency and accumulated_output) else _extract_translation_text(agent_run.user_prompt)
            payload.update({"text": input_text, "source_lang": "en", "target_lang": "hi"})
        elif service_type == "summarization":
            input_text = accumulated_output if (step.input_dependency and accumulated_output) else agent_run.user_prompt
            payload.update({"text": input_text, "max_length": 150})
        elif service_type == "storage":
            val_to_store = accumulated_output if (step.input_dependency and accumulated_output) else f"Stored output for '{agent_run.user_prompt}'"
            payload.update({"key": "processed_document", "value": val_to_store, "ttl_seconds": 3600})
        elif service_type == "compute":
            payload.update({"operation": "matrix_multiply", "params": {"data": accumulated_output or "dataset_snapshot", "matrix_size": 100}})

        try:
            exec_res = _execute_service_step(step, payload, db)
            
            output_data = exec_res.get("data") or {}
            step.transaction_hash = exec_res.get("transaction_hash")
            step.content_hash = exec_res.get("content_hash")
            step.result = json.dumps(output_data)
            step.status = AgentRunStepStatus.FULFILLED
            step.completed_at = datetime.utcnow()

            spent = exec_res.get("amount", step.quote_eth)
            total_actual_spent += spent

            # Extract output for subsequent step chaining
            if service_type == "translation":
                accumulated_output = output_data.get("translated_text") or output_data.get("text") or json.dumps(output_data)
            elif service_type == "summarization":
                accumulated_output = output_data.get("summary") or output_data.get("text") or json.dumps(output_data)
            elif service_type == "compute":
                accumulated_output = json.dumps(output_data.get("result") or output_data)
            elif service_type == "storage":
                accumulated_output = output_data.get("value") or output_data.get("key") or json.dumps(output_data)

            log_audit_event(
                db=db,
                request_id=agent_run.task_id,
                event_type="AGENT_STEP_FULFILLED",
                details={
                    "task_id": agent_run.task_id,
                    "step_number": step.step_number,
                    "service": step.service,
                    "provider_id": step.provider_id,
                    "transaction_hash": step.transaction_hash,
                    "content_hash": step.content_hash,
                    "input_dependency": step.input_dependency,
                    "output": output_data,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
            )
            logger.info("[STEP COMPLETE] task_id=%s step_number=%d service=%s", agent_run.task_id, step.step_number, step.service)

        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            import traceback
            logger.error(f"Error executing step {step.step_number} in task {agent_run.task_id}: {e}\n{traceback.format_exc()}")
            err_msg = str(e)
            err_type = type(e).__name__
            err_msg_lower = err_msg.lower()

            if "budget" in err_msg_lower or "0x028d7b37" in err_msg_lower or "hardcap" in err_msg_lower or err_type == "BudgetExceededError":
                err_code = "BUDGET_EXCEEDED"
                run_status = AgentRunStatus.BLOCKED
            elif "revert" in err_msg_lower or "contract" in err_msg_lower or err_type in ["ContractError", "ContractLogicError"]:
                err_code = "SMART_CONTRACT_REVERT"
                run_status = AgentRunStatus.FAILED
            elif "provider" in err_msg_lower or "402" in err_msg_lower or err_type == "ProviderError":
                err_code = "PROVIDER_ERROR"
                run_status = AgentRunStatus.FAILED
            elif "tx" in err_msg_lower or "broadcast" in err_msg_lower or err_type in ["PaymentAuthorizationError", "PaymentTransactionError"]:
                err_code = "PAYMENT_ERROR"
                run_status = AgentRunStatus.FAILED
            elif "404" in err_msg_lower or "not found" in err_msg_lower:
                err_code = "NOT_FOUND"
                run_status = AgentRunStatus.FAILED
            elif err_type in ["TypeError", "KeyError", "AttributeError", "RuntimeError", "ValueError"]:
                err_code = "EXECUTION_ERROR"
                run_status = AgentRunStatus.FAILED
            else:
                err_code = "UNKNOWN_ERROR"
                run_status = AgentRunStatus.FAILED

            # Re-query fresh DB instances to ensure modifications persist cleanly after rollback
            fresh_run = db.query(AgentRun).filter(AgentRun.task_id == agent_run.task_id).first()
            fresh_step = db.query(AgentRunStep).filter(AgentRunStep.id == step.id).first()

            if fresh_step:
                fresh_step.status = AgentRunStepStatus.BLOCKED if run_status == AgentRunStatus.BLOCKED else AgentRunStepStatus.FAILED
                fresh_step.error_code = err_code
                fresh_step.error_message = err_msg

            if fresh_run:
                fresh_run.status = run_status
                fresh_run.error_code = err_code
                fresh_run.error_message = err_msg

            db.commit()

            log_audit_event(
                db=db,
                request_id=agent_run.task_id,
                event_type="AGENT_RUN_BLOCKED" if run_status == AgentRunStatus.BLOCKED else "AGENT_RUN_FAILED",
                details={
                    "task_id": agent_run.task_id,
                    "failed_step": step.step_number,
                    "service": step.service,
                    "error_code": err_code,
                    "error": err_msg,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
            )
            return fresh_run or agent_run

    agent_run.status = AgentRunStatus.COMPLETED
    agent_run.completed_at = datetime.utcnow()
    agent_run.total_actual_cost_eth = total_actual_spent
    db.commit()

    log_audit_event(
        db=db,
        request_id=agent_run.task_id,
        event_type="AGENT_RUN_COMPLETED",
        details={
            "task_id": agent_run.task_id,
            "user_prompt": agent_run.user_prompt,
            "total_actual_cost_eth": f"{total_actual_spent:.6f} ETH",
            "step_count": len(agent_run.steps),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )
    logger.info("[TASK COMPLETE] task_id=%s total_cost=%.6f ETH", agent_run.task_id, total_actual_spent)
    return agent_run


def run_background_agent_task(task_id: str):
    """
    Background worker function that opens a fresh DB session and executes an AgentRun asynchronously.
    """
    logger.info("[TASK START] task_id=%s", task_id)
    db = SessionLocal()
    try:
        agent_run = db.query(AgentRun).filter(AgentRun.task_id == task_id).first()
        if not agent_run:
            logger.error(f"Background task failed: AgentRun {task_id} not found in DB")
            return

        if agent_run.status != AgentRunStatus.EXECUTING:
            logger.info(f"Background task for {task_id} skipped (current status: {agent_run.status})")
            return

        execute_agent_run_task(agent_run, db)
    except Exception as e:
        import traceback
        logger.error(f"Unhandled exception in background agent run execution {task_id}: {e}\n{traceback.format_exc()}")
        try:
            agent_run = db.query(AgentRun).filter(AgentRun.task_id == task_id).first()
            if agent_run and agent_run.status == AgentRunStatus.EXECUTING:
                agent_run.status = AgentRunStatus.FAILED
                agent_run.error_code = "UNKNOWN_ERROR"
                agent_run.error_message = str(e)
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update task status to FAILED after background error: {db_err}")
    finally:
        db.close()


@router.post("/run", response_model=AgentRunResponse)
def create_agent_run(req: AgentRunRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Receives a natural-language goal, plans required multi-service execution steps,
    evaluates planned costs against current contract budget, persists the AgentRun,
    and optionally executes the run asynchronously via HTTP 402 & Sepolia Smart Contract.
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User prompt cannot be empty."
        )

    task_id = str(uuid.uuid4())
    planner = AgentPlanner()
    plan = planner.create_plan(req.prompt)

    remaining_budget_eth = get_remaining_contract_budget(db)
    if req.max_budget_eth is not None and req.max_budget_eth > 0:
        remaining_budget_eth = min(remaining_budget_eth, req.max_budget_eth)

    # Evaluate plan cost against remaining budget → sets plan.budget_status
    plan = planner.evaluate_budget(plan, remaining_budget_eth)

    # Check for unsupported goal
    if len(plan.steps) == 0:
        err_code = "UNSUPPORTED_GOAL"
        err_msg = f"Could not detect supported service capabilities ('translation', 'storage', 'compute') from prompt: '{req.prompt}'"
        run_status = AgentRunStatus.FAILED

        now_dt = datetime.utcnow()
        agent_run = AgentRun(
            id=str(uuid.uuid4()),
            task_id=task_id,
            user_prompt=req.prompt,
            status=run_status,
            total_planned_cost_eth=0.0,
            budget_remaining_eth=remaining_budget_eth,
            error_code=err_code,
            error_message=err_msg,
            created_at=now_dt,
        )
        db.add(agent_run)
        db.commit()
        db.refresh(agent_run)

        log_audit_event(
            db=db,
            request_id=task_id,
            event_type="AGENT_RUN_UNSUPPORTED",
            details={
                "task_id": task_id,
                "user_prompt": req.prompt,
                "error_code": err_code,
                "error_message": err_msg,
                "timestamp": now_dt.isoformat() + "Z",
            }
        )

        return AgentRunResponse(
            task_id=agent_run.task_id,
            user_prompt=agent_run.user_prompt,
            status=agent_run.status.value,
            plan=[],
            total_planned_cost_eth=0.0,
            budget_remaining_eth=remaining_budget_eth,
            error_code=err_code,
            error_message=err_msg,
            created_at=agent_run.created_at.isoformat() + "Z",
        )

    # Check emergency kill switch state
    if is_kill_switch_active(db):
        run_status = AgentRunStatus.BLOCKED
        err_code = "KILL_SWITCH_ACTIVE"
        err_msg = "Agent execution is temporarily disabled by the emergency kill switch."
    # Evaluate plan against remaining budget
    elif plan.budget_status == "WITHIN_BUDGET":
        run_status = AgentRunStatus.PLANNED
        err_code = None
        err_msg = None
    else:
        run_status = AgentRunStatus.BLOCKED
        err_code = "BUDGET_EXCEEDED"
        err_msg = (
            f"PRE_EXECUTION_BUDGET_BLOCK: Total planned cost ({plan.total_planned_cost_eth:.6f} ETH) "
            f"exceeds remaining contract budget ({remaining_budget_eth:.6f} ETH)."
        )

    now_dt = datetime.utcnow()
    agent_run = AgentRun(
        id=str(uuid.uuid4()),
        task_id=task_id,
        user_prompt=req.prompt,
        status=run_status,
        total_planned_cost_eth=plan.total_planned_cost_eth,
        budget_remaining_eth=remaining_budget_eth,
        error_code=err_code,
        error_message=err_msg,
        created_at=now_dt,
    )
    db.add(agent_run)

    # Persist steps
    for step in plan.steps:
        step_model = AgentRunStep(
            id=str(uuid.uuid4()),
            agent_run_id=agent_run.id,
            task_id=task_id,
            step_number=step.step_number,
            service=step.service,
            reason=step.reason,
            input_dependency=step.input_dependency,
            provider_id=step.provider_id,
            quote_eth=step.quote_eth,
            status=AgentRunStepStatus.PLANNED,
            created_at=now_dt,
        )
        db.add(step_model)

    db.commit()
    db.refresh(agent_run)

    log_audit_event(
        db=db,
        request_id=task_id,
        event_type="AGENT_RUN_PLANNED" if run_status == AgentRunStatus.PLANNED else "AGENT_RUN_BLOCKED",
        details={
            "task_id": task_id,
            "user_prompt": req.prompt,
            "status": run_status.value,
            "total_planned_cost_eth": f"{plan.total_planned_cost_eth:.6f} ETH",
            "budget_remaining_eth": f"{remaining_budget_eth:.6f} ETH",
            "step_count": len(plan.steps),
            "error_code": err_code,
            "error_message": err_msg,
            "timestamp": now_dt.isoformat() + "Z",
        }
    )

    # Auto-execute asynchronously if requested and within budget
    if req.auto_execute and run_status == AgentRunStatus.PLANNED:
        agent_run.status = AgentRunStatus.EXECUTING
        agent_run.started_at = datetime.utcnow()
        db.commit()
        db.refresh(agent_run)
        background_tasks.add_task(run_background_agent_task, task_id)

    return _build_agent_run_response(agent_run)


@router.post("/run/execute/{task_id}", response_model=AgentRunResponse)
def execute_agent_run(task_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Triggers real multi-step execution of a planned AgentRun by task_id asynchronously."""
    agent_run = db.query(AgentRun).filter(AgentRun.task_id == task_id).first()
    if not agent_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent run with task_id '{task_id}' not found."
        )

    # Check emergency kill switch state
    if is_kill_switch_active(db):
        agent_run.status = AgentRunStatus.BLOCKED
        agent_run.error_code = "KILL_SWITCH_ACTIVE"
        agent_run.error_message = "Agent execution is temporarily disabled by the emergency kill switch."
        db.commit()
        db.refresh(agent_run)
        return _build_agent_run_response(agent_run)

    # Idempotency guard: prevent duplicate executions or double payments
    if agent_run.status in [AgentRunStatus.EXECUTING, AgentRunStatus.COMPLETED, AgentRunStatus.BLOCKED, AgentRunStatus.FAILED]:
        return _build_agent_run_response(agent_run)

    agent_run.status = AgentRunStatus.EXECUTING
    agent_run.started_at = datetime.utcnow()
    db.commit()
    db.refresh(agent_run)

    background_tasks.add_task(run_background_agent_task, task_id)
    return _build_agent_run_response(agent_run)


@router.get("/run/{task_id}", response_model=AgentRunResponse)
def get_agent_run(task_id: str, db: Session = Depends(get_db)):
    """Fetches a persisted AgentRun by task_id."""
    agent_run = db.query(AgentRun).filter(AgentRun.task_id == task_id).first()
    if not agent_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent run with task_id '{task_id}' not found."
        )

    return _build_agent_run_response(agent_run)


def _build_agent_run_response(agent_run: AgentRun) -> AgentRunResponse:
    """Helper to convert AgentRun SQLAlchemy model to Pydantic AgentRunResponse."""
    step_responses = []
    for s in agent_run.steps:
        parsed_res = None
        if s.result:
            try:
                parsed_res = json.loads(s.result)
            except Exception:
                parsed_res = s.result

        step_responses.append(
            AgentRunStepResponse(
                step=s.step_number,
                service=s.service,
                reason=s.reason,
                input_dependency=s.input_dependency,
                provider_id=s.provider_id,
                quote_eth=s.quote_eth,
                status=s.status.value if hasattr(s.status, "value") else str(s.status),
                transaction_hash=s.transaction_hash,
                content_hash=s.content_hash,
                result=parsed_res,
                error_message=s.error_message,
            )
        )

    return AgentRunResponse(
        task_id=agent_run.task_id,
        user_prompt=agent_run.user_prompt,
        status=agent_run.status.value if hasattr(agent_run.status, "value") else str(agent_run.status),
        plan=step_responses,
        total_planned_cost_eth=agent_run.total_planned_cost_eth,
        total_actual_cost_eth=agent_run.total_actual_cost_eth,
        budget_remaining_eth=agent_run.budget_remaining_eth,
        error_code=agent_run.error_code,
        error_message=agent_run.error_message,
        created_at=agent_run.created_at.isoformat() + "Z",
        started_at=agent_run.started_at.isoformat() + "Z" if agent_run.started_at else None,
        completed_at=agent_run.completed_at.isoformat() + "Z" if agent_run.completed_at else None,
    )
