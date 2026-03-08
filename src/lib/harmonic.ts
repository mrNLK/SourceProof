/**
 * Harmonic Frontend Service Layer
 *
 * Thin wrappers around Supabase Edge Function invocations
 * for Harmonic person enrichment and intelligence runs.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  AiFundHarmonicCompanySummary,
  AiFundHarmonicIntelligenceSummary,
} from "@/types/ai-fund";

// ---------------------------------------------------------------------------
// Person Enrichment
// ---------------------------------------------------------------------------

export interface EnrichPersonInput {
  personId: string;
  linkedinUrl?: string | null;
  personContext?: {
    fullName?: string | null;
    currentRole?: string | null;
    currentCompany?: string | null;
    location?: string | null;
  };
}

export interface EnrichPersonResult {
  person: {
    id: string;
    harmonic_person_id?: string | null;
    harmonic_enriched_at?: string | null;
    linkedin_url?: string | null;
    full_name?: string | null;
    headline?: string | null;
    current_company?: string | null;
    location?: string | null;
    summary?: string | null;
  };
  externalProfile: Record<string, unknown>;
  companyCacheRow: AiFundHarmonicCompanySummary | null;
  notFound?: boolean;
}

export async function enrichPersonWithHarmonic(
  input: EnrichPersonInput
): Promise<EnrichPersonResult> {
  const { data, error } = await supabase.functions.invoke("harmonic-person", {
    body: input,
  });

  if (error) {
    throw new Error(error.message || "Failed to enrich person with Harmonic");
  }

  return data as EnrichPersonResult;
}

// ---------------------------------------------------------------------------
// Intelligence Run
// ---------------------------------------------------------------------------

export interface RunHarmonicIntelligenceInput {
  runId: string;
  query: string;
  conceptId?: string | null;
  limit?: number;
}

export interface RunHarmonicIntelligenceResult {
  runId: string;
  status: "completed" | "failed";
  resultsCount?: number;
  resultsSummary?: AiFundHarmonicIntelligenceSummary;
  error?: string;
}

export async function runHarmonicIntelligence(
  input: RunHarmonicIntelligenceInput
): Promise<RunHarmonicIntelligenceResult> {
  const { data, error } = await supabase.functions.invoke(
    "harmonic-intelligence",
    { body: input }
  );

  if (error) {
    throw new Error(
      error.message || "Failed to run Harmonic intelligence search"
    );
  }

  return data as RunHarmonicIntelligenceResult;
}

// ---------------------------------------------------------------------------
// Saved Search Sync
// ---------------------------------------------------------------------------

export interface SyncSavedSearchesResult {
  synced: number;
  totalNewCompanies: number;
  results: Array<{
    savedSearchId: string;
    conceptId: string;
    newCompanies: number;
    status: string;
  }>;
}

export async function syncHarmonicSavedSearches(
  savedSearchId?: string
): Promise<SyncSavedSearchesResult> {
  const { data, error } = await supabase.functions.invoke("harmonic-sync", {
    body: savedSearchId ? { savedSearchId } : {},
  });

  if (error) {
    throw new Error(error.message || "Failed to sync Harmonic saved searches");
  }

  return data as SyncSavedSearchesResult;
}
