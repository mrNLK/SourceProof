"""
Extraction Worker: Run Deep Research extraction on regulatory items.
"""

import logging
import time

from strata.celery_app import celery
from strata.database import supabase
from strata.services import extractor

logger = logging.getLogger(__name__)

POLL_INTERVAL = 10  # seconds
MAX_POLL_TIME = 300  # 5 minutes


def _resolve_client_ids(item: dict) -> tuple[str, str | None]:
    """Resolve text client_id (slug) and UUID client_uuid for a regulatory item.

    Priority:
    1. regulatory_item.client_id (UUID FK set during ingestion via manual trigger)
    2. No fallback — if no client is assigned, return (jurisdiction, None).
       Documents created without a client_uuid will not appear in any
       client-scoped view until explicitly assigned.
    """
    client_uuid = item.get("client_id")  # UUID FK from regulatory_items

    if client_uuid:
        client = (
            supabase.table("clients")
            .select("slug")
            .eq("id", client_uuid)
            .limit(1)
            .execute()
        )
        slug = client.data[0]["slug"] if client.data else "unassigned"
        return slug, client_uuid

    # No client assigned — use jurisdiction as display label, no UUID.
    # This item will need manual client assignment before it appears
    # in a tenant-scoped view.
    logger.warning(
        "Regulatory item %s has no client_id; documents will be unscoped",
        item.get("id"),
    )
    return item.get("jurisdiction", "FERC"), None


@celery.task(name="strata.workers.extraction.run_extraction")
def run_extraction(regulatory_item_id: str, prior_version_id: str = None):
    """Run Deep Research extraction on a regulatory item."""
    # Fetch regulatory item
    result = (
        supabase.table("regulatory_items")
        .select("*")
        .eq("id", regulatory_item_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        logger.error("Regulatory item %s not found", regulatory_item_id)
        return

    item = result.data[0]

    # Fetch prior version text if available
    prior_text = None
    if prior_version_id:
        prior = (
            supabase.table("regulatory_items")
            .select("raw_text")
            .eq("id", prior_version_id)
            .limit(1)
            .execute()
        )
        if prior.data:
            prior_text = prior.data[0].get("raw_text")

    # Launch extraction
    try:
        parallel_job_id = extractor.run_extraction(regulatory_item_id, prior_text)
    except Exception as e:
        logger.error("Failed to start extraction for %s: %s", regulatory_item_id, e)
        supabase.table("audit_log").insert(
            {
                "event_type": "extraction_failed",
                "entity_type": "regulatory_item",
                "entity_id": regulatory_item_id,
                "metadata": {"error": str(e)},
            }
        ).execute()
        return

    # Poll for completion
    elapsed = 0
    extraction_data = None
    while elapsed < MAX_POLL_TIME:
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
        extraction_data = extractor.poll_extraction(parallel_job_id)
        if extraction_data is not None:
            break

    if extraction_data is None:
        logger.error("Extraction timed out for %s (job %s)", regulatory_item_id, parallel_job_id)
        supabase.table("audit_log").insert(
            {
                "event_type": "extraction_timeout",
                "entity_type": "regulatory_item",
                "entity_id": regulatory_item_id,
                "metadata": {"parallel_job_id": parallel_job_id},
            }
        ).execute()
        return

    if "error" in extraction_data and extraction_data.get("confidence") == "low":
        logger.error("Extraction failed for %s: %s", regulatory_item_id, extraction_data.get("error"))
        supabase.table("audit_log").insert(
            {
                "event_type": "extraction_failed",
                "entity_type": "regulatory_item",
                "entity_id": regulatory_item_id,
                "metadata": {"error": extraction_data.get("error"), "parallel_job_id": parallel_job_id},
            }
        ).execute()
        return

    # Validate extraction
    is_valid = extractor.validate_extraction(extraction_data)
    confidence = extraction_data.get("confidence", "low")

    # Resolve client identity
    client_slug, client_uuid = _resolve_client_ids(item)

    # Determine next version number — scope by client to prevent cross-tenant collisions
    version_query = (
        supabase.table("document_versions")
        .select("version_number")
        .eq("regulatory_item_id", regulatory_item_id)
    )
    if client_uuid:
        version_query = version_query.eq("client_uuid", client_uuid)
    existing_versions = (
        version_query.order("version_number", desc=True).limit(1).execute()
    )
    next_version = (existing_versions.data[0]["version_number"] + 1) if existing_versions.data else 1

    # Create document version
    doc_data = {
        "client_id": client_slug,
        "regulatory_item_id": regulatory_item_id,
        "version_number": next_version,
        "status": "draft",
        "template_type": "leadership_memo",
        "extraction_data": extraction_data,
        "parallel_job_id": parallel_job_id,
    }
    if client_uuid:
        doc_data["client_uuid"] = client_uuid

    try:
        doc_version = supabase.table("document_versions").insert(doc_data).execute()
        document_version_id = doc_version.data[0]["id"]
    except Exception as e:
        logger.error("Failed to create document version for %s: %s", regulatory_item_id, e)
        supabase.table("audit_log").insert(
            {
                "event_type": "document_version_creation_failed",
                "entity_type": "regulatory_item",
                "entity_id": regulatory_item_id,
                "client_id": client_uuid,
                "metadata": {"error": str(e), "parallel_job_id": parallel_job_id},
            }
        ).execute()
        return

    # Audit log
    supabase.table("audit_log").insert(
        {
            "event_type": "extraction_complete",
            "entity_type": "document_version",
            "entity_id": document_version_id,
            "client_id": client_uuid,
            "metadata": {
                "regulatory_item_id": regulatory_item_id,
                "confidence": confidence,
                "valid": is_valid,
                "parallel_job_id": parallel_job_id,
            },
        }
    ).execute()

    logger.info(
        "Extraction complete for %s → doc version %s (confidence=%s, client=%s)",
        regulatory_item_id,
        document_version_id,
        confidence,
        client_slug,
    )

    # Dispatch document generation
    from strata.workers.document_gen import generate_redline

    generate_redline.delay(document_version_id)
