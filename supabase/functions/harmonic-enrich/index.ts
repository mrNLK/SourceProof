import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { getCorsHeaders } from '../_shared/cors.ts'

const HARMONIC_BASE = 'https://api.harmonic.ai'
const CACHE_TTL_DAYS = 7

const ALLOWED_ACTIONS = [
  'enrich_company', 'enrich_person',
  'get_company', 'get_person', 'get_employees',
  'search_companies', 'similar_companies', 'search_agent', 'typeahead',
  'team_connections', 'enrichment_status',
  'batch_companies',
]

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id || null
}

async function harmonicFetch(
  path: string,
  apiKey: string,
  options?: { method?: string; body?: unknown; params?: Record<string, string> },
): Promise<Response> {
  const url = new URL(`${HARMONIC_BASE}${path}`)
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  // Also set apikey as query param (Harmonic accepts both header and query param)
  url.searchParams.set('apikey', apiKey)

  return fetch(url.toString(), {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
}

/**
 * Check cache for company data. Returns cached data if fresh, null otherwise.
 */
async function getCachedCompany(
  supabase: ReturnType<typeof getSupabase>,
  domain: string,
): Promise<unknown | null> {
  const { data } = await supabase
    .from('harmonic_cache')
    .select('data, fetched_at')
    .eq('entity_type', 'company')
    .eq('lookup_key', domain)
    .maybeSingle()

  if (!data) return null
  const age = Date.now() - new Date(data.fetched_at).getTime()
  if (age > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) return null
  return data.data
}

async function cacheCompany(
  supabase: ReturnType<typeof getSupabase>,
  domain: string,
  entityUrn: string,
  companyData: unknown,
) {
  await supabase
    .from('harmonic_cache')
    .upsert({
      entity_type: 'company',
      lookup_key: domain,
      entity_urn: entityUrn,
      data: companyData,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'entity_type,lookup_key' })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const body = await req.json()
    const { action, ...params } = body

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${ALLOWED_ACTIONS.join(', ')}` }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('HARMONIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HARMONIC_API_KEY not configured on server' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const _userId = await getUserId(req.headers.get('Authorization'))
    const supabase = getSupabase()
    let response: Response

    switch (action) {
      // ---------------------------------------------------------------
      // Enrich company by identifier (domain, URL, LinkedIn, etc.)
      // ---------------------------------------------------------------
      case 'enrich_company': {
        const { website_domain, website_url, linkedin_url, crunchbase_url } = params

        // Try cache first if domain is provided
        const cacheKey = website_domain || website_url || linkedin_url || ''
        if (cacheKey) {
          const cached = await getCachedCompany(supabase, cacheKey)
          if (cached) {
            return new Response(
              JSON.stringify(cached),
              { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
            )
          }
        }

        const qp: Record<string, string> = {}
        if (website_domain) qp.website_domain = website_domain
        if (website_url) qp.website_url = website_url
        if (linkedin_url) qp.linkedin_url = linkedin_url
        if (crunchbase_url) qp.crunchbase_url = crunchbase_url

        response = await harmonicFetch('/companies', apiKey, { method: 'POST', params: qp })

        // Cache successful responses
        if (response.ok && cacheKey) {
          const data = await response.clone().json()
          if (data.entity_urn) {
            await cacheCompany(supabase, cacheKey, data.entity_urn, data)
          }
        }
        break
      }

      // ---------------------------------------------------------------
      // Enrich person by LinkedIn URL
      // ---------------------------------------------------------------
      case 'enrich_person': {
        const { person_linkedin_url } = params
        if (!person_linkedin_url) {
          return new Response(
            JSON.stringify({ error: 'person_linkedin_url is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch('/persons', apiKey, {
          method: 'POST',
          params: { linkedin_url: person_linkedin_url },
        })
        break
      }

      // ---------------------------------------------------------------
      // Fetch company by ID/URN
      // ---------------------------------------------------------------
      case 'get_company': {
        const { id_or_urn } = params
        if (!id_or_urn) {
          return new Response(
            JSON.stringify({ error: 'id_or_urn is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch(`/companies/${encodeURIComponent(id_or_urn)}`, apiKey)
        break
      }

      // ---------------------------------------------------------------
      // Fetch person by ID/URN
      // ---------------------------------------------------------------
      case 'get_person': {
        const { id_or_urn } = params
        if (!id_or_urn) {
          return new Response(
            JSON.stringify({ error: 'id_or_urn is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch(`/persons/${encodeURIComponent(id_or_urn)}`, apiKey)
        break
      }

      // ---------------------------------------------------------------
      // Get employees of a company
      // ---------------------------------------------------------------
      case 'get_employees': {
        const { id_or_urn, employee_group_type, size, page } = params
        if (!id_or_urn) {
          return new Response(
            JSON.stringify({ error: 'id_or_urn is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        const qp: Record<string, string> = {}
        if (employee_group_type) qp.employee_group_type = employee_group_type
        if (size) qp.size = String(size)
        if (page) qp.page = String(page)
        response = await harmonicFetch(`/companies/${encodeURIComponent(id_or_urn)}/employees`, apiKey, { params: qp })
        break
      }

      // ---------------------------------------------------------------
      // Natural language company search (Scout / search_agent)
      // ---------------------------------------------------------------
      case 'search_agent': {
        const { query } = params
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'query is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch('/search/search_agent', apiKey, {
          params: { query },
        })
        break
      }

      // ---------------------------------------------------------------
      // Similar companies search
      // ---------------------------------------------------------------
      case 'similar_companies': {
        const { company_urns } = params
        if (!company_urns || !Array.isArray(company_urns)) {
          return new Response(
            JSON.stringify({ error: 'company_urns array is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch('/search/similar_companies', apiKey, {
          method: 'POST',
          body: { company_urns },
        })
        break
      }

      // ---------------------------------------------------------------
      // Keyword-based company search
      // ---------------------------------------------------------------
      case 'search_companies': {
        const { keywords, size: sz, page: pg } = params
        if (!keywords) {
          return new Response(
            JSON.stringify({ error: 'keywords is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        const qp: Record<string, string> = {}
        if (sz) qp.size = String(sz)
        if (pg) qp.page = String(pg)
        response = await harmonicFetch('/search/companies_by_keywords', apiKey, {
          method: 'POST',
          params: qp,
          body: { contains_all_of_keywords: keywords },
        })
        break
      }

      // ---------------------------------------------------------------
      // Typeahead (company/person/investor lookup)
      // ---------------------------------------------------------------
      case 'typeahead': {
        const { query, search_type } = params
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'query is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch('/search/typeahead', apiKey, {
          params: { query, search_type: search_type || 'COMPANY' },
        })
        break
      }

      // ---------------------------------------------------------------
      // Team connections to a company
      // ---------------------------------------------------------------
      case 'team_connections': {
        const { id_or_urn } = params
        if (!id_or_urn) {
          return new Response(
            JSON.stringify({ error: 'id_or_urn is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch(`/companies/${encodeURIComponent(id_or_urn)}/userConnections`, apiKey)
        break
      }

      // ---------------------------------------------------------------
      // Enrichment status check
      // ---------------------------------------------------------------
      case 'enrichment_status': {
        const { ids, urns } = params
        const qp: Record<string, string> = {}
        if (ids) qp.ids = ids.join(',')
        if (urns) qp.urns = urns.join(',')
        response = await harmonicFetch('/enrichment_status', apiKey, { params: qp })
        break
      }

      // ---------------------------------------------------------------
      // Batch get companies by IDs
      // ---------------------------------------------------------------
      case 'batch_companies': {
        const { ids, urns } = params
        if (!ids && !urns) {
          return new Response(
            JSON.stringify({ error: 'ids or urns array is required' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
        response = await harmonicFetch('/companies/batchGet', apiKey, {
          method: 'POST',
          body: { ...(ids ? { ids } : {}), ...(urns ? { urns } : {}) },
        })
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
    }

    const data = await response.json()

    // Handle Harmonic's 404 = enrichment triggered pattern
    if (response.status === 404 && data.enrichment_id) {
      return new Response(
        JSON.stringify({
          enrichment_pending: true,
          enrichment_id: data.enrichment_id,
          message: data.message || 'Enrichment triggered. Check back in a few hours.',
        }),
        { status: 202, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('harmonic-enrich error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
