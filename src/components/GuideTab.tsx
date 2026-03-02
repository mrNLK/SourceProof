import { useState } from "react";
import { ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Data ─── */

const WORKFLOW = [
  { label: "Research", desc: "Role + Company or JD" },
  { label: "Repo Map", desc: "Target repos identified" },
  { label: "Company Map", desc: "Poach list built" },
  { label: "Edit Query", desc: "Tune repos + skills" },
  { label: "Run Search", desc: "Scored pipeline out" },
];

const QUICK_START = [
  { label: "Sign In" },
  { label: "Role" },
  { label: "Repos" },
  { label: "Search" },
  { label: "Review" },
  { label: "Webset" },
  { label: "Pipeline" },
];

const QUICK_START_FULL = [
  { title: "Sign in", desc: "with Google at getsourcekit.vercel.app" },
  { title: "Enter a role", desc: "type role + company, paste a JD, or drop a job URL" },
  { title: "Edit the repo list", desc: "this is the biggest lever for result quality" },
  { title: "Run the search", desc: "filter by language, commits, location" },
  { title: "Review candidates", desc: 'try "Find LinkedIn" and "Enrich" on top matches' },
  { title: "Create a Webset", desc: "set criteria and monitoring for persistent tracking" },
  { title: "Pipeline", desc: "add candidates, drag between stages, bulk actions, export CSV" },
];

const POWERS = [
  { tag: "Search", title: "Exa Search", desc: "Semantic search across GitHub, papers, blogs. Finds people by what they build, not keywords." },
  { tag: "Monitor", title: "Exa Websets", desc: "Persistent collections with AI verification. Set criteria, enrich automatically, monitor for new matches." },
  { tag: "Analyze", title: "Claude + Parallel", desc: "AI parses JDs, infers stacks, drafts outreach, and scores EEA strength per candidate." },
];

const WEBSET_PIPELINE = [
  { label: "Create" },
  { label: "Discover" },
  { label: "Verify" },
  { label: "Enrich" },
  { label: "Monitor" },
];

const PIPELINE_STAGES = [
  { label: "Sourced" },
  { label: "Contacted" },
  { label: "Responded" },
  { label: "Screen" },
  { label: "Offer" },
];

const EEA_EXAMPLES = [
  {
    role: "Senior ML Engineer",
    criteria: [
      "Published at NeurIPS / ICML / ICLR in last 3 years",
      "Top-20 contributor to 1K+ star ML repo",
      "Industry experience, not purely academic",
    ],
  },
  {
    role: "Staff Platform Engineer",
    criteria: [
      "Designed systems serving 10K+ RPS in production",
      "Open-source maintainer or RFC author",
      "Led cross-team platform migrations",
    ],
  },
];

const PRO_TIPS = [
  { title: "Be specific", desc: '"ML Infra Engineer, training pipelines" beats "ML Engineer"' },
  { title: "Edit repos", desc: "The AI list is a starting point. Your edits are the biggest quality lever." },
  { title: "Hidden gems", desc: "High commits + low followers = under-recruited and responsive." },
  { title: "Webset criteria", desc: "Quantifiable and verifiable beats aspirational." },
];

const INPUT_METHODS = [
  { title: "Role + Company", desc: "Claude infers the stack, finds repos, builds your strategy" },
  { title: "Paste a JD", desc: "AI parses requirements, technologies, and seniority level" },
  { title: "Paste a Job URL", desc: "Parallel.ai extracts JDs from Lever, Greenhouse, Ashby" },
];

const EEA_ARTIFACTS = [
  { label: "Published Research", examples: "Papers at top venues, patents, h-index, citations" },
  { label: "Open Source Impact", examples: "Maintainer of 1K+ star repos, framework contributions, adopted RFCs" },
  { label: "Conference & Teaching", examples: "Keynotes, invited talks, courses, high-reach technical blogs" },
  { label: "Industry Recognition", examples: "Awards, top-N lists, Kaggle Grandmaster, fellowships" },
  { label: "Technical Leadership", examples: "Systems at scale, standards contributions, design docs" },
  { label: "Scale & Impact", examples: "Products with 1M+ users, documented perf gains, post-mortems" },
];

const RECIPE_EXAMPLE = {
  role: "Senior ML Engineer",
  query: "ML engineers who publish research and contribute to open source ML projects",
  criteria: [
    "Published at NeurIPS, ICML, or ICLR in last 3 years",
    "Maintainer / top-20 contributor to repo with 1K+ stars in ML/AI",
    "Has industry experience, not purely academic",
  ],
  enrichments: [
    "Peer-reviewed publications with venues (text)",
    "GitHub repos maintained with star counts (text)",
    "Most compelling outreach hook (text)",
    "Contact email (email)",
    "EEA strength: Strong / Moderate / Emerging (options)",
  ],
};

const STACK = ["Claude AI", "Exa Search", "Exa Websets", "Parallel.ai", "GitHub API", "React + TS", "Supabase", "Vercel"];

/* ─── Shared Components ─── */

const SteppedBar = ({ steps, size = "md" }: { steps: { label: string; desc?: string }[]; size?: "sm" | "md" }) => (
  <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
    {steps.map((step, i) => (
      <div
        key={step.label}
        className={`flex-1 text-center ${size === "sm" ? "py-2 px-1.5" : "py-3 px-2"} ${
          i < steps.length - 1 ? "border-r border-border" : ""
        }`}
      >
        <div className={`font-display font-bold text-foreground ${size === "sm" ? "text-[10px]" : "text-xs"}`}>
          {step.label}
        </div>
        {step.desc && (
          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{step.desc}</div>
        )}
      </div>
    ))}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-widest mb-3">
    {children}
  </h2>
);

/* ─── Quick Reference (Poster-style) ─── */
const QuickReferenceView = () => (
  <div className="space-y-5">
    {/* Workflow */}
    <div>
      <SectionLabel>Workflow</SectionLabel>
      <SteppedBar steps={WORKFLOW} />
    </div>

    {/* Quick Start */}
    <div>
      <SectionLabel>Quick Start</SectionLabel>
      <SteppedBar steps={QUICK_START} size="sm" />
    </div>

    {/* What Powers It */}
    <div>
      <SectionLabel>What Powers It</SectionLabel>
      <div className="grid grid-cols-3 gap-2.5">
        {POWERS.map((p) => (
          <div key={p.title} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <span className="inline-block text-[9px] font-display font-bold text-primary uppercase tracking-wider bg-primary/10 rounded px-1.5 py-0.5">
              {p.tag}
            </span>
            <div className="text-xs font-display font-bold text-foreground">{p.title}</div>
            <div className="text-[10.5px] text-muted-foreground leading-snug">{p.desc}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Websets Pipeline */}
    <div>
      <SectionLabel>Websets Pipeline</SectionLabel>
      <SteppedBar steps={WEBSET_PIPELINE} size="sm" />
    </div>

    {/* EEA-Driven Sourcing */}
    <div>
      <SectionLabel>EEA-Driven Sourcing</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        {EEA_EXAMPLES.map((ex) => (
          <div key={ex.role} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 pt-2.5 pb-1.5">
              <div className="text-[11px] font-display font-bold text-foreground">{ex.role}</div>
            </div>
            <div className="px-3 pb-2.5 space-y-0">
              {ex.criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2 py-1">
                  <div className="w-0.5 h-3.5 rounded-full bg-primary shrink-0 mt-0.5" />
                  <span className="text-[10.5px] text-muted-foreground leading-snug">{c}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Pro Tips */}
    <div>
      <SectionLabel>Pro Tips</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        {PRO_TIPS.map((tip) => (
          <div key={tip.title} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5">
            <div className="w-0.5 self-stretch rounded-full bg-primary shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-foreground">{tip.title}.</span>{" "}
              <span className="text-[10.5px] text-muted-foreground">{tip.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Pipeline */}
    <div>
      <SectionLabel>Pipeline Stages</SectionLabel>
      <SteppedBar steps={PIPELINE_STAGES} size="sm" />
    </div>

    {/* Stack */}
    <div>
      <SectionLabel>Stack</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {STACK.map((tech) => (
          <span key={tech} className="text-[10px] font-display font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1">
            {tech}
          </span>
        ))}
      </div>
    </div>

    {/* Docs link */}
    <div className="pt-1">
      <button
        onClick={() => window.open("https://sourcekit-docs.netlify.app", "_blank")}
        className="text-[11px] font-display font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
      >
        Full documentation
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  </div>
);

/* ─── Full Guide ─── */
const FullGuideView = () => (
  <div className="space-y-5">
    {/* Workflow */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>Workflow</SectionLabel>
      <SteppedBar steps={WORKFLOW} />
    </div>

    {/* Three Ways to Start */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>Three Ways to Start</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        {INPUT_METHODS.map((method) => (
          <div key={method.title} className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="text-xs font-display font-bold text-foreground">{method.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug">{method.desc}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Quick Start */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>Quick Start</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {QUICK_START_FULL.map((step, i) => (
          <div key={i} className="py-2.5 border-b border-border/40 last:border-b-0">
            <span className="text-[13px] font-semibold text-foreground">{step.title}</span>{" "}
            <span className="text-[13px] text-muted-foreground">{step.desc}</span>
          </div>
        ))}
      </div>
    </div>

    {/* What Powers It */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>What Powers It</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        {POWERS.map((p) => (
          <div key={p.title} className="rounded-lg border border-border p-3 space-y-1.5">
            <span className="inline-block text-[9px] font-display font-bold text-primary uppercase tracking-wider bg-primary/10 rounded px-1.5 py-0.5">
              {p.tag}
            </span>
            <div className="text-xs font-display font-bold text-foreground">{p.title}</div>
            <div className="text-[10.5px] text-muted-foreground leading-snug">{p.desc}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Pro Tips */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>Pro Tips</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PRO_TIPS.map((tip) => (
          <div key={tip.title} className="flex items-start gap-2.5 p-2.5">
            <div className="w-0.5 self-stretch rounded-full bg-primary shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-foreground">{tip.title}.</span>{" "}
              <span className="text-[10.5px] text-muted-foreground">{tip.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* EEA Artifact Types */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>EEA Artifact Types</SectionLabel>
      <p className="text-xs text-muted-foreground mb-3">
        Evidence of Exceptional Ability - verifiable signals that put someone in the top 5-10%. Pick 3-5 per role as Webset criteria.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EEA_ARTIFACTS.map((a) => (
          <div key={a.label} className="rounded-lg border border-border p-2.5">
            <div className="text-xs font-semibold text-foreground mb-1">{a.label}</div>
            <div className="text-[10.5px] text-muted-foreground leading-snug">{a.examples}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Webset Recipe */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>Webset Recipe: {RECIPE_EXAMPLE.role}</SectionLabel>
      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1">Query</div>
          <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2">
            {RECIPE_EXAMPLE.query}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1">Criteria</div>
          <div className="space-y-0">
            {RECIPE_EXAMPLE.criteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <div className="w-0.5 h-3.5 rounded-full bg-primary shrink-0 mt-0.5" />
                <span className="text-xs text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1">Enrichments</div>
          <div className="space-y-0">
            {RECIPE_EXAMPLE.enrichments.map((e, i) => (
              <div key={i} className="text-[11px] text-muted-foreground py-1">
                {e}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10.5px] text-muted-foreground mt-3 italic">
        5 more role recipes in the{" "}
        <button
          className="text-primary underline underline-offset-2 hover:no-underline"
          onClick={() => window.open("https://sourcekit-docs.netlify.app/#eea", "_blank")}
        >
          full docs
        </button>.
      </p>
    </div>

    {/* Pipeline Stages */}
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>Pipeline Stages</SectionLabel>
      <div className="flex items-center gap-2 flex-wrap">
        {PIPELINE_STAGES.map((stage, i) => (
          <span key={stage.label} className="flex items-center gap-2">
            <span className="text-xs font-display font-semibold text-primary border border-primary/20 rounded-full px-3 py-1">
              {stage.label}
            </span>
            {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Drag-and-drop between stages. Bulk actions for compare, summarize, and outreach. Export to CSV anytime.
      </p>
    </div>

    {/* Stack */}
    <div className="flex flex-wrap gap-2">
      {STACK.map((tech) => (
        <span key={tech} className="text-[10px] font-display font-medium text-muted-foreground border border-border rounded-full px-3 py-1">
          {tech}
        </span>
      ))}
    </div>

    {/* CTA */}
    <div className="text-center py-4">
      <Button
        variant="default"
        size="lg"
        className="gap-2"
        onClick={() => window.open("https://sourcekit-docs.netlify.app", "_blank")}
      >
        <span className="font-display text-sm font-semibold">Read the Full Docs</span>
        <ExternalLink className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        Websets deep dive, EEA framework, architecture, and more.
      </p>
    </div>
  </div>
);

/* ─── Main GuideTab ─── */
const GuideTab = () => {
  const [view, setView] = useState<"tldr" | "full">("tldr");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-display font-bold text-foreground">
            {view === "tldr" ? "Quick Reference" : "Full Guide"}
          </h1>
          <Badge variant="outline" className="text-[10px] font-display">v2.0</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setView(view === "tldr" ? "full" : "tldr")}
            className="text-xs font-display font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {view === "tldr" ? "Full Guide" : "Quick Reference"}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open("https://sourcekit-docs.netlify.app", "_blank")}
          >
            <span className="font-display text-xs">Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "tldr" ? <QuickReferenceView /> : <FullGuideView />}
    </div>
  );
};

export default GuideTab;
