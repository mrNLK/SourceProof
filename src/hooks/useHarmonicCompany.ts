import { useQuery } from '@tanstack/react-query'
import { enrichCompanyByDomain, computePoachability } from '@/services/harmonic'
import type { HarmonicCompany, CompanyPoachability } from '@/types/harmonic'

/**
 * Fetch and cache Harmonic company data for a given domain.
 * Returns company enrichment data + computed poachability score.
 */
export function useHarmonicCompany(domain: string | null | undefined) {
  const query = useQuery({
    queryKey: ['harmonic-company', domain],
    queryFn: async () => {
      if (!domain) throw new Error('No domain')
      const company = await enrichCompanyByDomain(domain)
      const poachability = computePoachability(company)
      return { company, poachability }
    },
    enabled: !!domain,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  })

  return {
    company: query.data?.company as HarmonicCompany | undefined,
    poachability: query.data?.poachability as CompanyPoachability | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Extract a likely company domain from a candidate's bio/about text.
 * Looks for @company patterns, "at Company" patterns, or known company names.
 */
export function extractCompanyDomain(bio?: string, about?: string): string | null {
  const text = `${bio || ''} ${about || ''}`.toLowerCase()
  if (!text.trim()) return null

  // Try to find @company.com or company.com patterns
  const domainMatch = text.match(/(?:@|at\s+)([a-z0-9-]+\.(?:com|io|ai|dev|co|org|net))/i)
  if (domainMatch) return domainMatch[1]

  // Known major companies → domains
  const knownCompanies: Record<string, string> = {
    google: 'google.com', meta: 'meta.com', facebook: 'meta.com',
    apple: 'apple.com', amazon: 'amazon.com', microsoft: 'microsoft.com',
    netflix: 'netflix.com', stripe: 'stripe.com', openai: 'openai.com',
    anthropic: 'anthropic.com', deepmind: 'deepmind.com', vercel: 'vercel.com',
    supabase: 'supabase.com', github: 'github.com', gitlab: 'gitlab.com',
    databricks: 'databricks.com', snowflake: 'snowflake.com',
    airbnb: 'airbnb.com', uber: 'uber.com', lyft: 'lyft.com',
    coinbase: 'coinbase.com', figma: 'figma.com', notion: 'notion.so',
    linear: 'linear.app', datadog: 'datadoghq.com',
    palantir: 'palantir.com', cloudflare: 'cloudflare.com',
    shopify: 'shopify.com', twilio: 'twilio.com', plaid: 'plaid.com',
  }

  for (const [name, domain] of Object.entries(knownCompanies)) {
    if (text.includes(name)) return domain
  }

  return null
}
