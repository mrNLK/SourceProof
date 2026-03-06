from fastapi import FastAPI
from strata import config
from strata.models.schemas import HealthResponse
from strata.routers import webhooks, admin, documents, reviews

app = FastAPI(
    title="STRATA",
    description="Regulatory intelligence platform for US utilities and energy developers",
    version="0.1.0",
)

app.include_router(webhooks.router)
app.include_router(admin.router)
app.include_router(documents.router)
app.include_router(reviews.router)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", environment=config.ENVIRONMENT)
