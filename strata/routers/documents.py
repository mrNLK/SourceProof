"""Document retrieval and audit trail endpoints — scoped by client membership."""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse

from strata.auth import get_current_user
from strata.database import supabase
from strata.models.schemas import CurrentUser

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/current")
async def get_current_document(user: CurrentUser = Depends(get_current_user)):
    """Get the most recent published document for the user's active client."""
    result = (
        supabase.table("document_versions")
        .select("*")
        .eq("client_uuid", user.client_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No published document found")

    dv = result.data[0]

    ri = {}
    if dv.get("regulatory_item_id"):
        ri_result = (
            supabase.table("regulatory_items")
            .select("id, filing_type, docket_number, jurisdiction, source_url")
            .eq("id", dv["regulatory_item_id"])
            .limit(1)
            .execute()
        )
        ri = ri_result.data[0] if ri_result.data else {}

    return {**dv, "regulatory_item": ri}


@router.get("/history")
async def get_document_history(user: CurrentUser = Depends(get_current_user)):
    """Get version history for the user's active client (summary only)."""
    result = (
        supabase.table("document_versions")
        .select(
            "id, version_number, status, template_type, created_at, "
            "regulatory_item_id, extraction_data"
        )
        .eq("client_uuid", user.client_id)
        .order("version_number", desc=True)
        .execute()
    )

    items = []
    for dv in result.data:
        extraction = dv.get("extraction_data", {}) or {}
        docket = None
        if dv.get("regulatory_item_id"):
            ri = (
                supabase.table("regulatory_items")
                .select("docket_number")
                .eq("id", dv["regulatory_item_id"])
                .limit(1)
                .execute()
            )
            if ri.data:
                docket = ri.data[0].get("docket_number")

        items.append({
            "id": dv["id"],
            "version_number": dv["version_number"],
            "status": dv["status"],
            "created_at": dv["created_at"],
            "docket_number": docket,
            "what_changed": extraction.get("what_changed", ""),
        })

    return items


@router.get("/{document_version_id}/audit-trail")
async def get_audit_trail(
    document_version_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get full audit trail for a document version."""
    # Verify document belongs to user's client
    dv = (
        supabase.table("document_versions")
        .select("regulatory_item_id, client_uuid")
        .eq("id", document_version_id)
        .limit(1)
        .execute()
    )
    if not dv.data:
        raise HTTPException(status_code=404, detail="Document version not found")
    if dv.data[0].get("client_uuid") and dv.data[0]["client_uuid"] != user.client_id:
        raise HTTPException(status_code=403, detail="Document belongs to another client")

    doc_audit = (
        supabase.table("audit_log")
        .select("*")
        .eq("entity_id", document_version_id)
        .order("created_at")
        .execute()
    )

    all_entries = doc_audit.data or []

    if dv.data[0].get("regulatory_item_id"):
        ri_audit = (
            supabase.table("audit_log")
            .select("*")
            .eq("entity_id", dv.data[0]["regulatory_item_id"])
            .order("created_at")
            .execute()
        )
        all_entries.extend(ri_audit.data or [])

    all_entries.sort(key=lambda x: x.get("created_at", ""))
    return all_entries


@router.get("/{document_version_id}/html", response_class=HTMLResponse)
async def get_document_html(document_version_id: str):
    """Render document HTML directly.

    This endpoint is intentionally unauthenticated so it can be loaded
    in an iframe. Access control happens at the review-detail / document
    list level.
    """
    result = (
        supabase.table("document_versions")
        .select("content_html")
        .eq("id", document_version_id)
        .limit(1)
        .execute()
    )
    if not result.data or not result.data[0].get("content_html"):
        raise HTTPException(status_code=404, detail="Document HTML not found")

    return result.data[0]["content_html"]
