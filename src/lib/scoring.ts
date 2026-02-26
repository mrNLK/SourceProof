import type { Candidate, Signal, GitHubProfile } from '../types'

interface ScoreWeights {
  phd: number
  top_company: number
  top_company_max: number
  top_university: number
  publications: number
  conferences: number
  open_source: number
  patents: number
  leadership: number
  experience_10_plus: number
}

const WEIGHTS: ScoreWeights = {
  phd: 15,
  top_company: 10,
  top_company_max: 20,
  top_university: 10,
  publications: 15,
  conferences: 10,
  open_source: 10,
  patents: 10,
  leadership: 10,
  experience_10_plus: 5,
}

const TOP_COMPANIES = [
  'google', 'meta', 'apple', 'amazon', 'microsoft', 'netflix',
  'openai', 'anthropic', 'stripe', 'databricks', 'snowflake',
  'nvidia', 'tesla', 'spacex', 'palantir', 'figma', 'vercel',
  'github', 'gitlab', 'hashicorp', 'datadog', 'cloudflare',
]

const TOP_UNIVERSITIES = [
  'mit', 'stanford', 'cmu', 'carnegie mellon', 'berkeley', 'caltech',
  'harvard', 'princeton', 'yale', 'oxford', 'cambridge', 'eth zurich',
  'georgia tech', 'university of washington', 'cornell', 'columbia',
  'university of illinois', 'uiuc', 'university of michigan',
]

export function calculateScore(candidate: Candidate): number {
  let score = 0
  const signals = candidate.signals || []

  if (signals.some(s => s.type === 'degree' && s.label.toLowerCase().includes('phd'))) {
    score += WEIGHTS.phd
  }

  const companySignals = signals.filter(s => s.type === 'company')
  let companyScore = 0
  for (const s of companySignals) {
    if (TOP_COMPANIES.some(c => s.label.toLowerCase().includes(c))) {
      companyScore += WEIGHTS.top_company
    }
  }
  score += Math.min(companyScore, WEIGHTS.top_company_max)

  if (signals.some(s => s.type === 'university' &&
    TOP_UNIVERSITIES.some(u => s.label.toLowerCase().includes(u)))) {
    score += WEIGHTS.top_university
  }

  if (signals.some(s => s.type === 'publication')) score += WEIGHTS.publications
  if (signals.some(s => s.type === 'conference')) score += WEIGHTS.conferences
  if (signals.some(s => s.type === 'open_source')) score += WEIGHTS.open_source
  if (signals.some(s => s.type === 'patent')) score += WEIGHTS.patents
  if (signals.some(s => s.type === 'leadership')) score += WEIGHTS.leadership
  if (signals.some(s => s.type === 'experience' &&
    parseInt(s.value || '0') >= 10)) score += WEIGHTS.experience_10_plus

  // GitHub profile bonus
  if (candidate.github_profile) {
    score += calculateGitHubBonus(candidate.github_profile)
  }

  return Math.min(100, score)
}

function calculateGitHubBonus(profile: GitHubProfile): number {
  let bonus = 0
  const sp = profile.skill_profile

  if (sp.overall_score >= 80) bonus += 10
  else if (sp.overall_score >= 60) bonus += 5

  if (sp.depth_score >= 80) bonus += 5
  if (sp.collaboration_score >= 70) bonus += 3

  if (profile.public_repos >= 50) bonus += 3
  else if (profile.public_repos >= 20) bonus += 1

  if (profile.followers >= 100) bonus += 3
  else if (profile.followers >= 50) bonus += 1

  const totalStars = profile.repositories.reduce((sum, r) => sum + r.stars, 0)
  if (totalStars >= 1000) bonus += 5
  else if (totalStars >= 100) bonus += 2

  return Math.min(bonus, 20)
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#00e5a0'
  if (score >= 60) return '#eab308'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Low'
}

export function parseSignals(text: string): Signal[] {
  const signals: Signal[] = []
  const lower = text.toLowerCase()

  // University detection
  for (const uni of TOP_UNIVERSITIES) {
    if (lower.includes(uni)) {
      signals.push({ type: 'university', label: uni.replace(/\b\w/g, c => c.toUpperCase()) })
    }
  }

  // Company detection
  for (const company of TOP_COMPANIES) {
    if (lower.includes(company)) {
      signals.push({ type: 'company', label: company.replace(/\b\w/g, c => c.toUpperCase()) })
    }
  }

  // Degree detection
  if (/\bph\.?d\b/i.test(text)) signals.push({ type: 'degree', label: 'PhD' })
  if (/\bm\.?s\.?\b/i.test(text) || /master/i.test(text)) signals.push({ type: 'degree', label: 'Masters' })

  // Publication detection
  if (/\bpublication|published|paper|journal|arxiv\b/i.test(text)) {
    signals.push({ type: 'publication', label: 'Publications' })
  }

  // Conference detection
  if (/\bconference|nips|neurips|icml|cvpr|acl|iclr|sigmod|osdi|sosp\b/i.test(text)) {
    signals.push({ type: 'conference', label: 'Conference Speaker' })
  }

  // Open source detection
  if (/\bopen.?source|contributor|maintainer|committer\b/i.test(text)) {
    signals.push({ type: 'open_source', label: 'Open Source' })
  }

  // Patent detection
  if (/\bpatent/i.test(text)) signals.push({ type: 'patent', label: 'Patents' })

  // Leadership detection
  if (/\b(vp|director|head of|chief|cto|ceo|founder|co-founder|lead|principal|staff)\b/i.test(text)) {
    signals.push({ type: 'leadership', label: 'Leadership' })
  }

  return signals
}
