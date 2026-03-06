"""Webhook endpoints for inbound Monitor events."""

import logging
from fastapi import APIRouter, Request, Header, HTTPException

from strata import config
from strata.database import supabase
from strata.services import monitor_manager
from strata.workers.ingest import process_document

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/monitor")
async def monitor_webhook(
    request: Request,
    x_webhook_secret: str = Header(None),
):
    """Handle inbound Parallel Monitor webhook events."""
    if x_webhook_secret != config.WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    payload = await request.json()
    logger.info("Monitor webhook received: type=%s", payload.get("type"))

    data = payload.get("data", {})
    monitor_id = data.get("monitor_id")
    event_info = data.get("event", {})
    event_group_id = event_info.get("event_group_id")
    metadata = data.get("metadata", {})

    if not monitor_id or not event_group_id:
        logger.warning("Webhook missing monitor_id or event_group_id")
        return {"received": True, "queued": 0}

    # Fetch full events from the event group
    event_group = monitor_manager.get_event_group(monitor_id, event_group_id)
    events = event_group.get("events", [])

    total_queued = 0
    for event in events:
        source_urls = event.get("source_urls", [])
        output = event.get("output", "")

        # Write to audit log
        supabase.table("audit_log").insert(
            {
                "event_type": "monitor_event_detected",
                "entity_type": "monitor",
                "metadata": {
                    "monitor_id": monitor_id,
                    "event_group_id": event_group_id,
                    "source_urls": source_urls,
                    "output": output,
                },
            }
        ).execute()

        # Dispatch ingest task for each source URL
        for url in source_urls:
            process_document.delay(url, monitor_id, metadata)
            total_queued += 1

    return {"received": True, "queued": total_queued}
