import type { GitHubProfile, GitHubRepo, SkillProfile, SkillDomain, LanguageStat } from '@/types'

const GITHUB_API = 'https://api.github.com'

async function githubFetch(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${GITHUB_API}${path}`, { headers })
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }
  return response
}

export async function fetchGitHubProfile(username: string, token?: string): Promise<GitHubProfile> {
  const [userRes, reposRes] = await Promise.all([
    githubFetch(`/users/${username}`, token),
    githubFetch(`/users/${username}/repos?sort=updated&per_page=100`, token),
  ])

  const user = await userRes.json()
  const repos: GitHubRepo[] = (await reposRes.json())
    .filter((r: { fork: boolean }) => !r.fork)
    .map((r: Record<string, unknown>) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description || '',
      language: r.language || null,
      stars: r.stargazers_count,
      forks: r.forks_count,
      is_fork: r.fork,
      topics: r.topics || [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))

  const languages = computeLanguageStats(repos)
  const skillProfile = buildSkillProfile(repos, user)

  return {
    username: user.login,
    avatar_url: user.avatar_url,
    bio: user.bio,
    public_repos: user.public_repos,
    followers: user.followers,
    following: user.following,
    top_languages: languages,
    skill_profile: skillProfile,
    repositories: repos,
  }
}

function computeLanguageStats(repos: GitHubRepo[]): LanguageStat[] {
  const langCount: Record<string, number> = {}
  for (const repo of repos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1
    }
  }

  const total = Object.values(langCount).reduce((a, b) => a + b, 0)
  return Object.entries(langCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([language, count]) => ({
      language,
      percentage: Math.round((count / total) * 100),
      bytes: count,
    }))
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'Machine Learning': ['ml', 'machine-learning', 'deep-learning', 'neural', 'tensorflow', 'pytorch', 'transformer', 'llm', 'nlp', 'computer-vision'],
  'Systems Programming': ['kernel', 'os', 'driver', 'embedded', 'firmware', 'rtos', 'low-level', 'assembly'],
  'Web Development': ['react', 'vue', 'angular', 'nextjs', 'web', 'frontend', 'fullstack', 'css', 'html'],
  'Backend / Infrastructure': ['api', 'microservices', 'kubernetes', 'docker', 'cloud', 'aws', 'terraform', 'infra'],
  'Data Engineering': ['etl', 'pipeline', 'spark', 'kafka', 'airflow', 'data-engineering', 'dbt', 'warehouse'],
  'DevOps / SRE': ['ci-cd', 'monitoring', 'sre', 'devops', 'deployment', 'gitops', 'helm'],
  'Security': ['security', 'crypto', 'encryption', 'vulnerability', 'pentest', 'ctf'],
  'Mobile': ['ios', 'android', 'react-native', 'flutter', 'swift', 'kotlin'],
  'Blockchain': ['blockchain', 'solidity', 'web3', 'ethereum', 'smart-contract', 'defi'],
  'Compilers / PL': ['compiler', 'parser', 'interpreter', 'language', 'wasm', 'llvm', 'ast'],
  'Robotics': ['robotics', 'ros', 'slam', 'control', 'sensor', 'actuator', 'autonomous'],
}

function buildSkillProfile(repos: GitHubRepo[], user: Record<string, unknown>): SkillProfile {
  const domains: SkillDomain[] = []

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matchingRepos: string[] = []
    const evidence: string[] = []

    for (const repo of repos) {
      const text = `${repo.name} ${repo.description || ''} ${repo.topics.join(' ')}`.toLowerCase()
      const matched = keywords.filter(k => text.includes(k))
      if (matched.length > 0) {
        matchingRepos.push(repo.name)
        evidence.push(...matched.map(k => `${repo.name}: ${k}`))
      }
    }

    if (matchingRepos.length > 0) {
      const repoCount = matchingRepos.length
      const starBonus = repos
        .filter(r => matchingRepos.includes(r.name))
        .reduce((s, r) => s + Math.min(r.stars, 100), 0) / 10
      const score = Math.min(100, repoCount * 15 + starBonus)

      domains.push({
        name: domain,
        score: Math.round(score),
        evidence: evidence.slice(0, 5),
        repos: matchingRepos.slice(0, 5),
      })
    }
  }

  domains.sort((a, b) => b.score - a.score)

  const repoCount = repos.length
  const totalStars = repos.reduce((s, r) => s + r.stars, 0)
  const followers = (user.followers as number) || 0

  const depthScore = domains.length > 0 ? Math.round(domains[0].score) : 0
  const breadthScore = Math.min(100, domains.length * 20)
  const collaborationScore = Math.min(100, followers * 2 + Math.min(totalStars, 200))
  const consistencyScore = Math.min(100, repoCount * 3)

  const overall = Math.round(
    depthScore * 0.3 + breadthScore * 0.25 + collaborationScore * 0.25 + consistencyScore * 0.2
  )

  return {
    domains,
    overall_score: overall,
    depth_score: depthScore,
    breadth_score: breadthScore,
    collaboration_score: collaborationScore,
    consistency_score: consistencyScore,
  }
}

export async function searchGitHubUsers(
  query: string,
  token?: string
): Promise<Array<{ username: string; avatar_url: string; bio: string; repos: number; followers: number }>> {
  const res = await githubFetch(`/search/users?q=${encodeURIComponent(query)}&per_page=20`, token)
  const data = await res.json()

  const users = await Promise.all(
    (data.items || []).slice(0, 10).map(async (item: Record<string, unknown>) => {
      try {
        const userRes = await githubFetch(`/users/${item.login}`, token)
        const user = await userRes.json()
        return {
          username: user.login,
          avatar_url: user.avatar_url,
          bio: user.bio || '',
          repos: user.public_repos,
          followers: user.followers,
        }
      } catch {
        return {
          username: item.login as string,
          avatar_url: item.avatar_url as string,
          bio: '',
          repos: 0,
          followers: 0,
        }
      }
    })
  )

  return users
}
