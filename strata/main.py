from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strata import config
from strata.models.schemas import HealthResponse
from strata.routers import webhooks, admin, documents, reviews, clients

app = FastAPI(
    title="STRATA",
    description="Regulatory intelligence platform for US utilities and energy developers",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)
app.include_router(admin.router)
app.include_router(documents.router)
app.include_router(reviews.router)
app.include_router(clients.router)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", environment=config.ENVIRONMENT)
