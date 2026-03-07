import { supabase } from "@/integrations/supabase/client"
import type {
  HarmonicCompany,
  HarmonicPerson,
  HarmonicEnrichmentStatus,
  HarmonicSearchResult,
  HarmonicAction,
  HarmonicEnrichRequest,
  CompanyPoachability,
} from "@/types/harmonic"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

async function callHarmonicApi(
  action: HarmonicAction,
  params: Record<string, unknown>,
) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Authentication required – please sign in.')
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/harmonic-enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  })

  const data = await res.json()
  if (!res.ok && !data.enrichment_pending) {
    const message =
      typeof data.error === 'string' ? data.error
      : data.error?.message ?? data.message ?? JSON.stringify(data)
    throw new Error(message)
  }
  return data
}

// ---------------------------------------------------------------------------
// Company enrichment
// ---------------------------------------------------------------------------

export async function enrichCompanyByDomain(domain: string): Promise<HarmonicCompany> {
  return callHarmonicApi('enrich_company', { website_domain: domain })
}

export async function enrichCompanyByLinkedIn(linkedinUrl: string): Promise<HarmonicCompany> {
  return callHarmonicApi('enrich_company', { linkedin_url: linkedinUrl })
}

export async function getCompanyById(idOrUrn: string): Promise<HarmonicCompany> {
  return callHarmonicApi('get_company', { id_or_urn: idOrUrn })
}

// ---------------------------------------------------------------------------
// Person enrichment
// ---------------------------------------------------------------------------

export async function enrichPersonByLinkedIn(linkedinUrl: string): Promise<HarmonicPerson> {
  return callHarmonicApi('enrich_person', { person_linkedin_url: linkedinUrl })
}

export async function getPersonById(idOrUrn: string): Promise<HarmonicPerson> {
  return callHarmonicApi('get_person', { id_or_urn: idOrUrn })
}

// ---------------------------------------------------------------------------
// Company employees
// ---------------------------------------------------------------------------

export async function getCompanyEmployees(
  idOrUrn: string,
  groupType?: 'ALL' | 'FOUNDERS_AND_CEO' | 'EXECUTIVES' | 'FOUNDERS' | 'LEADERSHIP',
  size = 20,
) {
  return callHarmonicApi('get_employees', {
    id_or_urn: idOrUrn,
    employee_group_type: groupType,
    size,
  })
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchCompaniesNaturalLanguage(
  query: string,
): Promise<HarmonicSearchResult<HarmonicCompany>> {
  return callHarmonicApi('search_agent', { query })
}

export async function findSimilarCompanies(
  companyUrns: string[],
): Promise<HarmonicSearchResult<HarmonicCompany>> {
  return callHarmonicApi('similar_companies', { company_urns: companyUrns })
}

export async function searchCompaniesByKeywords(
  keywords: string,
  size = 25,
): Promise<HarmonicSearchResult<HarmonicCompany>> {
  return callHarmonicApi('search_companies', { keywords, size })
}

export async function typeaheadSearch(
  query: string,
  searchType: 'COMPANY' | 'PERSON' | 'INVESTOR' = 'COMPANY',
) {
  return callHarmonicApi('typeahead', { query, search_type: searchType })
}

// ---------------------------------------------------------------------------
// Network / Connections
// ---------------------------------------------------------------------------

export async function getTeamConnections(companyIdOrUrn: string) {
  return callHarmonicApi('team_connections', { id_or_urn: companyIdOrUrn })
}

// ---------------------------------------------------------------------------
// Enrichment status
// ---------------------------------------------------------------------------

export async function checkEnrichmentStatus(
  ids?: string[],
  urns?: string[],
): Promise<HarmonicEnrichmentStatus[]> {
  return callHarmonicApi('enrichment_status', { ids, urns })
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

export async function batchGetCompanies(ids?: number[], urns?: string[]) {
  return callHarmonicApi('batch_companies', { ids, urns })
}

// ---------------------------------------------------------------------------
// Poachability scoring (client-side computation from Harmonic data)
// ---------------------------------------------------------------------------

export function computePoachability(company: HarmonicCompany): CompanyPoachability {
  const signals: string[] = []
  let score = 50 // Base score

  const tm = company.traction_metrics
  const engGrowth = tm?.headcountEngineering?.ago90d?.percentChange
  const webChange = tm?.webTraffic?.ago30d?.percentChange

  // Shrinking engineering team = easier to poach
  if (engGrowth !== undefined && engGrowth < -5) {
    score += 20
    signals.push(`Engineering team shrinking (${engGrowth.toFixed(0)}% in 90d)`)
  } else if (engGrowth !== undefined && engGrowth > 20) {
    score -= 15
    signals.push(`Engineering team growing fast (+${engGrowth.toFixed(0)}% in 90d)`)
  }

  // Declining web traffic = company may be struggling
  if (webChange !== undefined && webChange < -10) {
    score += 15
    signals.push(`Web traffic declining (${webChange.toFixed(0)}% in 30d)`)
  } else if (webChange !== undefined && webChange > 30) {
    score -= 10
    signals.push(`Web traffic surging (+${webChange.toFixed(0)}% in 30d)`)
  }

  // Funding stage signals
  const stage = company.stage
  if (stage === 'PRE_SEED' || stage === 'SEED') {
    score += 10
    signals.push('Early stage — candidates may want stability')
  } else if (stage === 'SERIES_D' || stage === 'SERIES_E' || stage === 'GROWTH') {
    score -= 5
    signals.push('Late-stage / growth — harder to poach')
  }

  // No recent funding
  const lastRound = company.funding?.lastFundingDate
  if (lastRound) {
    const monthsSinceRound = (Date.now() - new Date(lastRound).getTime()) / (30 * 24 * 60 * 60 * 1000)
    if (monthsSinceRound > 24) {
      score += 15
      signals.push(`No funding in ${Math.round(monthsSinceRound)} months`)
    } else if (monthsSinceRound < 6) {
      score -= 10
      signals.push('Recently funded — retention likely strong')
    }
  }

  // Small headcount = less stability
  if (company.headcount !== undefined && company.headcount < 20) {
    score += 5
    signals.push(`Small team (${company.headcount} employees)`)
  }

  // Company highlights (layoff signals, etc.)
  const highlights = company.highlights || []
  for (const h of highlights) {
    const text = h.text?.toLowerCase() || ''
    if (text.includes('layoff') || text.includes('restructur') || text.includes('downsiz')) {
      score += 20
      signals.push('Recent layoff/restructuring signals')
      break
    }
  }

  // Top investors
  const topInvestors = company.funding_rounds
    ?.flatMap(r => r.investors?.filter(i => i.isLead).map(i => i.investorName) || [])
    .filter(Boolean)
    .slice(0, 3) || []

  return {
    domain: company.website?.domain || '',
    name: company.name,
    score: Math.max(0, Math.min(100, score)),
    signals,
    stage: company.stage,
    headcount: company.headcount,
    engineeringGrowth90d: engGrowth,
    webTrafficChange30d: webChange,
    fundingTotal: company.funding?.fundingTotal,
    lastRoundDate: lastRound,
    topInvestors,
    logoUrl: company.logo_url,
  }
}

// ---------------------------------------------------------------------------
// Utility: extract domain from company name (best-effort)
// ---------------------------------------------------------------------------

export function companyNameToDomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .concat('.com')
}

// ---------------------------------------------------------------------------
// Bulk: enrich multiple companies and rank by poachability
// ---------------------------------------------------------------------------

export async function enrichAndRankCompanies(
  companies: { name: string; domain?: string }[],
): Promise<CompanyPoachability[]> {
  const results = await Promise.allSettled(
    companies.map(async (c) => {
      const domain = c.domain || companyNameToDomain(c.name)
      const data = await enrichCompanyByDomain(domain)
      return computePoachability(data)
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<CompanyPoachability> => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => b.score - a.score) // Most poachable first
}
