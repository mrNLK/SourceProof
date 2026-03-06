"""
Ingest Worker: Process documents detected by Monitor.
"""

import asyncio
import logging
import re

from strata.celery_app import celery
from strata.database import supabase
from strata.services import document_fetcher, exa_corpus

logger = logging.getLogger(__name__)

DOCKET_PATTERN = re.compile(r"(E[LR]\d{2}-\d+-\d+)")


@celery.task(name="strata.workers.ingest.process_document")
def process_document(source_url: str, monitor_id: str, monitor_metadata: dict):
    """Process a document detected by Monitor."""
    loop = asyncio.new_event_loop()
    try:
        record = loop.run_until_complete(
            document_fetcher.build_document_record(source_url, monitor_id, monitor_metadata)
        )
    finally:
        loop.close()

    if not record.get("success"):
        supabase.table("audit_log").insert(
            {
                "event_type": "document_fetch_failed",
                "entity_type": "regulatory_item",
                "metadata": {
                    "source_url": source_url,
                    "error": record.get("error"),
                    "monitor_id": monitor_id,
                },
            }
        ).execute()
        logger.error("Failed to fetch %s: %s", source_url, record.get("error"))
        return

    # Extract docket number from raw text
    docket_number = None
    raw_text = record.get("raw_text", "")
    match = DOCKET_PATTERN.search(raw_text)
    if match:
        docket_number = match.group(1)

    # Check for prior version
    prior_version_id = None
    if docket_number:
        prior = exa_corpus.find_prior_version(docket_number)
        if prior:
            prior_version_id = prior["id"]

    # Upsert into regulatory_items
    item_data = {
        "source_url": source_url,
        "raw_text": raw_text,
        "filing_type": record.get("filing_type"),
        "docket_number": docket_number,
        "jurisdiction": monitor_metadata.get("jurisdiction", "FERC"),
        "enrichment_data": {
            "content_type": record.get("content_type"),
            "page_count": record.get("page_count"),
            "fetch_timestamp": record.get("fetch_timestamp"),
            "monitor_id": monitor_id,
        },
    }

    # Check if item already exists
    existing = (
        supabase.table("regulatory_items")
        .select("id")
        .eq("source_url", source_url)
        .limit(1)
        .execute()
    )

    if existing.data:
        regulatory_item_id = existing.data[0]["id"]
        supabase.table("regulatory_items").update(item_data).eq(
            "id", regulatory_item_id
        ).execute()
    else:
        result = supabase.table("regulatory_items").insert(item_data).execute()
        regulatory_item_id = result.data[0]["id"]

    # Write audit log
    supabase.table("audit_log").insert(
        {
            "event_type": "document_ingested",
            "entity_type": "regulatory_item",
            "entity_id": regulatory_item_id,
            "metadata": {
                "source_url": source_url,
                "filing_type": record.get("filing_type"),
                "docket_number": docket_number,
                "monitor_id": monitor_id,
            },
        }
    ).execute()

    logger.info(
        "Ingested document %s (type=%s, docket=%s)",
        regulatory_item_id,
        record.get("filing_type"),
        docket_number,
    )

    # Dispatch extraction task
    from strata.workers.extraction import run_extraction

    run_extraction.delay(regulatory_item_id, prior_version_id)
