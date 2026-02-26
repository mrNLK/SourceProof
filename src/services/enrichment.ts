import type { Candidate, EnrichmentData } from '@/types'
import { parseSignals } from '@/lib/scoring'

export async function enrichCandidate(
  candidate: Pick<Candidate, 'name' | 'company' | 'role' | 'github_handle'>,
  apiUrl: string
): Promise<EnrichmentData> {
  const response = await fetch(`${apiUrl}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: candidate.name,
      company: candidate.company,
      role: candidate.role,
      github_handle: candidate.github_handle,
    }),
  })

  if (!response.ok) {
    throw new Error(`Enrichment failed: ${response.statusText}`)
  }

  return response.json()
}

export function extractSignalsFromEnrichment(data: EnrichmentData) {
  const parts: string[] = []
  if (data.education) {
    parts.push(...data.education.map(e => `${e.institution} ${e.degree || ''} ${e.field || ''}`))
  }
  if (data.experience) {
    parts.push(...data.experience.map(e => `${e.company} ${e.title}`))
  }
  if (data.skills) parts.push(data.skills.join(' '))
  if (data.publications) parts.push('publications')
  if (data.patents) parts.push('patents')

  return parseSignals(parts.join(' '))
}
