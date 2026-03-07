"""
Authentication and client-scoping dependency.

For the pilot, identity is conveyed via request headers:
  X-User-Email: the authenticated user's email
  X-Client-Id:  the client UUID the user is acting on behalf of

A production deployment would replace these headers with JWT / Supabase Auth
tokens, but the resolution logic stays the same.
"""

from fastapi import Header, HTTPException, Depends

from strata.database import supabase
from strata.models.schemas import CurrentUser


async def get_current_user(
    x_user_email: str = Header(..., description="Authenticated user email"),
    x_client_id: str = Header(..., description="Active client UUID"),
) -> CurrentUser:
    """Resolve the calling user and verify client membership."""

    # Look up user
    user_result = (
        supabase.table("users")
        .select("id, email, display_name, is_active")
        .eq("email", x_user_email)
        .limit(1)
        .execute()
    )
    if not user_result.data:
        raise HTTPException(status_code=401, detail="Unknown user")
    user = user_result.data[0]
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User account is disabled")

    # Look up client
    client_result = (
        supabase.table("clients")
        .select("id, slug, is_active")
        .eq("id", x_client_id)
        .limit(1)
        .execute()
    )
    if not client_result.data:
        raise HTTPException(status_code=404, detail="Unknown client")
    client = client_result.data[0]
    if not client.get("is_active", True):
        raise HTTPException(status_code=403, detail="Client account is disabled")

    # Verify membership
    membership = (
        supabase.table("client_memberships")
        .select("role")
        .eq("user_id", user["id"])
        .eq("client_id", client["id"])
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail="User is not a member of this client organization",
        )

    return CurrentUser(
        user_id=user["id"],
        email=user["email"],
        display_name=user["display_name"],
        client_id=client["id"],
        client_slug=client["slug"],
        role=membership.data[0]["role"],
    )


def require_role(*roles: str):
    """Dependency that requires the current user to have one of the given roles."""
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {', '.join(roles)}",
            )
        return user
    return checker
