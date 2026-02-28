import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { anthropicToolCall } from "../_shared/anthropic.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Searches for a developer's LinkedIn profile using both Exa (neural search)
 * and Parallel.ai (web search), then uses AI to pick the best match.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, name, location, bio } = await req.json();

    if (!username) {
      return new Response(JSON.stringify({ error: 'username is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const PARALLEL_API_KEY = Deno.env.get('PARALLEL_API_KEY');

    if (!EXA_API_KEY && !PARALLEL_API_KEY) {
      return new Response(JSON.stringify({ error: 'No search API keys configured (EXA_API_KEY or PARALLEL_API_KEY)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchQuery = `${name || username} ${location || ''} LinkedIn profile software engineer`;

    // Run both search providers in parallel, collect all results
    interface LinkedInResult { url: string; title: string; source: string }
    const allResults: LinkedInResult[] = [];

    const searches: Promise<void>[] = [];

    // --- Exa neural search ---
    if (EXA_API_KEY) {
      searches.push((async () => {
        try {
          const exaRes = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
              'x-api-key': EXA_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: searchQuery,
              numResults: 5,
              includeDomains: ['linkedin.com'],
              type: 'neural',
            }),
          });
          if (exaRes.ok) {
            const data = await exaRes.json();
            for (const r of (data.results || [])) {
              allResults.push({ url: r.url, title: r.title || '', source: 'exa' });
            }
          } else {
            console.warn('Exa API error:', exaRes.status);
          }
        } catch (e) {
          console.warn('Exa search failed:', e);
        }
      })());
    }

    // --- Parallel.ai web search ---
    if (PARALLEL_API_KEY) {
      searches.push((async () => {
        try {
          const parallelRes = await fetch('https://api.parallel.ai/v1beta/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PARALLEL_API_KEY,
              'parallel-beta': 'search-extract-2025-10-10',
            },
            body: JSON.stringify({
              objective: `Find the LinkedIn profile for ${name || username}, a software engineer${location ? ` based in ${location}` : ''}. GitHub username: ${username}.`,
              search_queries: [`"${name || username}" site:linkedin.com/in software engineer`],
              max_results: 5,
              mode: 'fast',
              source_policy: {
                include_domains: ['linkedin.com'],
              },
            }),
          });
          if (parallelRes.ok) {
            const data = await parallelRes.json();
            for (const r of (data.results || [])) {
              allResults.push({ url: r.url, title: r.title || '', source: 'parallel' });
            }
          } else {
            console.warn('Parallel.ai search error:', parallelRes.status);
          }
        } catch (e) {
          console.warn('Parallel.ai search failed:', e);
        }
      })());
    }

    await Promise.all(searches);

    // Deduplicate by URL
    const seen = new Set<string>();
    const results = allResults.filter(r => {
      const normalized = r.url.replace(/\/$/, '').toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    if (results.length === 0) {
      return new Response(JSON.stringify({ linkedin_url: null, confidence: 'low', reasoning: 'No LinkedIn profiles found from either Exa or Parallel' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use AI to match the best LinkedIn profile
    let result = { linkedin_url: results[0]?.url || null, confidence: 'low', reasoning: 'AI matching failed' };

    try {
      const toolResult = await anthropicToolCall(
        'You are a recruiter matching GitHub developers to LinkedIn profiles. Return JSON only.',
        `GitHub Developer: ${name || username}, Username: ${username}, Location: ${location || 'unknown'}, Bio: ${bio || 'none'}\n\nLinkedIn search results (from multiple providers):\n${results.map((r, i) => `${i + 1}. ${r.title} - ${r.url} [${r.source}]`).join('\n')}\n\nIdentify the correct LinkedIn profile. Prefer results that appear in multiple sources.`,
        [{
          name: "match_linkedin",
          description: "Match a LinkedIn profile to a GitHub developer",
          input_schema: {
            type: "object",
            properties: {
              linkedin_url: { anyOf: [{ type: "string" }, { type: "null" }] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              reasoning: { type: "string" },
            },
            required: ["linkedin_url", "confidence", "reasoning"],
          },
        }],
        { type: "tool", name: "match_linkedin" }
      );

      if (toolResult) {
        result = toolResult.toolInput as typeof result;
      }
    } catch (e) {
      console.error('AI matching error:', e);
      const bestResult = results.find(r => r.url?.includes('linkedin.com/in/')) || results[0];
      result = { linkedin_url: bestResult?.url || null, confidence: 'low', reasoning: 'No AI matching available' };
    }

    // Update candidate in DB
    if (result.linkedin_url) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabase.from('candidates').update({
        linkedin_url: result.linkedin_url,
        linkedin_confidence: result.confidence,
      }).eq('github_username', username);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in enrich-linkedin:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
