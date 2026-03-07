/**
 * Harmonic Person Enrichment Edge Function
 *
 * Enriches an aifund_people row with Harmonic person data via LinkedIn URL.
 * Updates person fields (only where local value is null/empty),
 * caches current company, and upserts external profile.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, authErrorResponse } from "../_shared/auth.ts";
import {
  enrichPersonByLinkedIn,
  normalizeHarmonicPerson,
  normalizeHarmonicCompany,
  normalizeLinkedInUrl,
  getCompanyById,
  type NormalizedHarmonicPerson,
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

    const {
      personId,
      linkedinUrl: requestLinkedinUrl,
      personContext,
    } = await req.json();

    if (!personId) {
      return new Response(
        JSON.stringify({ error: "personId is required" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const db = getServiceClient();

    // Load person row and verify ownership
    const { data: personRow, error: personErr } = await db
      .from("aifund_people")
      .select("*")
      .eq("id", personId)
      .single();

    if (personErr || !personRow) {
      return new Response(
        JSON.stringify({ error: "Person not found" }),
        {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Resolve LinkedIn URL
    const linkedinUrl =
      requestLinkedinUrl || personRow.linkedin_url || null;

    if (!linkedinUrl) {
      return new Response(
        JSON.stringify({
          error: "No LinkedIn URL available for enrichment",
          notFound: true,
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Call Harmonic person enrichment
    let harmonicRaw;
    try {
      harmonicRaw = await enrichPersonByLinkedIn(linkedinUrl);
    } catch (err: any) {
      if (err.status === 404) {
        return new Response(
          JSON.stringify({
            notFound: true,
            message: "Person not found in Harmonic",
          }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }
      throw err;
    }

    const normalized = normalizeHarmonicPerson(harmonicRaw);

    // Build person update payload — only fill null/empty fields,
    // except harmonic_person_id, harmonic_enriched_at, linkedin_url which always refresh
    const personUpdate: Record<string, unknown> = {
      harmonic_person_id: normalized.harmonicPersonId,
      harmonic_enriched_at: new Date().toISOString(),
    };

    if (normalized.linkedinUrl) {
      personUpdate.linkedin_url = normalized.linkedinUrl;
    }

    if (!personRow.full_name || personRow.full_name === "Unknown") {
      if (normalized.fullName) personUpdate.full_name = normalized.fullName;
    }
    if (!personRow.headline && normalized.currentRole) {
      personUpdate.headline = normalized.currentRole;
    }
    if (!personRow.current_company && normalized.currentCompany) {
      personUpdate.current_company = normalized.currentCompany;
    }
    if (!personRow.location && normalized.location) {
      personUpdate.location = normalized.location;
    }
    if (!personRow.summary && normalized.bio) {
      personUpdate.summary = normalized.bio;
    }

    // Update person row
    const { error: updateErr } = await db
      .from("aifund_people")
      .update(personUpdate)
      .eq("id", personId);

    if (updateErr) {
      console.error("Failed to update person:", updateErr);
    }

    // Upsert external profile
    const canonicalLinkedinUrl = normalized.linkedinUrl || normalizeLinkedInUrl(linkedinUrl);
    const externalProfilePayload = {
      person_id: personId,
      provider: "harmonic",
      profile_type: "linkedin",
      handle: canonicalLinkedinUrl,
      url: canonicalLinkedinUrl,
      raw_payload: normalized.rawPayload,
    };

    const { error: profileErr } = await db
      .from("aifund_external_profiles")
      .upsert(externalProfilePayload, {
        onConflict: "person_id,provider,url",
      });

    if (profileErr) {
      console.error("Failed to upsert external profile:", profileErr);
    }

    // Cache current company if available
    let companyCacheRow: NormalizedHarmonicCompany | null = null;
    if (normalized.currentCompanyId) {
      try {
        const companyRaw = await getCompanyById(normalized.currentCompanyId);
        const normalizedCompany = normalizeHarmonicCompany(companyRaw);
        companyCacheRow = normalizedCompany;

        const { error: companyErr } = await db
          .from("aifund_harmonic_companies")
          .upsert(
            {
              user_id: userId,
              harmonic_company_id: normalizedCompany.harmonicCompanyId,
              name: normalizedCompany.name,
              domain: normalizedCompany.domain,
              linkedin_url: normalizedCompany.linkedinUrl,
              website_url: normalizedCompany.websiteUrl,
              location: normalizedCompany.location,
              funding_stage: normalizedCompany.fundingStage,
              funding_total: normalizedCompany.fundingTotal,
              last_funding_date: normalizedCompany.lastFundingDate,
              last_funding_total: normalizedCompany.lastFundingTotal,
              headcount: normalizedCompany.headcount,
              headcount_growth_30d: normalizedCompany.headcountGrowth30d,
              headcount_growth_90d: normalizedCompany.headcountGrowth90d,
              tags: normalizedCompany.tags,
              founders: normalizedCompany.founders,
              raw_payload: normalizedCompany.rawPayload,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "user_id,harmonic_company_id" }
          );

        if (companyErr) {
          console.error("Failed to cache company:", companyErr);
        }
      } catch (companyFetchErr) {
        // Non-fatal: company cache failure must not break person enrichment
        console.error("Failed to fetch/cache company:", companyFetchErr);
      }
    }

    return new Response(
      JSON.stringify({
        person: { id: personId, ...personUpdate },
        externalProfile: externalProfilePayload,
        companyCacheRow,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const authResp = authErrorResponse(error, getCorsHeaders(req));
    if (authResp) return authResp;

    console.error("Error in harmonic-person:", error);

    const isHarmonicError =
      error && typeof error === "object" && "status" in error;
    const status = isHarmonicError ? 502 : 500;

    return new Response(
      JSON.stringify({
        error: (error as Error).message || "Internal server error",
        source: isHarmonicError ? "harmonic" : "internal",
      }),
      {
        status,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
