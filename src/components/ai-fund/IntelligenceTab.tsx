import { useState, useEffect } from "react";
import { Zap, Clock, CheckCircle, XCircle, Loader2, Building2, MapPin, Users, TrendingUp, ExternalLink } from "lucide-react";
import type {
  AiFundIntelligenceRun,
  IntelligenceProvider,
  IntelligenceRunStatus,
  AiFundHarmonicIntelligenceSummary,
  AiFundHarmonicCompanySummary,
} from "@/types/ai-fund";
import { fetchIntelligenceRuns, createIntelligenceRun, updateIntelligenceRun } from "@/lib/ai-fund";
import { runHarmonicIntelligence } from "@/lib/harmonic";

interface Props {}

const STATUS_CONFIG: Record<IntelligenceRunStatus, { icon: React.ElementType; color: string }> = {
  pending: { icon: Clock, color: "text-yellow-400" },
  running: { icon: Loader2, color: "text-blue-400" },
  completed: { icon: CheckCircle, color: "text-emerald-400" },
  failed: { icon: XCircle, color: "text-destructive" },
};

const PROVIDER_LABELS: Record<IntelligenceProvider, string> = {
  exa: "Exa Websets",
  parallel: "Parallel Deep Research",
  github: "GitHub API",
  manual: "Manual Import",
  harmonic: "Harmonic Discovery",
};

function formatFunding(amount: number | null): string {
  if (!amount) return "—";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function HarmonicCompanyCard({ company }: { company: AiFundHarmonicCompanySummary }) {
  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-medium text-foreground truncate">{company.name}</h3>
          </div>
          {company.domain && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">{company.domain}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {company.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {company.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {company.location}
          </span>
        )}
        {company.headcount && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {company.headcount.toLocaleString()} employees
          </span>
        )}
        {company.fundingTotal && (
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {formatFunding(company.fundingTotal)} raised
            {company.fundingStage && ` (${company.fundingStage})`}
          </span>
        )}
      </div>

      {company.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {company.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {company.tags.length > 5 && (
            <span className="text-[10px] text-muted-foreground">
              +{company.tags.length - 5} more
            </span>
          )}
        </div>
      )}

      {company.founders.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Founders: </span>
          {company.founders.map((f) => f.name).join(", ")}
        </div>
      )}
    </div>
  );
}

export default function IntelligenceTab({}: Props) {
  const [runs, setRuns] = useState<AiFundIntelligenceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Form
  const [formProvider, setFormProvider] = useState<IntelligenceProvider>("harmonic");
  const [formQuery, setFormQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetchIntelligenceRuns();
        setRuns(r);
      } catch (err) {
        console.error("Failed to load intelligence runs:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async () => {
    if (!formQuery.trim()) return;
    setSubmitting(true);

    try {
      const run = await createIntelligenceRun({
        provider: formProvider,
        queryParams: { query: formQuery.trim() },
      });
      setRuns((prev) => [run, ...prev]);
      setFormQuery("");
      setShowForm(false);

      // If Harmonic, execute the run immediately
      if (formProvider === "harmonic") {
        setExpandedRunId(run.id);

        // Update local state to running
        setRuns((prev) =>
          prev.map((r) => (r.id === run.id ? { ...r, status: "running" as const } : r))
        );

        try {
          const result = await runHarmonicIntelligence({
            runId: run.id,
            query: formQuery.trim(),
          });

          // Update local state with results
          setRuns((prev) =>
            prev.map((r) =>
              r.id === run.id
                ? {
                    ...r,
                    status: result.status as "completed" | "failed",
                    resultsCount: result.resultsCount ?? 0,
                    resultsSummary: result.resultsSummary ?? null,
                    completedAt: new Date().toISOString(),
                  }
                : r
            )
          );
        } catch (err) {
          console.error("Harmonic intelligence run failed:", err);
          setRuns((prev) =>
            prev.map((r) =>
              r.id === run.id
                ? { ...r, status: "failed" as const }
                : r
            )
          );
        }
      }
    } catch (err) {
      console.error("Failed to create run:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading intelligence runs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            External sourcing runs via Harmonic, Exa, Parallel, and GitHub
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Zap className="w-4 h-4" />
          New Run
        </button>
      </div>

      {/* New run form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value as IntelligenceProvider)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="harmonic">Harmonic Discovery</option>
              <option value="exa">Exa Websets</option>
              <option value="parallel">Parallel Deep Research</option>
              <option value="github">GitHub API</option>
              <option value="manual">Manual Import</option>
            </select>
            <input
              type="text"
              placeholder={
                formProvider === "harmonic"
                  ? "e.g. AI startups in healthcare with Series A funding"
                  : "Search query *"
              }
              value={formQuery}
              onChange={(e) => setFormQuery(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && formQuery.trim() && !submitting) {
                  handleCreate();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!formQuery.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Running..." : "Start Run"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Runs list */}
      {runs.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            No intelligence runs yet. Start one above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const config = STATUS_CONFIG[run.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedRunId === run.id;
            const isHarmonicCompleted =
              run.provider === "harmonic" &&
              run.status === "completed" &&
              run.resultsSummary;
            const harmonicSummary = isHarmonicCompleted
              ? (run.resultsSummary as unknown as AiFundHarmonicIntelligenceSummary)
              : null;

            return (
              <div key={run.id} className="space-y-0">
                <button
                  onClick={() =>
                    setExpandedRunId(isExpanded ? null : run.id)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:bg-card/80 transition-colors text-left"
                >
                  <StatusIcon
                    className={`w-4 h-4 shrink-0 ${config.color} ${
                      run.status === "running" ? "animate-spin" : ""
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {PROVIDER_LABELS[run.provider]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {run.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {typeof run.queryParams === "object" &&
                      run.queryParams !== null
                        ? (run.queryParams as { query?: string }).query ||
                          JSON.stringify(run.queryParams)
                        : "No query"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      {run.resultsCount}
                    </p>
                    <p className="text-xs text-muted-foreground">results</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </span>
                </button>

                {/* Expanded Harmonic results */}
                {isExpanded && harmonicSummary && harmonicSummary.companies && (
                  <div className="ml-4 mr-4 mt-1 mb-2 space-y-2">
                    <p className="text-xs text-muted-foreground px-1">
                      {harmonicSummary.companies.length} companies found for &ldquo;{harmonicSummary.query}&rdquo;
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {harmonicSummary.companies.map((company) => (
                        <HarmonicCompanyCard
                          key={company.harmonicCompanyId}
                          company={company}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded failed run */}
                {isExpanded && run.status === "failed" && run.resultsSummary && (
                  <div className="ml-4 mr-4 mt-1 mb-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-xs text-destructive">
                      {(run.resultsSummary as { error?: string }).error || "Unknown error"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
