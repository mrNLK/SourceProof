/**
 * Harmonic Sync Edge Function
 *
 * Syncs saved searches with Harmonic: checks for net new results,
 * creates Harmonic saved searches from draft state, and refreshes
 * company data for monitored searches.
 *
 * Can be called on-demand or via a scheduled cron trigger.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, authErrorResponse } from "../_shared/auth.ts";
import {
  harmonicFetch,
  normalizeHarmonicCompany,
  type HarmonicCompanyRaw,
} from "../_shared/harmonic.ts";

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

interface SavedSearchRow {
  id: string;
  user_id: string;
  concept_id: string;
  harmonic_saved_search_id: string | null;
  query_text: string;
  query_hash: string;
  status: string;
  last_synced_at: string | null;
  last_run_id: string | null;
  result_count: number;
  metadata: Record<string, unknown>;
}

/** List saved searches from Harmonic. */
async function listHarmonicSavedSearches(): Promise<
  Array<{ id: string; name?: string; query?: string }>
> {
  try {
    const result = await harmonicFetch<{
      results?: Array<{ id: string; name?: string; query?: string }>;
    }>("/savedSearches");
    return result.results || [];
  } catch {
    return [];
  }
}

/** Get net new results for a Harmonic saved search. */
async function getNetNewResults(
  savedSearchId: string
): Promise<HarmonicCompanyRaw[]> {
  const result = await harmonicFetch<{
    results?: HarmonicCompanyRaw[];
    companies?: HarmonicCompanyRaw[];
  }>(`/savedSearches:netNewResults/${savedSearchId}`);
  return result.results || result.companies || [];
}

/** Clear net new flag for a Harmonic saved search. */
async function clearNetNew(savedSearchId: string): Promise<void> {
  await harmonicFetch(`/savedSearches:clearNetNew/${savedSearchId}`, {
    method: "POST",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { user } = await requireAuth(req);
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const { savedSearchId, action } = body as {
      savedSearchId?: string;
      action?: "sync_all" | "sync_one" | "check_new";
    };

    const db = getServiceClient();

    // Load saved searches for this user
    let query = db
      .from("aifund_harmonic_saved_searches")
      .select("*")
      .eq("user_id", userId);

    if (savedSearchId) {
      query = query.eq("id", savedSearchId);
    }

    const { data: savedSearches, error: ssErr } = await query;

    if (ssErr) throw ssErr;
    if (!savedSearches || savedSearches.length === 0) {
      return new Response(
        JSON.stringify({
          synced: 0,
          message: "No saved searches to sync",
        }),
        {
          status: 200,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        }
      );
    }

    const results: Array<{
      savedSearchId: string;
      conceptId: string;
      newCompanies: number;
      status: string;
    }> = [];

    for (const ss of savedSearches as SavedSearchRow[]) {
      try {
        // Only sync searches that have a Harmonic saved search ID
        if (!ss.harmonic_saved_search_id) {
          results.push({
            savedSearchId: ss.id,
            conceptId: ss.concept_id,
            newCompanies: 0,
            status: "skipped_no_harmonic_id",
          });
          continue;
        }

        // Fetch net new results
        const netNew = await getNetNewResults(ss.harmonic_saved_search_id);

        if (netNew.length > 0) {
          // Normalize and cache new companies
          const now = new Date().toISOString();
          for (const raw of netNew) {
            const normalized = normalizeHarmonicCompany(raw);
            try {
              await db.from("aifund_harmonic_companies").upsert(
                {
                  user_id: userId,
                  harmonic_company_id: normalized.harmonicCompanyId,
                  name: normalized.name,
                  domain: normalized.domain,
                  linkedin_url: normalized.linkedinUrl,
                  website_url: normalized.websiteUrl,
                  location: normalized.location,
                  funding_stage: normalized.fundingStage,
                  funding_total: normalized.fundingTotal,
                  last_funding_date: normalized.lastFundingDate,
                  last_funding_total: normalized.lastFundingTotal,
                  headcount: normalized.headcount,
                  headcount_growth_30d: normalized.headcountGrowth30d,
                  headcount_growth_90d: normalized.headcountGrowth90d,
                  tags: normalized.tags,
                  founders: normalized.founders,
                  raw_payload: normalized.rawPayload,
                  fetched_at: now,
                },
                { onConflict: "user_id,harmonic_company_id" }
              );
            } catch (err) {
              console.error(`Failed to cache company ${normalized.name}:`, err);
            }
          }

          // Clear net new flag in Harmonic
          await clearNetNew(ss.harmonic_saved_search_id).catch((err) => {
            console.error("Failed to clear net new:", err);
          });
        }

        // Update saved search state
        await db
          .from("aifund_harmonic_saved_searches")
          .update({
            last_synced_at: new Date().toISOString(),
            result_count: ss.result_count + netNew.length,
            status: "active",
          })
          .eq("id", ss.id);

        results.push({
          savedSearchId: ss.id,
          conceptId: ss.concept_id,
          newCompanies: netNew.length,
          status: "synced",
        });
      } catch (err) {
        console.error(`Failed to sync saved search ${ss.id}:`, err);
        results.push({
          savedSearchId: ss.id,
          conceptId: ss.concept_id,
          newCompanies: 0,
          status: `error: ${(err as Error).message}`,
        });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.newCompanies, 0);

    return new Response(
      JSON.stringify({
        synced: results.length,
        totalNewCompanies: totalNew,
        results,
      }),
      {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const authResp = authErrorResponse(error, getCorsHeaders(req));
    if (authResp) return authResp;

    console.error("Error in harmonic-sync:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
