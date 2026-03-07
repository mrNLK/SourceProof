/**
 * Harmonic Intelligence Run Edge Function
 *
 * Executes a natural-language company search via Harmonic,
 * normalizes results, caches companies, and persists structured
 * results into aifund_intelligence_runs.results_summary.
 *
 * Optionally links the run to a concept via aifund_harmonic_saved_searches.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, authErrorResponse } from "../_shared/auth.ts";
import {
  searchCompaniesByNaturalLanguage,
  getCompanyById,
  normalizeHarmonicCompany,
  hashQuery,
  type NormalizedHarmonicCompany,
} from "../_shared/harmonic.ts";

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { user } = await requireAuth(req);
    const userId = user.id;

    const { runId, query, conceptId, limit } = await req.json();

    if (!runId || !query) {
      return new Response(
        JSON.stringify({ error: "runId and query are required" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const db = getServiceClient();

    // Verify run ownership and provider
    const { data: runRow, error: runErr } = await db
      .from("aifund_intelligence_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runErr || !runRow) {
      return new Response(
        JSON.stringify({ error: "Intelligence run not found" }),
        {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (runRow.user_id && runRow.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Set run status to running
    await db
      .from("aifund_intelligence_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", runId);

    try {
      // Search Harmonic
      const searchLimit = limit || 25;
      const searchResults = await searchCompaniesByNaturalLanguage(
        query,
        searchLimit
      );

      // Expand and normalize each company
      const normalizedCompanies: NormalizedHarmonicCompany[] = [];

      // Process in batches of 5 to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < searchResults.length; i += batchSize) {
        const batch = searchResults.slice(i, i + batchSize);
        const expanded = await Promise.all(
          batch.map(async (raw) => {
            try {
              // If the search result is sparse, fetch full details
              const companyId = raw.id?.toString() || raw.entity_urn;
              if (companyId && !raw.funding && !raw.headcount) {
                const full = await getCompanyById(companyId);
                return normalizeHarmonicCompany(full);
              }
              return normalizeHarmonicCompany(raw);
            } catch (err) {
              console.error(
                `Failed to expand company ${raw.name || raw.id}:`,
                err
              );
              // Fall back to search-level data
              return normalizeHarmonicCompany(raw);
            }
          })
        );
        normalizedCompanies.push(...expanded);
      }

      // Cache all companies
      const now = new Date().toISOString();
      for (const company of normalizedCompanies) {
        try {
          await db.from("aifund_harmonic_companies").upsert(
            {
              user_id: userId,
              harmonic_company_id: company.harmonicCompanyId,
              name: company.name,
              domain: company.domain,
              linkedin_url: company.linkedinUrl,
              website_url: company.websiteUrl,
              location: company.location,
              funding_stage: company.fundingStage,
              funding_total: company.fundingTotal,
              last_funding_date: company.lastFundingDate,
              last_funding_total: company.lastFundingTotal,
              headcount: company.headcount,
              headcount_growth_30d: company.headcountGrowth30d,
              headcount_growth_90d: company.headcountGrowth90d,
              tags: company.tags,
              founders: company.founders,
              raw_payload: company.rawPayload,
              fetched_at: now,
            },
            { onConflict: "user_id,harmonic_company_id" }
          );
        } catch (err) {
          console.error(`Failed to cache company ${company.name}:`, err);
        }
      }

      // Build results summary (without raw_payload to keep it compact)
      const companySummaries = normalizedCompanies.map((c) => ({
        harmonicCompanyId: c.harmonicCompanyId,
        name: c.name,
        domain: c.domain,
        linkedinUrl: c.linkedinUrl,
        websiteUrl: c.websiteUrl,
        location: c.location,
        fundingStage: c.fundingStage,
        fundingTotal: c.fundingTotal,
        lastFundingDate: c.lastFundingDate,
        lastFundingTotal: c.lastFundingTotal,
        headcount: c.headcount,
        headcountGrowth30d: c.headcountGrowth30d,
        headcountGrowth90d: c.headcountGrowth90d,
        tags: c.tags,
        founders: c.founders,
      }));

      const resultsSummary = {
        query,
        companies: companySummaries,
        source: "harmonic",
        conceptId: conceptId || null,
        fetchedAt: now,
      };

      // Update run to completed
      await db
        .from("aifund_intelligence_runs")
        .update({
          status: "completed",
          results_count: normalizedCompanies.length,
          completed_at: now,
          results_summary: resultsSummary,
        })
        .eq("id", runId);

      // Upsert saved-search state if concept is linked
      if (conceptId) {
        try {
          const qHash = await hashQuery(query);
          await db.from("aifund_harmonic_saved_searches").upsert(
            {
              user_id: userId,
              concept_id: conceptId,
              query_text: query,
              query_hash: qHash,
              status: "draft",
              last_run_id: runId,
              result_count: normalizedCompanies.length,
              metadata: {},
            },
            { onConflict: "user_id,concept_id,query_hash" }
          );
        } catch (err) {
          console.error("Failed to upsert saved search state:", err);
        }
      }

      return new Response(
        JSON.stringify({
          runId,
          status: "completed",
          resultsCount: normalizedCompanies.length,
          resultsSummary,
        }),
        {
          status: 200,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        }
      );
    } catch (searchErr) {
      // Update run to failed
      const errorSummary = {
        query,
        error: (searchErr as Error).message || "Unknown error",
        source: "harmonic",
        failedAt: new Date().toISOString(),
      };

      await db
        .from("aifund_intelligence_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          results_summary: errorSummary,
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          runId,
          status: "failed",
          error: (searchErr as Error).message,
        }),
        {
          status: 502,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    const authResp = authErrorResponse(error, getCorsHeaders(req));
    if (authResp) return authResp;

    console.error("Error in harmonic-intelligence:", error);
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
