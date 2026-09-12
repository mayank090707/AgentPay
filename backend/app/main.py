from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import init_db
from backend.app.api.health import router as health_router
from backend.app.api.services import router as services_router
from backend.app.api.payment import router as payment_router
from backend.app.api.receipts import router as receipts_router
from backend.app.api.audit import router as audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AgentPay Service Provider & HTTP 402 Backend Infrastructure",
    lifespan=lifespan
)

# Enable CORS for frontend & client integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Payment-Required",
        "X-Payment-Quote-Id",
        "X-Payment-Amount",
        "X-Payment-Asset",
        "X-Payment-Address",
        "X-Request-ID"
    ]
)

# Include Routers
app.include_router(health_router)
app.include_router(services_router)
app.include_router(payment_router)
app.include_router(receipts_router)
app.include_router(audit_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
