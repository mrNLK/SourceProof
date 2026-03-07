import { useEffect, useState } from "react";
import Card from "../components/Card";
import { getMonitors, getReviewQueue, getCorpus } from "../lib/api";
import { useClient } from "../lib/ClientContext";

export default function Dashboard() {
  const { activeClient } = useClient();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [corpus, setCorpus] = useState<any[]>([]);

  useEffect(() => {
    if (!activeClient) return;
    getMonitors().then(setMonitors).catch(() => {});
    getReviewQueue().then(setReviews).catch(() => {});
    getCorpus().then(setCorpus).catch(() => {});
  }, [activeClient?.id]);

  const activeMonitors = monitors.filter((m: any) => m.status !== "deleted").length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-accent">STRATA</span>
        <span className="text-muted ml-2 text-lg font-normal">/ Regulatory Intelligence</span>
      </h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card title="Active Monitors" value={activeMonitors} />
        <Card title="Pending Reviews" value={reviews.length} />
        <Card title="Corpus Items" value={corpus.length} />
        <Card title="Published Documents" value="—" />
      </div>

      <div className="bg-panel border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Recent Activity
        </h2>
        <div className="text-muted text-sm">
          Activity feed will display here via Supabase realtime subscription.
        </div>
      </div>
    </div>
  );
}
