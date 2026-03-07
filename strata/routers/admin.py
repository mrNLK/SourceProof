"""Admin endpoints for monitor management, corpus, and testing."""

from fastapi import APIRouter, Depends

from strata.auth import get_current_user, require_role
from strata.database import supabase
from strata.models.schemas import CurrentUser, TriggerRequest
from strata.services import monitor_manager, exa_corpus
from strata.workers.ingest import process_document

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/monitors")
async def list_monitors(user: CurrentUser = Depends(get_current_user)):
    """List all monitors from registry."""
    result = supabase.table("monitor_registry").select("*").execute()
    return result.data


@router.post("/monitors/init")
async def init_monitors(user: CurrentUser = Depends(require_role("admin"))):
    """Initialize FERC monitors."""
    results = monitor_manager.initialize_ferc_monitors()
    return {"monitors": [r["monitor_id"] for r in results]}


@router.delete("/monitors/{monitor_id}", status_code=204)
async def delete_monitor(
    monitor_id: str,
    user: CurrentUser = Depends(require_role("admin")),
):
    """Delete a monitor."""
    monitor_manager.delete_monitor(monitor_id)


@router.get("/corpus")
async def list_corpus(user: CurrentUser = Depends(get_current_user)):
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
async def init_corpus(user: CurrentUser = Depends(require_role("admin"))):
    """Initialize FERC corpus via Exa Websets."""
    results, total = exa_corpus.initialize_ferc_corpus()
    return {"synced": total}


@router.post("/corpus/sync")
async def sync_corpus(user: CurrentUser = Depends(require_role("admin"))):
    """Sync all websets."""
    registry = supabase.table("webset_registry").select("webset_id").execute()
    total = 0
    for row in registry.data:
        count = exa_corpus.sync_webset_items(row["webset_id"])
        total += count
    return {"synced": total}


@router.get("/assets")
async def list_assets(user: CurrentUser = Depends(get_current_user)):
    """List assets for the user's active client."""
    result = (
        supabase.table("asset_registry")
        .select("*")
        .eq("client_uuid", user.client_id)
        .execute()
    )
    return result.data


@router.post("/test/trigger")
async def test_trigger(
    req: TriggerRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Manually trigger the pipeline for a given source URL."""
    process_document.delay(
        req.source_url,
        req.monitor_id,
        {"source": "manual_test", "client_id": user.client_id},
    )
    return {"queued": True, "source_url": req.source_url}
