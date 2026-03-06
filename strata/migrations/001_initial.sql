-- STRATA Initial Schema Migration
-- Run this in the Supabase SQL editor

-- Regulatory items: core document catalog
CREATE TABLE IF NOT EXISTS regulatory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webset_id TEXT,
    exa_item_id TEXT UNIQUE,
    filing_type TEXT,
    docket_number TEXT,
    jurisdiction TEXT DEFAULT 'FERC',
    effective_date DATE,
    affected_utilities TEXT[],
    source_url TEXT,
    raw_text TEXT,
    enrichment_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document versions: generated memos, redlines, matrices
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT,
    regulatory_item_id UUID REFERENCES regulatory_items(id),
    version_number INTEGER,
    status TEXT DEFAULT 'draft',
    template_type TEXT DEFAULT 'leadership_memo',
    content_html TEXT,
    extraction_data JSONB,
    impacted_assets JSONB,
    parallel_job_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Review queue: reviewer workflow
CREATE TABLE IF NOT EXISTS review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id UUID REFERENCES document_versions(id),
    assigned_reviewer TEXT,
    status TEXT DEFAULT 'pending',
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Audit log: full pipeline traceability
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Asset registry: client asset portfolios
CREATE TABLE IF NOT EXISTS asset_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT,
    asset_name TEXT,
    asset_type TEXT,
    jurisdiction TEXT,
    rate_schedule TEXT,
    queue_position TEXT,
    state TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Webset registry: tracks Exa Webset IDs
CREATE TABLE IF NOT EXISTS webset_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webset_id TEXT UNIQUE,
    filing_type TEXT,
    jurisdiction TEXT DEFAULT 'FERC',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Monitor registry: tracks Parallel Monitor IDs
CREATE TABLE IF NOT EXISTS monitor_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id TEXT UNIQUE,
    name TEXT,
    query TEXT,
    frequency TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_regulatory_items_docket ON regulatory_items(docket_number);
CREATE INDEX IF NOT EXISTS idx_regulatory_items_filing_type ON regulatory_items(filing_type);
CREATE INDEX IF NOT EXISTS idx_regulatory_items_webset ON regulatory_items(webset_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_client ON document_versions(client_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_status ON document_versions(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_asset_registry_client ON asset_registry(client_id);
