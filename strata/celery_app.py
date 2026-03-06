from celery import Celery
from strata import config

celery = Celery(
    "strata",
    broker=config.REDIS_URL,
    backend=config.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_routes={
        "strata.workers.ingest.*": {"queue": "ingest"},
        "strata.workers.extraction.*": {"queue": "extraction"},
        "strata.workers.document_gen.*": {"queue": "document_gen"},
    },
)

celery.autodiscover_tasks(["strata.workers"])
