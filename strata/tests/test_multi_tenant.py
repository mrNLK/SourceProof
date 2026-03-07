"""
Tests for multi-tenant client scoping and membership enforcement.

Uses FastAPI's TestClient with mocked Supabase calls to verify that:
  1. Endpoints require valid auth headers.
  2. Data is filtered by the user's active client.
  3. Role-based access control blocks unauthorized actions.
  4. Cross-client data access is denied.
"""

import sys
from unittest.mock import patch, MagicMock

# ── Mock heavy dependencies before any strata imports ────────────────
_supabase_mock = MagicMock()
sys.modules.setdefault("supabase", _supabase_mock)
sys.modules.setdefault("supabase.client", _supabase_mock)

_parallel_mock = MagicMock()
sys.modules.setdefault("parallel", _parallel_mock)

_anthropic_mock = MagicMock()
sys.modules.setdefault("anthropic", _anthropic_mock)

_celery_mock = MagicMock()
sys.modules.setdefault("celery", _celery_mock)

_redis_mock = MagicMock()
sys.modules.setdefault("redis", _redis_mock)

_exa_mock = MagicMock()
sys.modules.setdefault("exa_py", _exa_mock)
sys.modules.setdefault("exa_py.api", _exa_mock)

_pdfplumber_mock = MagicMock()
sys.modules.setdefault("pdfplumber", _pdfplumber_mock)

_dotenv_mock = MagicMock()
sys.modules.setdefault("dotenv", _dotenv_mock)

# Provide the create_client function used in database.py
_supabase_mock.create_client = MagicMock(return_value=MagicMock())
_supabase_mock.Client = MagicMock

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from strata.main import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)

# ── Fixtures ──────────────────────────────────────────────────────────

USER_A = {
    "id": "user-aaa",
    "email": "alice@acme.com",
    "display_name": "Alice",
    "is_active": True,
}
USER_B = {
    "id": "user-bbb",
    "email": "bob@other.com",
    "display_name": "Bob",
    "is_active": True,
}
CLIENT_X = {"id": "client-xxx", "slug": "acme", "is_active": True}
CLIENT_Y = {"id": "client-yyy", "slug": "other_co", "is_active": True}


def _make_supabase_mock(
    user=USER_A, client_row=CLIENT_X, membership_role="analyst", extra_tables=None
):
    """Build a mock supabase with controlled auth lookups."""
    mock = MagicMock()
    extra = extra_tables or {}

    def table_factory(name):
        t = MagicMock()
        chain = MagicMock()
        for m in ("select", "eq", "order", "limit", "insert", "update", "delete"):
            getattr(chain, m).return_value = chain

        if name == "users":
            result = MagicMock()
            result.data = [user] if user else []
            chain.execute.return_value = result
        elif name == "clients":
            result = MagicMock()
            result.data = [client_row] if client_row else []
            chain.execute.return_value = result
        elif name == "client_memberships":
            result = MagicMock()
            result.data = [{"role": membership_role}] if membership_role else []
            chain.execute.return_value = result
        elif name in extra:
            result = MagicMock()
            result.data = extra[name]
            chain.execute.return_value = result
        else:
            result = MagicMock()
            result.data = []
            chain.execute.return_value = result

        t.select.return_value = chain
        t.insert.return_value = chain
        t.update.return_value = chain
        t.delete.return_value = chain
        return t

    mock.table.side_effect = table_factory
    return mock


def _headers(email="alice@acme.com", client_id="client-xxx"):
    return {"X-User-Email": email, "X-Client-Id": client_id}


# ── Auth enforcement tests ────────────────────────────────────────────


class TestAuthEnforcement:
    def test_missing_headers_returns_422(self):
        res = client.get("/reviews/queue")
        assert res.status_code == 422

    def test_missing_email_returns_422(self):
        res = client.get("/reviews/queue", headers={"X-Client-Id": "client-xxx"})
        assert res.status_code == 422

    @patch("strata.auth.supabase")
    def test_unknown_user_returns_401(self, mock_sb):
        mock_sb.table = _make_supabase_mock(user=None).table
        res = client.get("/reviews/queue", headers=_headers("nobody@x.com"))
        assert res.status_code == 401

    @patch("strata.auth.supabase")
    def test_no_membership_returns_403(self, mock_sb):
        mock_sb.table = _make_supabase_mock(membership_role=None).table
        res = client.get("/reviews/queue", headers=_headers())
        assert res.status_code == 403


# ── Role enforcement tests ────────────────────────────────────────────


class TestRoleEnforcement:
    @patch("strata.auth.supabase")
    def test_analyst_cannot_approve(self, mock_sb):
        mock_sb.table = _make_supabase_mock(membership_role="analyst").table
        res = client.post("/reviews/some-id/approve", headers=_headers())
        assert res.status_code == 403

    @patch("strata.auth.supabase")
    @patch("strata.routers.reviews.supabase")
    def test_reviewer_can_approve(self, mock_router_sb, mock_auth_sb):
        mock_auth_sb.table = _make_supabase_mock(membership_role="reviewer").table

        chain = MagicMock()
        for m in ("select", "eq", "limit", "order", "insert", "update"):
            getattr(chain, m).return_value = chain
        result = MagicMock()
        result.data = []
        chain.execute.return_value = result
        mock_router_sb.table.return_value = chain

        res = client.post("/reviews/some-id/approve", headers=_headers())
        assert res.status_code == 404  # auth passed, review not found

    @patch("strata.auth.supabase")
    @patch("strata.routers.reviews.supabase")
    def test_admin_can_approve(self, mock_router_sb, mock_auth_sb):
        mock_auth_sb.table = _make_supabase_mock(membership_role="admin").table

        chain = MagicMock()
        for m in ("select", "eq", "limit", "order", "insert", "update"):
            getattr(chain, m).return_value = chain
        result = MagicMock()
        result.data = []
        chain.execute.return_value = result
        mock_router_sb.table.return_value = chain

        res = client.post("/reviews/some-id/approve", headers=_headers())
        assert res.status_code == 404  # auth passed

    @patch("strata.auth.supabase")
    def test_analyst_cannot_init_monitors(self, mock_sb):
        mock_sb.table = _make_supabase_mock(membership_role="analyst").table
        res = client.post("/admin/monitors/init", headers=_headers())
        assert res.status_code == 403


# ── Client scoping tests ──────────────────────────────────────────────


class TestClientScoping:
    @patch("strata.auth.supabase")
    @patch("strata.routers.reviews.supabase")
    def test_review_queue_filters_by_client(self, mock_router_sb, mock_auth_sb):
        mock_auth_sb.table = _make_supabase_mock(membership_role="reviewer").table

        queue_chain = MagicMock()
        for m in ("select", "eq", "order", "limit"):
            getattr(queue_chain, m).return_value = queue_chain
        result = MagicMock()
        result.data = []
        queue_chain.execute.return_value = result
        mock_router_sb.table.return_value = queue_chain

        res = client.get("/reviews/queue", headers=_headers())
        assert res.status_code == 200

        eq_calls = queue_chain.eq.call_args_list
        client_filter = any(
            args == ("client_id", "client-xxx") for args, _ in eq_calls
        )
        assert client_filter, f"Expected client_id filter, got: {eq_calls}"

    @patch("strata.auth.supabase")
    @patch("strata.routers.reviews.supabase")
    def test_cross_client_review_access_denied(self, mock_router_sb, mock_auth_sb):
        mock_auth_sb.table = _make_supabase_mock(membership_role="reviewer").table

        chain = MagicMock()
        for m in ("select", "eq", "limit"):
            getattr(chain, m).return_value = chain
        result = MagicMock()
        result.data = [
            {
                "id": "review-123",
                "document_version_id": "dv-456",
                "client_id": "client-yyy",  # Different client
                "status": "pending",
            }
        ]
        chain.execute.return_value = result
        mock_router_sb.table.return_value = chain

        res = client.get("/reviews/review-123", headers=_headers())
        assert res.status_code == 403

    @patch("strata.auth.supabase")
    @patch("strata.routers.documents.supabase")
    def test_documents_filter_by_client_uuid(self, mock_doc_sb, mock_auth_sb):
        mock_auth_sb.table = _make_supabase_mock(membership_role="analyst").table

        doc_chain = MagicMock()
        for m in ("select", "eq", "order"):
            getattr(doc_chain, m).return_value = doc_chain
        result = MagicMock()
        result.data = []
        doc_chain.execute.return_value = result
        mock_doc_sb.table.return_value = doc_chain

        res = client.get("/documents/history", headers=_headers())
        assert res.status_code == 200

        eq_calls = doc_chain.eq.call_args_list
        uuid_filter = any(
            args == ("client_uuid", "client-xxx") for args, _ in eq_calls
        )
        assert uuid_filter, f"Expected client_uuid filter, got: {eq_calls}"


# ── Public endpoints ──────────────────────────────────────────────────


class TestPublicEndpoints:
    def test_health_no_auth(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    @patch("strata.routers.documents.supabase")
    def test_document_html_no_auth(self, mock_sb):
        chain = MagicMock()
        for m in ("select", "eq", "limit"):
            getattr(chain, m).return_value = chain
        result = MagicMock()
        result.data = []
        chain.execute.return_value = result
        mock_sb.table.return_value = chain

        res = client.get("/documents/nonexistent-id/html")
        assert res.status_code == 404
