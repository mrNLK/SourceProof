"""Admin endpoints for monitor management, corpus, and testing."""

from fastapi import APIRouter

from strata.database import supabase
from strata.models.schemas import TriggerRequest
from strata.services import monitor_manager, exa_corpus
from strata.workers.ingest import process_document

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/monitors")
async def list_monitors():
    """List all monitors from registry."""
    result = supabase.table("monitor_registry").select("*").execute()
    return result.data


@router.post("/monitors/init")
async def init_monitors():
    """Initialize FERC monitors."""
    results = monitor_manager.initialize_ferc_monitors()
    return {"monitors": [r["monitor_id"] for r in results]}


@router.delete("/monitors/{monitor_id}", status_code=204)
async def delete_monitor(monitor_id: str):
    """Delete a monitor."""
    monitor_manager.delete_monitor(monitor_id)


@router.get("/corpus")
async def list_corpus():
    """List regulatory items (summary, no raw_text)."""
    result = (
        supabase.table("regulatory_items")
        .select(
            "id, webset_id, exa_item_id, filing_type, docket_number, "
            "jurisdiction, effective_date, affected_utilities, source_url, "
            "enrichment_data, created_at, updated_at"
        )
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data


@router.post("/corpus/init")
async def init_corpus():
    """Initialize FERC corpus via Exa Websets."""
    results, total = exa_corpus.initialize_ferc_corpus()
    return {"synced": total}


@router.post("/corpus/sync")
async def sync_corpus():
    """Sync all websets."""
    registry = supabase.table("webset_registry").select("webset_id").execute()
    total = 0
    for row in registry.data:
        count = exa_corpus.sync_webset_items(row["webset_id"])
        total += count
    return {"synced": total}


@router.get("/assets")
async def list_assets(client_id: str = None):
    """List assets, optionally filtered by client_id."""
    query = supabase.table("asset_registry").select("*")
    if client_id:
        query = query.eq("client_id", client_id)
    result = query.execute()
    return result.data


@router.post("/test/trigger")
async def test_trigger(req: TriggerRequest):
    """Manually trigger the pipeline for a given source URL."""
    process_document.delay(req.source_url, req.monitor_id, {"source": "manual_test"})
    return {"queued": True, "source_url": req.source_url}
