-- STRATA Migration 002: Multi-tenant support
-- Adds clients, users, and client_memberships tables.
-- Adds client_id FK to regulatory_items and review_queue.
-- Non-destructive: existing rows get NULL client_id until backfilled.

-- Clients table: represents a customer organization
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users table: named users who interact with STRATA
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Client memberships: maps users to clients with roles
CREATE TABLE IF NOT EXISTS client_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    role TEXT NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, client_id)
);

-- Add CHECK constraint on role
ALTER TABLE client_memberships
    ADD CONSTRAINT chk_membership_role
    CHECK (role IN ('admin', 'analyst', 'reviewer'));

-- Add client_id FK column to regulatory_items (nullable for backward compat)
ALTER TABLE regulatory_items
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Add client_id FK column to review_queue
ALTER TABLE review_queue
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Add client_id FK column to audit_log
ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Update asset_registry.client_id from TEXT to also have a UUID FK column
ALTER TABLE asset_registry
    ADD COLUMN IF NOT EXISTS client_uuid UUID REFERENCES clients(id);

-- Update document_versions.client_id: add a proper UUID FK alongside the text field
ALTER TABLE document_versions
    ADD COLUMN IF NOT EXISTS client_uuid UUID REFERENCES clients(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_memberships_user ON client_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client ON client_memberships(client_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_items_client ON regulatory_items(client_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_client ON review_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_client ON audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);

-- Seed two demo clients matching existing demo data
INSERT INTO clients (name, slug, metadata) VALUES
    ('Demo IOU Utility', 'demo_iou', '{"type": "investor_owned_utility", "demo": true}'),
    ('Demo Renewable Developer', 'demo_developer', '{"type": "renewable_developer", "demo": true}')
ON CONFLICT (slug) DO NOTHING;

-- Seed a demo admin user
INSERT INTO users (email, display_name) VALUES
    ('admin@strata.demo', 'Demo Admin')
ON CONFLICT (email) DO NOTHING;

-- Give the demo admin access to both clients
INSERT INTO client_memberships (user_id, client_id, role)
SELECT u.id, c.id, 'admin'
FROM users u, clients c
WHERE u.email = 'admin@strata.demo'
ON CONFLICT (user_id, client_id) DO NOTHING;

-- Backfill: link existing asset_registry rows to the proper clients UUID
UPDATE asset_registry
SET client_uuid = c.id
FROM clients c
WHERE asset_registry.client_id = c.slug
  AND asset_registry.client_uuid IS NULL;

-- Backfill: link existing document_versions rows
UPDATE document_versions
SET client_uuid = c.id
FROM clients c
WHERE document_versions.client_id = c.slug
  AND document_versions.client_uuid IS NULL;
