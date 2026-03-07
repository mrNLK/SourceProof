from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


# --- Clients & Users ---

class ClientCreate(BaseModel):
    name: str
    slug: str
    metadata: Optional[dict] = None


class ClientResponse(BaseModel):
    id: str
    name: str
    slug: str
    is_active: bool = True
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None


class UserCreate(BaseModel):
    email: str
    display_name: str


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    is_active: bool = True
    created_at: Optional[datetime] = None


class MembershipCreate(BaseModel):
    user_id: str
    client_id: str
    role: str = "analyst"


class MembershipResponse(BaseModel):
    id: str
    user_id: str
    client_id: str
    role: str
    created_at: Optional[datetime] = None


class CurrentUser(BaseModel):
    """Resolved user context from request headers."""
    user_id: str
    email: str
    display_name: str
    client_id: str
    client_slug: str
    role: str


# --- Regulatory Items ---

class RegulatoryItemBase(BaseModel):
    filing_type: Optional[str] = None
    docket_number: Optional[str] = None
    jurisdiction: str = "FERC"
    effective_date: Optional[date] = None
    affected_utilities: Optional[list[str]] = None
    source_url: Optional[str] = None


class RegulatoryItemResponse(RegulatoryItemBase):
    id: str
    webset_id: Optional[str] = None
    exa_item_id: Optional[str] = None
    enrichment_data: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RegulatoryItemSummary(BaseModel):
    id: str
    filing_type: Optional[str] = None
    docket_number: Optional[str] = None
    jurisdiction: str = "FERC"
    effective_date: Optional[date] = None
    source_url: Optional[str] = None
    created_at: Optional[datetime] = None


# --- Document Versions ---

class DocumentVersionBase(BaseModel):
    client_id: str
    regulatory_item_id: str
    template_type: str = "leadership_memo"


class DocumentVersionResponse(BaseModel):
    id: str
    client_id: str
    regulatory_item_id: str
    version_number: int
    status: str
    template_type: str
    content_html: Optional[str] = None
    extraction_data: Optional[dict] = None
    impacted_assets: Optional[list] = None
    parallel_job_id: Optional[str] = None
    created_at: Optional[datetime] = None


class DocumentVersionSummary(BaseModel):
    id: str
    version_number: int
    status: str
    template_type: str
    created_at: Optional[datetime] = None
    docket_number: Optional[str] = None
    what_changed: Optional[str] = None


# --- Review Queue ---

class ReviewQueueItem(BaseModel):
    id: str
    document_version_id: str
    filing_type: Optional[str] = None
    docket_number: Optional[str] = None
    plain_english_summary: Optional[str] = None
    impacted_asset_count: int = 0
    created_at: Optional[datetime] = None


class ReviewAction(BaseModel):
    notes: Optional[str] = None


class ReviewDetail(BaseModel):
    review: dict
    document_version: dict
    regulatory_item: dict
    extraction_data: Optional[dict] = None
    impacted_assets: Optional[list] = None
    audit_trail: list = []


# --- Monitors ---

class MonitorResponse(BaseModel):
    monitor_id: str
    name: str
    query: str
    frequency: str
    status: str
    created_at: Optional[datetime] = None


class MonitorWebhookPayload(BaseModel):
    type: str
    timestamp: str
    data: dict


# --- Assets ---

class AssetResponse(BaseModel):
    id: str
    client_id: str
    asset_name: str
    asset_type: str
    jurisdiction: str
    rate_schedule: Optional[str] = None
    queue_position: Optional[str] = None
    state: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None


class ImpactedAsset(BaseModel):
    asset_id: str
    asset_name: str
    impact_level: str
    match_reason: str


# --- Admin ---

class TriggerRequest(BaseModel):
    source_url: str
    monitor_id: str = "manual_trigger"


# --- Health ---

class HealthResponse(BaseModel):
    status: str
    environment: str
