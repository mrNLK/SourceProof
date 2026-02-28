import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXA_BASE = 'https://api.exa.ai/websets/v0';

async function exaFetch(path: string, options?: { method?: string; body?: unknown }) {
  const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
  if (!EXA_API_KEY) throw new Error('EXA_API_KEY not configured');

  const res = await fetch(`${EXA_BASE}${path}`, {
    method: options?.method || 'GET',
    headers: {
      'x-api-key': EXA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    console.error(`Exa Websets API error ${res.status}:`, err);
    throw new Error(`Exa API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Exa Websets proxy — manages talent monitors.
 *
 * Actions:
 *   create   — Create a new Webset with search criteria + enrichments for talent discovery
 *   list     — List all Websets
 *   get      — Get a Webset by ID (includes status)
 *   items    — List items (discovered candidates) for a Webset
 *   delete   — Delete a Webset
 *   monitor  — Create a monitor for auto-refresh on a schedule
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    let result: unknown;

    switch (action) {
      // ─── Create a talent search Webset ────────────────────────
      case 'create': {
        const { query, count = 25, criteria = [], enrichments = [] } = params;

        if (!query || typeof query !== 'string') {
          return new Response(JSON.stringify({ error: 'query is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Build enrichment configs — always include these base enrichments
        const baseEnrichments = [
          { description: 'GitHub username or profile URL', format: 'text' },
          { description: 'Primary programming languages and technologies', format: 'text' },
          { description: 'Current company and job title', format: 'text' },
          { description: 'Email address for professional contact', format: 'email' },
          { description: 'LinkedIn profile URL', format: 'url' },
        ];

        // Merge with any user-provided enrichments
        const allEnrichments = [
          ...baseEnrichments,
          ...enrichments.map((e: any) => ({
            description: e.description,
            format: e.format || 'text',
          })),
        ];

        // Build search criteria
        const searchCriteria = criteria.length > 0
          ? criteria.map((c: string) => ({ description: c }))
          : undefined;

        const body: Record<string, unknown> = {
          search: {
            query,
            count: Math.min(count, 100),
            entity: { type: 'person' },
            ...(searchCriteria ? { criteria: searchCriteria } : {}),
          },
          enrichments: allEnrichments,
        };

        result = await exaFetch('/websets', { method: 'POST', body });
        break;
      }

      // ─── List all Websets ──────────────────────────────────────
      case 'list': {
        result = await exaFetch('/websets');
        break;
      }

      // ─── Get a single Webset ───────────────────────────────────
      case 'get': {
        const { websetId } = params;
        if (!websetId) {
          return new Response(JSON.stringify({ error: 'websetId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await exaFetch(`/websets/${websetId}`);
        break;
      }

      // ─── List items for a Webset ───────────────────────────────
      case 'items': {
        const { websetId, cursor } = params;
        if (!websetId) {
          return new Response(JSON.stringify({ error: 'websetId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const qs = cursor ? `?cursor=${cursor}` : '';
        result = await exaFetch(`/websets/${websetId}/items${qs}`);
        break;
      }

      // ─── Delete a Webset ───────────────────────────────────────
      case 'delete': {
        const { websetId } = params;
        if (!websetId) {
          return new Response(JSON.stringify({ error: 'websetId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await exaFetch(`/websets/${websetId}`, { method: 'DELETE' });
        break;
      }

      // ─── Create a monitor for scheduled updates ────────────────
      case 'monitor': {
        const { websetId, cron = '0 9 * * 1', timezone = 'Etc/UTC' } = params;
        if (!websetId) {
          return new Response(JSON.stringify({ error: 'websetId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await exaFetch('/monitors', {
          method: 'POST',
          body: {
            websetId,
            cadence: { cron, timezone },
            behavior: {
              type: 'search',
              config: { behavior: 'append' },
            },
          },
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('websets error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Websets operation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
