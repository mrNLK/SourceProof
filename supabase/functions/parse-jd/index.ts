import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Fetches a job description URL and returns the extracted text content.
 * Uses Parallel.ai Extract API for reliable JS-rendered page extraction,
 * falls back to raw fetch + HTML stripping if Parallel is unavailable.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL. Please provide a valid http/https URL.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let text = '';
    let source = 'raw';

    // --- Strategy 1: Parallel.ai Extract API (handles JS-rendered pages) ---
    const PARALLEL_API_KEY = Deno.env.get('PARALLEL_API_KEY');
    if (PARALLEL_API_KEY) {
      try {
        console.log('parse-jd: using Parallel.ai Extract for', url);
        const parallelRes = await fetch('https://api.parallel.ai/v1beta/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': PARALLEL_API_KEY,
            'parallel-beta': 'search-extract-2025-10-10',
          },
          body: JSON.stringify({
            urls: [url],
            objective: 'Extract the full job description including role title, responsibilities, requirements, qualifications, and any company/team information.',
            full_content: true,
            excerpts: false,
          }),
        });

        if (parallelRes.ok) {
          const data = await parallelRes.json();
          const result = data.results?.[0];
          if (result?.full_content && result.full_content.length >= 100) {
            text = result.full_content;
            source = 'parallel';
            console.log(`parse-jd: Parallel.ai extracted ${text.length} chars`);
          } else if (data.errors?.length > 0) {
            console.warn('parse-jd: Parallel.ai extract error:', data.errors[0]);
          }
        } else {
          console.warn('parse-jd: Parallel.ai returned', parallelRes.status);
        }
      } catch (e) {
        console.warn('parse-jd: Parallel.ai failed, falling back to raw fetch:', e);
      }
    }

    // --- Strategy 2: Raw fetch + HTML stripping (fallback) ---
    if (!text) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch URL: HTTP ${response.status}` }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const html = await response.text();

      text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article|header|footer)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&mdash;/gi, '—')
        .replace(/&ndash;/gi, '–')
        .replace(/&bull;/gi, '•')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      source = 'raw';
    }

    // Truncate to ~15k chars to avoid blowing up the AI context
    if (text.length > 15000) {
      text = text.substring(0, 15000) + '\n\n[Content truncated]';
    }

    // Quality check
    if (text.length < 100) {
      return new Response(JSON.stringify({
        error: 'Could not extract meaningful text from this URL. The page may require JavaScript to render. Try pasting the job description text directly instead.',
        text: text,
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ text, url, chars: text.length, source }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-jd error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to parse job description' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
