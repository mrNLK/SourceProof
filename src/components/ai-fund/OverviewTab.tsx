import { Activity, Briefcase, Users, Home, Zap, FileCheck } from "lucide-react";
import type { AiFundWorkspace } from "@/types/ai-fund";

interface Props {
  workspace: AiFundWorkspace;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg bg-primary/10 ${accent || "text-primary"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function OverviewTab({ workspace }: Props) {
  const { stats, loading } = workspace;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading AI Fund data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Fund Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Venture creation pipeline at a glance
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Concepts" value={stats.totalConcepts} icon={Briefcase} />
        <StatCard label="Active Concepts" value={stats.activeConcepts} icon={Zap} />
        <StatCard label="Total People" value={stats.totalPeople} icon={Users} />
        <StatCard label="Active Pipeline" value={stats.activePipeline} icon={Activity} />
        <StatCard label="Active Residencies" value={stats.activeResidencies} icon={Home} />
        <StatCard label="Pending Decisions" value={stats.pendingDecisions} icon={FileCheck} />
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center bg-card border border-border rounded-lg">
            No activity yet. Start by adding a concept or person.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.recentActivity.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg"
              >
                <Activity className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-medium">{event.action}</span>{" "}
                    <span className="text-muted-foreground">on {event.entityType}</span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(event.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
