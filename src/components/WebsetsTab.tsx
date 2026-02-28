import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radar, Plus, Loader2, Trash2, RefreshCw, ExternalLink,
  Users, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { createWebset, listWebsets, getWebset, getWebsetItems, deleteWebset, createWebsetMonitor } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

// ── Create Webset Form ──────────────────────────────────────────────────

function CreateWebsetForm({ onCreated }: { onCreated: () => void }) {
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(25);
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [enableMonitor, setEnableMonitor] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!query.trim()) {
      toast({ title: "Enter a search query", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const activeCriteria = criteria.filter(c => c.trim());
      const result = await createWebset(query.trim(), count, activeCriteria.length > 0 ? activeCriteria : undefined);

      if (enableMonitor && result?.id) {
        try {
          await createWebsetMonitor(result.id, "0 9 * * 1");
          toast({ title: "Talent Scout created with weekly monitoring" });
        } catch {
          toast({ title: "Talent Scout created", description: "Monitor setup failed — you can add it later." });
        }
      } else {
        toast({ title: "Talent Scout search launched" });
      }

      setQuery("");
      setCriteria([""]);
      onCreated();
    } catch (err: any) {
      toast({ title: "Failed to create Talent Scout", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Radar className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm font-semibold text-foreground">New Talent Scout</h2>
      </div>

      <div>
        <label className="text-xs font-display text-muted-foreground mb-1 block">Describe who you're looking for</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Rust engineers who contribute to distributed systems open source projects"
          rows={3}
          className="w-full bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground p-3 outline-none border border-border focus:border-primary/40 transition-colors font-body resize-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs font-display text-muted-foreground mb-1 block">Target count</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-secondary text-foreground border border-border rounded-lg px-3 py-2 outline-none text-xs font-display cursor-pointer"
          >
            <option value={10}>10 candidates</option>
            <option value={25}>25 candidates</option>
            <option value={50}>50 candidates</option>
            <option value={100}>100 candidates</option>
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer mt-4">
          <input
            type="checkbox"
            checked={enableMonitor}
            onChange={(e) => setEnableMonitor(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-xs font-display text-muted-foreground">Auto-refresh weekly</span>
        </label>
      </div>

      <div>
        <label className="text-xs font-display text-muted-foreground mb-1 block">Verification criteria (optional)</label>
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-2 mb-1.5">
            <input
              type="text"
              value={c}
              onChange={(e) => {
                const next = [...criteria];
                next[i] = e.target.value;
                setCriteria(next);
              }}
              placeholder="e.g., Has 3+ years of professional experience"
              className="flex-1 bg-secondary rounded-lg text-xs text-foreground placeholder:text-muted-foreground px-3 py-2 outline-none border border-border focus:border-primary/40 transition-colors font-body"
            />
            {criteria.length > 1 && (
              <button onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {criteria.length < 5 && (
          <button onClick={() => setCriteria([...criteria, ""])} className="text-xs font-display text-primary hover:underline mt-1">
            + Add criterion
          </button>
        )}
      </div>

      <button
        onClick={handleCreate}
        disabled={creating || !query.trim()}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-display text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching...</> : <><Radar className="w-3.5 h-3.5" /> Launch Talent Scout</>}
      </button>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    running: { icon: Loader2, color: "text-info border-info/30 bg-info/10", label: "Searching..." },
    pending: { icon: Clock, color: "text-warning border-warning/30 bg-warning/10", label: "Pending" },
    completed: { icon: CheckCircle2, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", label: "Complete" },
    idle: { icon: CheckCircle2, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", label: "Idle" },
    created: { icon: Clock, color: "text-muted-foreground border-border bg-secondary", label: "Created" },
  };
  const c = config[status] || { icon: AlertCircle, color: "text-muted-foreground border-border bg-secondary", label: status };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-0.5 rounded-full border ${c.color}`}>
      <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}

// ── Webset Card ──────────────────────────────────────────────────────────

function WebsetCard({ webset, onRefresh }: { webset: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteWebset(webset.id),
    onSuccess: () => {
      toast({ title: "Talent Scout deleted" });
      queryClient.invalidateQueries({ queryKey: ["websets"] });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const handleExpand = async () => {
    setExpanded(!expanded);
    if (!expanded && !items) {
      setLoadingItems(true);
      try {
        const data = await getWebsetItems(webset.id);
        setItems(data.data || []);
      } catch (err) {
        console.error("Failed to load items:", err);
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    }
  };

  const searchQuery = webset.searches?.[0]?.query || webset.externalId || "Unnamed search";
  const itemCount = webset.searches?.[0]?.progress?.found ?? "?";
  const createdAt = new Date(webset.createdAt).toLocaleDateString();

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm font-semibold text-foreground truncate">{searchQuery}</h3>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusBadge status={webset.status} />
              <span className="text-[11px] font-display text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> {itemCount} found
              </span>
              <span className="text-[11px] font-display text-muted-foreground">
                {createdAt}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onRefresh} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Refresh status">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" title="Delete">
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleExpand} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : items && items.length > 0 ? (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {items.map((item: any) => {
                const person = item.properties?.person;
                const enrichments = item.enrichments || [];
                const githubEnrichment = enrichments.find((e: any) => e.result?.[0]?.includes("github.com"));
                const linkedinEnrichment = enrichments.find((e: any) => e.result?.[0]?.includes("linkedin.com"));

                return (
                  <div key={item.id} className="px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      {person?.pictureUrl && (
                        <img src={person.pictureUrl} alt="" className="w-8 h-8 rounded-full border border-border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-xs font-semibold text-foreground truncate">
                          {person?.name || item.properties?.description?.slice(0, 40) || "Unknown"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {person?.position && `${person.position}`}
                          {person?.company?.name && ` at ${person.company.name}`}
                          {person?.location && ` · ${person.location}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {githubEnrichment?.result?.[0] && (
                          <a href={githubEnrichment.result[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] font-display text-primary hover:underline flex items-center gap-0.5">
                            GitHub <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {linkedinEnrichment?.result?.[0] && (
                          <a href={linkedinEnrichment.result[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] font-display text-blue-400 hover:underline flex items-center gap-0.5">
                            LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    {item.evaluations?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.evaluations.map((ev: any, i: number) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-display font-semibold ${
                              ev.satisfied === "yes" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-secondary text-muted-foreground border border-border"
                            }`}>
                              {ev.satisfied === "yes" ? "Match" : "Miss"}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">{ev.criterion}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground font-display">
                {webset.status === "running" ? "Results are still coming in..." : "No candidates found yet."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────

const WebsetsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: websets, isLoading } = useQuery({
    queryKey: ["websets"],
    queryFn: async () => {
      const data = await listWebsets();
      return data.data || [];
    },
    refetchInterval: 30_000, // Poll every 30s for status updates
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["websets"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">Talent Scout</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-display">
            Powered by Exa Websets — AI discovers, verifies, and enriches candidates matching your criteria
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-display text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> New Scout
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <CreateWebsetForm onCreated={() => { setShowForm(false); handleRefresh(); }} />
        </div>
      )}

      {(!websets || websets.length === 0) && !showForm ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-muted-foreground/20">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <Radar className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-display text-sm font-semibold text-foreground mb-1">No talent scouts yet</h2>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            Launch a Talent Scout to continuously discover new candidates matching your criteria.
            Exa's AI agents search the web, verify each candidate, and enrich their profiles automatically.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-display text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Create Your First Scout
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(websets || []).map((ws: any) => (
            <WebsetCard key={ws.id} webset={ws} onRefresh={handleRefresh} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WebsetsTab;
