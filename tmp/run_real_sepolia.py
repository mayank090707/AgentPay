import dotenv
dotenv.load_dotenv('.env')
import sys
import traceback
import logging

from backend.app.database import SessionLocal, init_db
from backend.app.models.agent_run import AgentRun
from backend.app.api.agent_run import create_agent_run, AgentRunRequest, execute_agent_run_task
from fastapi.background import BackgroundTasks

def main():
    init_db()
    db = SessionLocal()
    prompt_text = "Translate 'Hello World' into Hindi and store the result."
    req = AgentRunRequest(prompt=prompt_text, auto_execute=True)
    bg = BackgroundTasks()
    res = create_agent_run(req, bg, db)

    with open('real_run_output.txt', 'w', encoding='utf-8') as f:
        f.write("REAL AGENT RUN CREATED\n")
        f.write(f"TASK ID: {res.task_id}\n")
        f.write(f"PROMPT: {res.user_prompt}\n")
        f.write(f"STATUS BEFORE EXEC: {res.status}\n")
        
        agent_run = db.query(AgentRun).filter(AgentRun.task_id == res.task_id).first()
        try:
            execute_agent_run_task(agent_run, db)
        except Exception as e:
            f.write(f"EXECUTION EXCEPTION: {type(e)} {e}\n")
            f.write(traceback.format_exc())

        db.refresh(agent_run)
        total_spent = sum(s.quote_eth for s in agent_run.steps if s.status.value == 'FULFILLED')
        f.write(f"STATUS AFTER EXEC: {agent_run.status.value}\n")
        f.write(f"ERR_CODE: {agent_run.error_code}\n")
        f.write(f"ERR_MSG: {agent_run.error_message}\n")
        f.write(f"TOTAL SPENT ETH: {total_spent:.6f}\n")
        for s in agent_run.steps:
            f.write(f"STEP {s.step_number} [{s.service}]: status={s.status.value} | provider={s.provider_id} | quote={s.quote_eth} ETH | TX: {s.transaction_hash} | RES: {s.result}\n")

if __name__ == "__main__":
    main()
