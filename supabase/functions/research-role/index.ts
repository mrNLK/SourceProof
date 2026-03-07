import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { anthropicCall, anthropicToolCall } from "../_shared/anthropic.ts";
import { checkSearchGate, incrementSearchCount } from "../_shared/gate.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Subscription gate check (requires authenticated user)
    const gate = await checkSearchGate(req.headers.get('Authorization'));
    if (!gate.allowed) {
      const isAuthError = gate.error === 'authentication_required' || gate.error === 'invalid_token';
      return new Response(JSON.stringify({
        error: gate.error,
        ...(isAuthError ? {} : { upgrade: true, searches_used: gate.searchesUsed, search_limit: gate.searchLimit }),
      }), {
        status: isAuthError ? 401 : 402,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const { action, job_title, company_name, job_description } = await req.json();

    if (action !== 'start') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Either job_description OR (job_title + company_name) must be provided
    const hasJD = job_description && typeof job_description === 'string' && job_description.trim().length > 50;
    const hasManual = job_title && company_name;

    if (!hasJD && !hasManual) {
      return new Response(JSON.stringify({ error: 'Provide either job_description text, or both job_title and company_name' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a world-class technical recruiting strategist. Your job is to build a comprehensive sourcing strategy for a specific role at a specific company.

Think like a senior recruiter who:
- Knows exactly which GitHub repos attract the best talent for this role
- Knows which companies to poach from (direct competitors AND adjacent companies with transferable talent)
- Understands the EEA (Evidence of Exceptional Ability) signals that indicate exceptional candidates
- Can build targeted, high-signal search queries

Be extremely specific with real company names, real GitHub repo names, and actionable intelligence. No generic advice.`;

    let userPrompt: string;

    if (hasJD) {
      userPrompt = `Analyze this job description and build a complete sourcing strategy to find ideal candidates for this role.

<job_description>
${job_description.trim().substring(0, 12000)}
</job_description>

Based on the job description above, I need:
1. A natural language search query optimized for a GitHub-based talent search tool — should capture the ideal candidate profile
2. 8-10 specific GitHub repositories whose contributors would be strong candidates (real repos, owner/name format)
3. 6-8 companies to poach from — direct competitors AND adjacent companies with transferable skills
4. Key technical skills extracted from the JD (the must-haves and nice-to-haves)
5. EEA signals specific to this role — what would make someone exceptional vs. just qualified
6. A brief overview of the role and why someone would want it (based on the JD but written as a compelling pitch)`;
    } else {
      userPrompt = `Build a complete sourcing strategy for: "${job_title}" at "${company_name}"

I need:
1. A natural language search query optimized for a GitHub-based talent search tool
2. 8-10 specific GitHub repositories whose contributors would be strong candidates
3. 6-8 companies to poach from — direct competitors AND adjacent companies with transferable skills
4. Key technical skills (the must-haves and nice-to-haves)
5. EEA signals specific to this role — what would make someone exceptional vs. just qualified
6. A brief overview of the role and why someone would want it`;
    }

    const tools = [{
      name: "build_search_strategy",
      description: "Build a structured search strategy for sourcing candidates",
      input_schema: {
        type: "object",
        properties: {
          search_query: {
            type: "string",
            description: "A detailed, natural language search query optimized for a GitHub-based talent search tool. Should be 2-4 sentences covering the ideal candidate profile, key skills, and what makes them stand out. DO NOT use boolean operators — write it like you're describing your dream candidate to a smart recruiter."
          },
          target_repos: {
            type: "array",
            description: "8-10 specific GitHub repositories (owner/name format) whose contributors would be strong candidates. Include a mix of: the company's own repos, competitor repos, key open-source projects in the domain, and foundational tools. Each with a brief reason.",
            items: {
              type: "object",
              properties: {
                repo: { type: "string", description: "GitHub repo in owner/name format (e.g. 'vercel/next.js')" },
                reason: { type: "string", description: "Why contributors to this repo would be good candidates (1 sentence)" }
              },
              required: ["repo", "reason"]
            }
          },
          poach_companies: {
            type: "array",
            description: "6-8 companies to source from. Mix of direct competitors, adjacent companies with transferable talent, and companies known for strong engineering in this domain.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Company name" },
                reason: { type: "string", description: "Why people from this company would be good fits (1 sentence)" },
                category: { type: "string", enum: ["direct_competitor", "adjacent", "talent_hub"], description: "Relationship to the target company" }
              },
              required: ["name", "reason", "category"]
            }
          },
          skills: {
            type: "object",
            description: "Technical skills breakdown",
            properties: {
              must_have: {
                type: "array",
                items: { type: "string" },
                description: "5-8 must-have skills/technologies"
              },
              nice_to_have: {
                type: "array",
                items: { type: "string" },
                description: "4-6 nice-to-have skills/technologies"
              }
            },
            required: ["must_have", "nice_to_have"]
          },
          eea_signals: {
            type: "array",
            description: "5-8 specific Evidence of Exceptional Ability signals for this role. Each signal must include both a human-readable description AND fields that map directly to Exa Webset search criteria and enrichment definitions. Think: contributions, leadership, publications, community impact, technical depth.",
            items: {
              type: "object",
              properties: {
                signal: { type: "string", description: "The EEA signal in plain language (e.g. 'Maintains a 1000+ star Kubernetes operator')" },
                strength: { type: "string", enum: ["strong", "moderate"], description: "How strong of a signal this is" },
                criterion: { type: "string", description: "Which EEA criterion this maps to (e.g. 'Original Contributions', 'Critical Role', 'Published Material')" },
                webset_criterion: { type: "string", description: "A precise search filter statement for Exa Websets. Written as a factual criterion an AI agent can verify from public web data. Example: 'Person has authored or co-authored a peer-reviewed paper on distributed systems published at a top-tier venue (SOSP, OSDI, NSDI, EuroSys)'" },
                enrichment_description: { type: "string", description: "An instruction for an AI enrichment agent to extract verifiable evidence. Example: 'Find and summarize evidence that this person has made significant open-source contributions to Kubernetes-related projects, including repo names, star counts, and role (maintainer vs contributor)'" },
                enrichment_format: { type: "string", enum: ["text", "options"], description: "Format for the enrichment result. Use 'text' for free-form evidence summaries, 'options' when the signal is binary or categorical." },
                enrichment_options: { type: "array", items: { type: "string" }, description: "Only when enrichment_format is 'options'. The option labels. Example: ['Confirmed maintainer', 'Active contributor', 'Minor contributor', 'No evidence']" },
                verification_method: { type: "string", description: "Brief description of how to verify this signal from public data. Example: 'Check GitHub profile for repos with 1000+ stars where user is listed as maintainer'" }
              },
              required: ["signal", "strength", "criterion", "webset_criterion", "enrichment_description", "enrichment_format", "verification_method"]
            }
          },
          role_overview: {
            type: "string",
            description: "2-3 paragraph overview of the role, what the team works on, why it's exciting, and the kind of impact this person would have. Write it like a compelling pitch to a passive candidate."
          }
        },
        required: ["search_query", "target_repos", "poach_companies", "skills", "eea_signals", "role_overview"]
      }
    }];

    const result = await anthropicToolCall(
      systemPrompt,
      userPrompt,
      tools,
      { type: "tool", name: "build_search_strategy" },
      { maxTokens: 4096 }
    );

    if (!result) {
      throw new Error("AI failed to generate search strategy");
    }

    const strategy = result.toolInput;

    // -------------------------------------------------------------------
    // Harmonic enrichment: enrich poach_companies with real company data
    // -------------------------------------------------------------------
    let harmonicEnrichedCompanies: Record<string, unknown>[] | null = null;
    const harmonicApiKey = Deno.env.get('HARMONIC_API_KEY');
    if (harmonicApiKey && strategy.poach_companies?.length > 0) {
      try {
        const enrichResults = await Promise.allSettled(
          strategy.poach_companies.map(async (pc: { name: string; reason: string; category: string }) => {
            // Best-effort domain guess from company name
            const domain = pc.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
            const url = new URL('https://api.harmonic.ai/companies');
            url.searchParams.set('website_domain', domain);
            url.searchParams.set('apikey', harmonicApiKey);
            const res = await fetch(url.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': harmonicApiKey },
            });
            if (!res.ok) return null;
            const data = await res.json();
            // Compute poachability signals
            const tm = data.traction_metrics;
            const engGrowth = tm?.headcountEngineering?.ago90d?.percentChange;
            const webChange = tm?.webTraffic?.ago30d?.percentChange;
            const signals: string[] = [];
            let poachScore = 50;
            if (engGrowth !== undefined && engGrowth < -5) { poachScore += 20; signals.push(`Eng team shrinking (${engGrowth.toFixed(0)}% 90d)`); }
            else if (engGrowth !== undefined && engGrowth > 20) { poachScore -= 15; signals.push(`Eng team growing (+${engGrowth.toFixed(0)}% 90d)`); }
            if (webChange !== undefined && webChange < -10) { poachScore += 15; signals.push(`Traffic declining (${webChange.toFixed(0)}% 30d)`); }
            if (data.funding?.lastFundingDate) {
              const months = (Date.now() - new Date(data.funding.lastFundingDate).getTime()) / (30*24*60*60*1000);
              if (months > 24) { poachScore += 15; signals.push(`No funding in ${Math.round(months)} months`); }
              else if (months < 6) { poachScore -= 10; signals.push('Recently funded'); }
            }
            for (const h of (data.highlights || [])) {
              if (h.text?.toLowerCase().includes('layoff')) { poachScore += 20; signals.push('Layoff signals'); break; }
            }
            return {
              ...pc,
              harmonic: {
                name: data.name,
                domain: data.website?.domain,
                logo_url: data.logo_url,
                stage: data.stage,
                headcount: data.headcount,
                funding_total: data.funding?.fundingTotal,
                last_round_date: data.funding?.lastFundingDate,
                engineering_growth_90d: engGrowth,
                web_traffic_change_30d: webChange,
                poach_score: Math.max(0, Math.min(100, poachScore)),
                poach_signals: signals,
                top_investors: data.funding_rounds
                  ?.flatMap((r: any) => r.investors?.filter((i: any) => i.isLead).map((i: any) => i.investorName) || [])
                  .slice(0, 3) || [],
                tags: data.tags_v2?.map((t: any) => t.displayValue).slice(0, 5) || [],
              },
            };
          })
        );
        harmonicEnrichedCompanies = enrichResults
          .map(r => r.status === 'fulfilled' ? r.value : null)
          .filter(Boolean) as Record<string, unknown>[];
        // Sort by poachability (most poachable first)
        harmonicEnrichedCompanies.sort((a: any, b: any) =>
          (b.harmonic?.poach_score || 0) - (a.harmonic?.poach_score || 0)
        );
      } catch (e) {
        console.error('Harmonic enrichment failed (non-blocking):', e);
      }
    }

    // If Harmonic enrichment succeeded, merge into strategy
    if (harmonicEnrichedCompanies && harmonicEnrichedCompanies.length > 0) {
      strategy.poach_companies = harmonicEnrichedCompanies;
    }

    // Increment search count for gated users
    if (gate.userId) {
      await incrementSearchCount(gate.userId).catch(e => console.error('Failed to increment search count:', e));
    }

    return new Response(JSON.stringify({
      strategy,
      job_title: job_title || '',
      company_name: company_name || '',
      source: hasJD ? 'job_description' : 'manual',
    }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('research-role error:', e);
    if ((e as Error).message === 'RATE_LIMITED') {
      return new Response(JSON.stringify({ error: 'Rate limited. Please try again in a moment.' }), {
        status: 429,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
