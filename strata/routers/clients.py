"""Client and membership management endpoints."""

from fastapi import APIRouter, Depends, Header, HTTPException

from strata.auth import get_current_user, require_role
from strata.database import supabase
from strata.models.schemas import (
    ClientCreate,
    CurrentUser,
    MembershipCreate,
    UserCreate,
)

router = APIRouter(prefix="/clients", tags=["clients"])


# ── Routes that must be declared before /{client_id} patterns ─────────


@router.get("/users/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Get the current user's info and role."""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "display_name": user.display_name,
        "client_id": user.client_id,
        "client_slug": user.client_slug,
        "role": user.role,
    }


@router.post("/users")
async def create_user(
    body: UserCreate,
    user: CurrentUser = Depends(require_role("admin")),
):
    """Create a new user (admin only)."""
    result = (
        supabase.table("users")
        .insert({"email": body.email, "display_name": body.display_name})
        .execute()
    )
    return result.data[0]


@router.get("/mine")
async def list_my_clients(x_user_email: str = Header(...)):
    """List clients the user has access to.

    This endpoint only requires X-User-Email (not X-Client-Id) so it
    can be called during frontend bootstrap before a client is selected.
    """
    user_result = (
        supabase.table("users")
        .select("id")
        .eq("email", x_user_email)
        .limit(1)
        .execute()
    )
    if not user_result.data:
        raise HTTPException(status_code=401, detail="Unknown user")

    user_id = user_result.data[0]["id"]
    result = (
        supabase.table("client_memberships")
        .select("client_id, role, clients(id, name, slug, is_active, metadata, created_at)")
        .eq("user_id", user_id)
        .execute()
    )
    return [
        {**row["clients"], "role": row["role"]}
        for row in result.data
        if row.get("clients")
    ]


@router.get("/current")
async def get_current_client(user: CurrentUser = Depends(get_current_user)):
    """Get details of the currently active client."""
    result = (
        supabase.table("clients")
        .select("*")
        .eq("id", user.client_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Client not found")
    return result.data[0]


@router.post("/")
async def create_client(
    body: ClientCreate,
    user: CurrentUser = Depends(require_role("admin")),
):
    """Create a new client organization (admin only)."""
    result = (
        supabase.table("clients")
        .insert({"name": body.name, "slug": body.slug, "metadata": body.metadata or {}})
        .execute()
    )
    new_client = result.data[0]

    supabase.table("client_memberships").insert(
        {"user_id": user.user_id, "client_id": new_client["id"], "role": "admin"}
    ).execute()

    return new_client


# ── Parameterized routes: /{client_id}/... ────────────────────────────


@router.get("/{client_id}/members")
async def list_members(
    client_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """List members of a client. Must be a member to view."""
    membership = (
        supabase.table("client_memberships")
        .select("role")
        .eq("user_id", user.user_id)
        .eq("client_id", client_id)
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this client")

    result = (
        supabase.table("client_memberships")
        .select("id, role, created_at, users(id, email, display_name, is_active)")
        .eq("client_id", client_id)
        .execute()
    )
    return [
        {
            "membership_id": row["id"],
            "role": row["role"],
            "created_at": row["created_at"],
            **(row.get("users") or {}),
        }
        for row in result.data
    ]


@router.post("/{client_id}/members")
async def add_member(
    client_id: str,
    body: MembershipCreate,
    user: CurrentUser = Depends(require_role("admin")),
):
    """Add a user to a client with a role (admin only)."""
    if body.role not in ("admin", "analyst", "reviewer"):
        raise HTTPException(status_code=400, detail="Invalid role")

    admin_check = (
        supabase.table("client_memberships")
        .select("role")
        .eq("user_id", user.user_id)
        .eq("client_id", client_id)
        .limit(1)
        .execute()
    )
    if not admin_check.data or admin_check.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Must be admin of this client")

    result = (
        supabase.table("client_memberships")
        .insert({
            "user_id": body.user_id,
            "client_id": client_id,
            "role": body.role,
        })
        .execute()
    )
    return result.data[0]
