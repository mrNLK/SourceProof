import { ExternalLink } from "lucide-react";
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

const WALKTHROUGH = [
  {
    step: "Enter a role",
    caption: "Type a role + company, paste a JD, or drop a job URL. Claude builds your strategy.",
    img: "/screenshots/step-1-input.png",
  },
  {
    step: "Edit the repo list",
    caption: "AI suggestions are a starting point. Your edits are the single biggest quality lever.",
    img: "/screenshots/step-2-repos.png",
  },
  {
    step: "Run the search",
    caption: "Multi-API search across repos. Results ranked by commits, stars, recency.",
    img: "/screenshots/step-3-results.png",
  },
  {
    step: "Review and pipeline",
    caption: "Enrich top matches, find LinkedIn, add to pipeline. Drag between stages, export CSV.",
    img: "/screenshots/step-4-pipeline.png",
  },
];

const RECIPE = {
  role: "Senior ML Engineer",
  query: "ML engineers who publish research and contribute to open source ML projects",
  criteria: [
    "Published at NeurIPS, ICML, or ICLR in last 3 years",
    "Maintainer or top-20 contributor to 1K+ star ML repo",
    "Industry experience, not purely academic",
  ],
  enrichments: [
    { label: "Publications with venues", format: "text" },
    { label: "GitHub repos + star counts", format: "text" },
    { label: "Contact email", format: "email" },
    { label: "EEA strength", format: "options" },
  ],
};

const TIPS = [
  { title: "Be specific", desc: '"ML Infra, training pipelines" beats "ML Engineer"' },
  { title: "Edit repos", desc: "Biggest quality lever. Remove noise, add niche targets." },
  { title: "Hidden gems", desc: "High commits + low followers = under-recruited." },
  { title: "Layer enrichments", desc: "Contact info first. Publications only for top matches." },
];

const STACK = ["Claude AI", "Exa Search", "Exa Websets", "Parallel.ai", "GitHub API", "React + TS", "Supabase", "Vercel"];

/* ─── Components ─── */

const SteppedBar = ({ steps }: { steps: { label: string; desc: string }[] }) => (
  <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
    {steps.map((step, i) => (
      <div
        key={step.label}
        className={`flex-1 text-center py-2.5 px-2 ${
          i < steps.length - 1 ? "border-r border-border" : ""
        }`}
      >
        <div className="text-[11px] font-display font-bold text-foreground">{step.label}</div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{step.desc}</div>
      </div>
    ))}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-widest mb-2">
    {children}
  </div>
);

const ScreenshotStep = ({ step, caption, img }: { step: string; caption: string; img: string }) => (
  <div className="space-y-1.5">
    <div className="text-[11px] font-display font-bold text-foreground">{step}</div>
    <div className="rounded-lg border border-border overflow-hidden">
      <img
        src={img}
        alt={step}
        className="w-full block"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const ph = el.nextElementSibling;
          if (ph) (ph as HTMLElement).style.display = "flex";
        }}
      />
      <div
        className="hidden items-center justify-center bg-muted/10 text-muted-foreground/30 text-[10px] font-display"
        style={{ aspectRatio: "21/9" }}
      >
        screenshot
      </div>
    </div>
    <p className="text-[11px] text-muted-foreground leading-snug">{caption}</p>
  </div>
);

/* ─── Main ─── */
const GuideTab = () => (
  <div className="max-w-3xl mx-auto space-y-5">
    {/* Header */}
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-display font-bold text-foreground">Guide</h1>
        <Badge variant="outline" className="text-[10px] font-display">v2.0</Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => window.open("https://sourceproof-docs.netlify.app", "_blank")}
      >
        <span className="font-display text-xs">Full Docs</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    </div>

    {/* Workflow */}
    <SteppedBar steps={WORKFLOW} />

    {/* Walkthrough */}
    <div>
      <SectionLabel>Walkthrough</SectionLabel>
      <div className="space-y-4">
        {WALKTHROUGH.map((w) => (
          <ScreenshotStep key={w.step} {...w} />
        ))}
      </div>
    </div>

    {/* Example Recipe */}
    <div>
      <SectionLabel>Example Webset Recipe</SectionLabel>
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
        <div className="text-[11px] font-display font-bold text-foreground">{RECIPE.role}</div>
        <div className="text-[10.5px] text-muted-foreground bg-muted/20 rounded px-2.5 py-1.5 leading-snug">
          {RECIPE.query}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <div>
            <div className="text-[9px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-1">Criteria</div>
            {RECIPE.criteria.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 py-1">
                <div className="w-0.5 h-3 rounded-full bg-primary shrink-0 mt-0.5" />
                <span className="text-[10.5px] text-muted-foreground leading-snug">{c}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[9px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-1">Enrichments</div>
            {RECIPE.enrichments.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 py-1">
                <span className="text-[10.5px] text-muted-foreground">{e.label}</span>
                <span className="text-[8px] font-display text-muted-foreground/60 border border-border rounded px-1 py-0.5">{e.format}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Tips */}
    <div>
      <SectionLabel>Tips</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {TIPS.map((tip) => (
          <div key={tip.title} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
            <div className="w-0.5 self-stretch rounded-full bg-primary shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-foreground">{tip.title}.</span>{" "}
              <span className="text-[10.5px] text-muted-foreground">{tip.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Stack */}
    <div className="flex flex-wrap gap-1.5">
      {STACK.map((tech) => (
        <span key={tech} className="text-[9px] font-display font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">
          {tech}
        </span>
      ))}
    </div>

    {/* Docs link */}
    <button
      onClick={() => window.open("https://sourceproof-docs.netlify.app", "_blank")}
      className="text-[10px] font-display font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
    >
      EEA framework, Websets deep dive, architecture
      <ExternalLink className="w-3 h-3" />
    </button>
  </div>
);

export default GuideTab;
