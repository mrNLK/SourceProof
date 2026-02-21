import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, job_title, company_name } = await req.json();

    if (action !== 'start') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!job_title || !company_name) {
      return new Response(JSON.stringify({ error: 'Missing job_title or company_name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are a technical recruiting research assistant. Given a job title and company, provide a comprehensive research brief in markdown format. Include:

## Role Overview
Brief description of what this role does at this company.

## Key Skills & Technologies
Bullet list of the most important technical skills, languages, frameworks, and tools.

## Relevant Open Source Repositories
List GitHub repos (with links) that contributors to would likely be strong candidates for this role. Format as bullet list with repo name and why it's relevant.

## What the Team Works On
What products, services, or infrastructure this team likely builds/maintains at this company.

## Suggested Search Queries
3-5 natural language search queries that could be used to find candidates for this role (formatted for a GitHub-based talent search tool).

Be specific and practical. Use real repo names and technologies.`;

    const userPrompt = `Research the role: "${job_title}" at "${company_name}"`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await res.text();
      console.error('AI gateway error:', res.status, errText);
      throw new Error(`AI gateway error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || 'No research results generated.';

    return new Response(JSON.stringify({ research: content, job_title, company_name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('research-role error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
