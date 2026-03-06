"""Document retrieval and audit trail endpoints."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from strata.database import supabase

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/{client_id}/current")
async def get_current_document(client_id: str):
    """Get the most recent published document for a client."""
    result = (
        supabase.table("document_versions")
        .select("*")
        .eq("client_id", client_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No published document found")

    dv = result.data[0]

    # Fetch regulatory item context
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

    return {
        **dv,
        "regulatory_item": ri,
    }


@router.get("/{client_id}/history")
async def get_document_history(client_id: str):
    """Get version history for a client (summary only)."""
    result = (
        supabase.table("document_versions")
        .select(
            "id, version_number, status, template_type, created_at, "
            "regulatory_item_id, extraction_data"
        )
        .eq("client_id", client_id)
        .order("version_number", desc=True)
        .execute()
    )

    items = []
    for dv in result.data:
        extraction = dv.get("extraction_data", {}) or {}
        # Fetch docket number
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
async def get_audit_trail(document_version_id: str):
    """Get full audit trail for a document version."""
    # Get audit entries for this document version
    doc_audit = (
        supabase.table("audit_log")
        .select("*")
        .eq("entity_id", document_version_id)
        .order("created_at")
        .execute()
    )

    # Also get audit entries for the associated regulatory item
    dv = (
        supabase.table("document_versions")
        .select("regulatory_item_id")
        .eq("id", document_version_id)
        .limit(1)
        .execute()
    )

    all_entries = doc_audit.data or []

    if dv.data and dv.data[0].get("regulatory_item_id"):
        ri_audit = (
            supabase.table("audit_log")
            .select("*")
            .eq("entity_id", dv.data[0]["regulatory_item_id"])
            .order("created_at")
            .execute()
        )
        all_entries.extend(ri_audit.data or [])

    # Sort by created_at
    all_entries.sort(key=lambda x: x.get("created_at", ""))
    return all_entries


@router.get("/{document_version_id}/html", response_class=HTMLResponse)
async def get_document_html(document_version_id: str):
    """Render document HTML directly."""
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
