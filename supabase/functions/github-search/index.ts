import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
}

interface GitHubRepo {
  name: string;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  description: string | null;
}

const GITHUB_API = "https://api.github.com";

async function githubFetch(url: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'SourceKit-App',
  };
  const token = Deno.env.get('GITHUB_TOKEN');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`GitHub API error: ${res.status} for ${url}`);
    return null;
  }
  return res.json();
}

// GitHub language colors
const langColors: Record<string, string> = {
  JavaScript: "hsl(50, 90%, 50%)",
  TypeScript: "hsl(210, 80%, 55%)",
  Python: "hsl(55, 70%, 50%)",
  Rust: "hsl(20, 80%, 55%)",
  Go: "hsl(195, 60%, 50%)",
  Java: "hsl(15, 80%, 55%)",
  "C++": "hsl(240, 50%, 55%)",
  C: "hsl(200, 40%, 50%)",
  Ruby: "hsl(0, 60%, 50%)",
  PHP: "hsl(240, 40%, 55%)",
  Swift: "hsl(15, 90%, 55%)",
  Kotlin: "hsl(270, 60%, 55%)",
  Shell: "hsl(100, 40%, 50%)",
  HTML: "hsl(15, 80%, 55%)",
  CSS: "hsl(280, 60%, 55%)",
  Dart: "hsl(195, 80%, 50%)",
  Scala: "hsl(0, 70%, 55%)",
  Lua: "hsl(240, 80%, 60%)",
  Elixir: "hsl(270, 50%, 55%)",
  Haskell: "hsl(270, 40%, 50%)",
};

function getLangColor(lang: string): string {
  return langColors[lang] || `hsl(${Math.abs(lang.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360}, 50%, 55%)`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search GitHub users
    const searchData = await githubFetch(`${GITHUB_API}/search/users?q=${encodeURIComponent(query)}&per_page=12`);
    if (!searchData) {
      return new Response(JSON.stringify({ error: 'GitHub API request failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const users: GitHubUser[] = searchData.items || [];

    // Enrich each user with profile + repos data (in parallel)
    const enriched = await Promise.all(
      users.slice(0, 10).map(async (user) => {
        const [profile, repos] = await Promise.all([
          githubFetch(`${GITHUB_API}/users/${user.login}`),
          githubFetch(`${GITHUB_API}/users/${user.login}/repos?sort=stars&per_page=30`),
        ]);

        if (!profile) return null;

        const repoList: GitHubRepo[] = repos || [];
        const ownRepos = repoList.filter(r => !r.fork);

        // Calculate total stars
        const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);

        // Aggregate languages
        const langCount: Record<string, number> = {};
        for (const repo of ownRepos) {
          if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
          }
        }
        const totalLangRepos = Object.values(langCount).reduce((a, b) => a + b, 0) || 1;
        const topLanguages = Object.entries(langCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, count]) => ({
            name,
            percentage: Math.round((count / totalLangRepos) * 100),
            color: getLangColor(name),
          }));

        // Compute a simple "score"
        const starScore = Math.min(totalStars / 100, 30);
        const repoScore = Math.min(profile.public_repos / 5, 20);
        const followerScore = Math.min(profile.followers / 50, 20);
        const contribScore = Math.min((profile.public_repos * 50) / 500, 30);
        const score = Math.min(Math.round(starScore + repoScore + followerScore + contribScore), 99);

        const hiddenGem = totalStars > 50 && profile.followers < 500;

        // Top highlights from repos
        const highlights = ownRepos
          .filter(r => r.stargazers_count > 0)
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
          .slice(0, 3)
          .map(r => `${r.name}: ${r.description || 'No description'} (${r.stargazers_count}⭐)`);

        const joinedYear = new Date(profile.created_at).getFullYear();

        return {
          id: user.login,
          username: user.login,
          name: profile.name || user.login,
          avatarUrl: profile.avatar_url,
          bio: profile.bio || `GitHub user with ${profile.public_repos} public repos.`,
          location: profile.location || "",
          totalContributions: profile.public_repos * 50, // estimate
          publicRepos: profile.public_repos,
          followers: profile.followers,
          stars: totalStars,
          topLanguages,
          highlights: highlights.length ? highlights : [`${profile.public_repos} public repositories`],
          score,
          hiddenGem,
          joinedYear,
        };
      })
    );

    const results = enriched.filter(Boolean);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in github-search:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
