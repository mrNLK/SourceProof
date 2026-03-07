"""Reviewer workflow API endpoints — scoped by client membership."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from strata.auth import get_current_user, require_role
from strata.database import supabase
from strata.models.schemas import CurrentUser, ReviewAction

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/queue")
async def get_review_queue(user: CurrentUser = Depends(get_current_user)):
    """List pending review items for the user's active client."""
    result = (
        supabase.table("review_queue")
        .select(
            "id, document_version_id, status, created_at, client_id, "
            "document_versions(id, client_uuid, extraction_data, impacted_assets, "
            "regulatory_item_id, document_versions_regulatory_item_id_fkey("
            "filing_type, docket_number))"
        )
        .eq("status", "pending")
        .eq("client_id", user.client_id)
        .order("created_at")
        .execute()
    )

    items = []
    for row in result.data:
        dv = row.get("document_versions", {}) or {}
        ri = dv.get("document_versions_regulatory_item_id_fkey", {}) or {}
        extraction = dv.get("extraction_data", {}) or {}
        impacted = dv.get("impacted_assets", []) or []

        items.append({
            "id": row["id"],
            "document_version_id": row["document_version_id"],
            "filing_type": ri.get("filing_type"),
            "docket_number": ri.get("docket_number"),
            "plain_english_summary": extraction.get("plain_english_summary", ""),
            "impacted_asset_count": len(impacted),
            "created_at": row["created_at"],
        })

    return items


def _fetch_review_for_client(review_queue_id: str, client_id: str) -> dict:
    """Fetch a review record and verify it belongs to the client."""
    review = (
        supabase.table("review_queue")
        .select("*")
        .eq("id", review_queue_id)
        .limit(1)
        .execute()
    )
    if not review.data:
        raise HTTPException(status_code=404, detail="Review not found")
    row = review.data[0]
    if row.get("client_id") and row["client_id"] != client_id:
        raise HTTPException(status_code=403, detail="Review belongs to another client")
    return row


@router.get("/{review_queue_id}")
async def get_review_detail(
    review_queue_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get full review detail including document, extraction, and audit trail."""
    review_data = _fetch_review_for_client(review_queue_id, user.client_id)
    dv_id = review_data["document_version_id"]

    doc_version = (
        supabase.table("document_versions")
        .select("*")
        .eq("id", dv_id)
        .limit(1)
        .execute()
    )
    dv_data = doc_version.data[0] if doc_version.data else {}

    ri_id = dv_data.get("regulatory_item_id")
    ri_data = {}
    if ri_id:
        ri = (
            supabase.table("regulatory_items")
            .select("id, filing_type, docket_number, jurisdiction, source_url, effective_date, affected_utilities")
            .eq("id", ri_id)
            .limit(1)
            .execute()
        )
        ri_data = ri.data[0] if ri.data else {}

    audit = (
        supabase.table("audit_log")
        .select("*")
        .eq("entity_id", dv_id)
        .order("created_at")
        .execute()
    )

    return {
        "review": review_data,
        "document_version": dv_data,
        "regulatory_item": ri_data,
        "extraction_data": dv_data.get("extraction_data"),
        "impacted_assets": dv_data.get("impacted_assets"),
        "audit_trail": audit.data,
    }


@router.post("/{review_queue_id}/approve")
async def approve_review(
    review_queue_id: str,
    user: CurrentUser = Depends(require_role("admin", "reviewer")),
):
    """Approve a review and publish the document version."""
    review_data = _fetch_review_for_client(review_queue_id, user.client_id)
    dv_id = review_data["document_version_id"]
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("review_queue").update(
        {"status": "approved", "resolved_at": now}
    ).eq("id", review_queue_id).execute()

    supabase.table("document_versions").update(
        {"status": "published"}
    ).eq("id", dv_id).execute()

    supabase.table("audit_log").insert(
        {
            "event_type": "review_approved",
            "entity_type": "document_version",
            "entity_id": dv_id,
            "client_id": user.client_id,
            "metadata": {"reviewer_id": user.user_id, "reviewer_email": user.email},
        }
    ).execute()

    return {"published": True, "document_version_id": dv_id}


@router.post("/{review_queue_id}/reject")
async def reject_review(
    review_queue_id: str,
    action: ReviewAction,
    user: CurrentUser = Depends(require_role("admin", "reviewer")),
):
    """Reject a review."""
    review_data = _fetch_review_for_client(review_queue_id, user.client_id)
    dv_id = review_data["document_version_id"]
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("review_queue").update(
        {"status": "rejected", "reviewer_notes": action.notes, "resolved_at": now}
    ).eq("id", review_queue_id).execute()

    supabase.table("document_versions").update(
        {"status": "draft"}
    ).eq("id", dv_id).execute()

    supabase.table("audit_log").insert(
        {
            "event_type": "review_rejected",
            "entity_type": "document_version",
            "entity_id": dv_id,
            "client_id": user.client_id,
            "metadata": {"reviewer_id": user.user_id, "notes": action.notes},
        }
    ).execute()

    return {"rejected": True}


@router.post("/{review_queue_id}/request-revision")
async def request_revision(
    review_queue_id: str,
    action: ReviewAction,
    user: CurrentUser = Depends(require_role("admin", "reviewer")),
):
    """Request revision on a review item."""
    _fetch_review_for_client(review_queue_id, user.client_id)

    supabase.table("review_queue").update(
        {"status": "revision_requested", "reviewer_notes": action.notes}
    ).eq("id", review_queue_id).execute()

    return {"revision_requested": True}
