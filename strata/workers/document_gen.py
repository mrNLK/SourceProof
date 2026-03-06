"""
Document Generation Worker: Generate redlined memos via Claude API.
"""

import logging

from strata.celery_app import celery
from strata.database import supabase
from strata.services import document_generator

logger = logging.getLogger(__name__)


@celery.task(name="strata.workers.document_gen.generate_redline")
def generate_redline(document_version_id: str):
    """Generate a redlined document update."""
    # Fetch document version
    doc_version = (
        supabase.table("document_versions")
        .select("*")
        .eq("id", document_version_id)
        .limit(1)
        .execute()
    )
    if not doc_version.data:
        logger.error("Document version %s not found", document_version_id)
        return

    dv = doc_version.data[0]
    extraction_data = dv.get("extraction_data", {})
    client_id = dv.get("client_id", "FERC")

    # Map impacted assets
    try:
        impacted_assets = document_generator.map_impacted_assets(extraction_data, client_id)
    except Exception as e:
        logger.warning("Failed to map assets for %s: %s", document_version_id, e)
        impacted_assets = []

    # Generate redline
    try:
        html_content = document_generator.generate_redline(document_version_id)
    except Exception as e:
        logger.error("Failed to generate redline for %s: %s", document_version_id, e)
        supabase.table("audit_log").insert(
            {
                "event_type": "redline_generation_failed",
                "entity_type": "document_version",
                "entity_id": document_version_id,
                "metadata": {"error": str(e)},
            }
        ).execute()
        return

    # Update document version
    supabase.table("document_versions").update(
        {
            "content_html": html_content,
            "impacted_assets": impacted_assets,
            "status": "pending_review",
        }
    ).eq("id", document_version_id).execute()

    # Create review queue entry
    supabase.table("review_queue").insert(
        {
            "document_version_id": document_version_id,
            "assigned_reviewer": "default",
            "status": "pending",
        }
    ).execute()

    # Audit log
    supabase.table("audit_log").insert(
        {
            "event_type": "redline_generated",
            "entity_type": "document_version",
            "entity_id": document_version_id,
            "metadata": {
                "document_version_id": document_version_id,
                "impacted_asset_count": len(impacted_assets),
            },
        }
    ).execute()

    logger.info(
        "Redline generated for %s (%d impacted assets)",
        document_version_id,
        len(impacted_assets),
    )
