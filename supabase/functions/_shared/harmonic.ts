/**
 * Shared Harmonic API client for Supabase Edge Functions.
 *
 * Provides typed fetch helpers, normalizers, and REST endpoint wrappers
 * for Harmonic person enrichment and company search.
 */

// ---------------------------------------------------------------------------
// Environment & Config
// ---------------------------------------------------------------------------

const HARMONIC_BASE_URL =
  Deno.env.get("HARMONIC_BASE_URL") || "https://api.harmonic.ai";

function getApiKey(): string {
  const key = Deno.env.get("HARMONIC_API_KEY");
  if (!key) throw new Error("HARMONIC_API_KEY is not configured");
  return key;
}

/** Cache freshness window in ms (24 hours). */
export const COMPANY_CACHE_FRESHNESS_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------

export async function harmonicFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${HARMONIC_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Harmonic API ${res.status}: ${body}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// URL normalizers
// ---------------------------------------------------------------------------

/** Normalize a LinkedIn profile URL to canonical form. */
export function normalizeLinkedInUrl(url: string): string {
  try {
    const u = new URL(url);
    // Ensure https and www prefix
    let host = u.hostname.replace(/^(www\.)?/, "www.");
    const pathParts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (pathParts[0] === "in" && pathParts[1]) {
      return `https://${host}/in/${pathParts[1].toLowerCase()}`;
    }
    // Company page or other LinkedIn URL
    return `https://${host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url.trim();
  }
}

/** Normalize a company domain (strip protocol, www, trailing slash). */
export function normalizeDomain(domain: string): string {
  try {
    const cleaned = domain.startsWith("http")
      ? domain
      : `https://${domain}`;
    const u = new URL(cleaned);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return domain.trim().toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// REST Endpoint Helpers
// ---------------------------------------------------------------------------

export interface HarmonicPersonRaw {
  id?: string;
  entity_urn?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  linkedin_url?: string;
  title?: string;
  current_company_name?: string;
  current_company_id?: string;
  current_company?: Record<string, unknown>;
  location?: string;
  bio?: string;
  education?: unknown[];
  experience?: unknown[];
  skills?: string[];
  social_links?: Record<string, string>;
  [key: string]: unknown;
}

export interface HarmonicCompanyRaw {
  id?: string;
  entity_urn?: string;
  name?: string;
  description?: string;
  website?: { url?: string; domain?: string };
  linkedin_url?: string;
  location?: string;
  headcount?: number;
  customer_type?: string;
  funding?: {
    fundingTotal?: number;
    fundingRounds?: Array<{
      fundingAmount?: number;
      fundingRoundType?: string;
      announcedDate?: string;
      investors?: Array<{ investorName?: string; isLead?: boolean }>;
    }>;
  };
  tagsV2?: Array<{ displayValue?: string }>;
  highlights?: Array<{ text?: string }>;
  webTraffic?: Record<string, unknown>;
  headcountEngineering?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Enrich a person by LinkedIn URL. */
export async function enrichPersonByLinkedIn(
  linkedinUrl: string
): Promise<HarmonicPersonRaw> {
  const normalized = normalizeLinkedInUrl(linkedinUrl);
  return harmonicFetch<HarmonicPersonRaw>("/persons", {
    method: "POST",
    body: JSON.stringify({ linkedin_url: normalized }),
  });
}

/** Natural-language company search. */
export async function searchCompaniesByNaturalLanguage(
  query: string,
  limit = 25
): Promise<HarmonicCompanyRaw[]> {
  const params = new URLSearchParams({
    query,
    size: String(limit),
  });
  const result = await harmonicFetch<{
    results?: HarmonicCompanyRaw[];
    companies?: HarmonicCompanyRaw[];
  }>(`/search/search_agent?${params}`);
  return result.results || result.companies || [];
}

/** Get full company details by Harmonic ID. */
export async function getCompanyById(
  companyId: string
): Promise<HarmonicCompanyRaw> {
  return harmonicFetch<HarmonicCompanyRaw>(`/companies/${companyId}`);
}

/** Get company employees (founders/executives). */
export async function getCompanyEmployees(
  companyId: string,
  group = "FOUNDERS_AND_CEO"
): Promise<HarmonicPersonRaw[]> {
  const params = new URLSearchParams({ group });
  const result = await harmonicFetch<{
    results?: HarmonicPersonRaw[];
    employees?: HarmonicPersonRaw[];
  }>(`/companies/${companyId}/employees?${params}`);
  return result.results || result.employees || [];
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export interface NormalizedHarmonicPerson {
  harmonicPersonId: string | null;
  fullName: string | null;
  linkedinUrl: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  currentCompanyId: string | null;
  location: string | null;
  bio: string | null;
  education: unknown[];
  experience: unknown[];
  skills: string[];
  socialLinks: Record<string, string>;
  rawPayload: Record<string, unknown>;
}

export function normalizeHarmonicPerson(
  raw: HarmonicPersonRaw
): NormalizedHarmonicPerson {
  return {
    harmonicPersonId: raw.id?.toString() || raw.entity_urn || null,
    fullName:
      raw.full_name ||
      [raw.first_name, raw.last_name].filter(Boolean).join(" ") ||
      null,
    linkedinUrl: raw.linkedin_url
      ? normalizeLinkedInUrl(raw.linkedin_url)
      : null,
    currentRole: raw.title || null,
    currentCompany: raw.current_company_name || null,
    currentCompanyId: raw.current_company_id?.toString() || null,
    location: raw.location || null,
    bio: raw.bio || null,
    education: raw.education || [],
    experience: raw.experience || [],
    skills: raw.skills || [],
    socialLinks: raw.social_links || {},
    rawPayload: raw as Record<string, unknown>,
  };
}

export interface NormalizedHarmonicCompany {
  harmonicCompanyId: string;
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
  fundingStage: string | null;
  fundingTotal: number | null;
  lastFundingDate: string | null;
  lastFundingTotal: number | null;
  headcount: number | null;
  headcountGrowth30d: number | null;
  headcountGrowth90d: number | null;
  tags: string[];
  founders: FounderSummary[];
  rawPayload: Record<string, unknown>;
}

export interface FounderSummary {
  name: string;
  role: string | null;
  linkedinUrl: string | null;
}

export function normalizeHarmonicCompany(
  raw: HarmonicCompanyRaw
): NormalizedHarmonicCompany {
  const lastRound =
    raw.funding?.fundingRounds?.sort((a, b) => {
      const da = a.announcedDate || "";
      const db = b.announcedDate || "";
      return db.localeCompare(da);
    })[0] || null;

  return {
    harmonicCompanyId: raw.id?.toString() || raw.entity_urn || "",
    name: raw.name || "Unknown",
    domain: raw.website?.domain
      ? normalizeDomain(raw.website.domain)
      : null,
    linkedinUrl: raw.linkedin_url
      ? normalizeLinkedInUrl(raw.linkedin_url)
      : null,
    websiteUrl: raw.website?.url || null,
    location: raw.location || null,
    fundingStage: lastRound?.fundingRoundType || null,
    fundingTotal: raw.funding?.fundingTotal || null,
    lastFundingDate: lastRound?.announcedDate || null,
    lastFundingTotal: lastRound?.fundingAmount || null,
    headcount: raw.headcount || null,
    headcountGrowth30d:
      (raw.webTraffic as any)?.ago30d?.percentChange ?? null,
    headcountGrowth90d:
      (raw.headcountEngineering as any)?.ago90d?.percentChange ?? null,
    tags: (raw.tagsV2 || [])
      .map((t) => t.displayValue)
      .filter(Boolean) as string[],
    founders: buildFounderSummaries(raw),
    rawPayload: raw as Record<string, unknown>,
  };
}

export function buildFounderSummaries(
  raw: HarmonicCompanyRaw
): FounderSummary[] {
  const highlights = raw.highlights || [];
  const founders: FounderSummary[] = [];

  for (const h of highlights) {
    const text = h.text || "";
    // Try to extract founder names from highlight text
    const founderMatch = text.match(
      /(?:founded by|co-founded by|founder[s]?:?\s*)([^.]+)/i
    );
    if (founderMatch) {
      const names = founderMatch[1].split(/,|and/i).map((n) => n.trim());
      for (const name of names) {
        if (name && name.length > 1 && name.length < 60) {
          founders.push({ name, role: "Founder", linkedinUrl: null });
        }
      }
    }
  }

  return founders;
}

/** Generate a stable hash for a query string. */
export async function hashQuery(query: string): Promise<string> {
  const data = new TextEncoder().encode(query.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
