import { useEffect, useState } from "react";
import { getCorpus, syncCorpus, triggerPipeline } from "../lib/api";
import { toast } from "../components/Toast";

export default function Corpus() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [triggerUrl, setTriggerUrl] = useState("");
  const [triggering, setTriggering] = useState(false);

  const load = () => {
    setLoading(true);
    getCorpus()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncCorpus();
      toast(`Synced ${res.synced} items`);
      load();
    } catch {
      toast("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleTrigger = async () => {
    if (!triggerUrl.trim()) return;
    setTriggering(true);
    try {
      await triggerPipeline(triggerUrl.trim());
      toast("Pipeline triggered — check Review Queue in a few minutes");
      setTriggerUrl("");
    } catch {
      toast("Trigger failed");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Corpus</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-accent/10 text-accent text-sm rounded hover:bg-accent/20 transition disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Corpus"}
        </button>
      </div>

      {/* Test trigger */}
      <div className="bg-panel border border-border rounded-lg p-5 mb-6">
        <h3 className="text-xs text-muted uppercase tracking-wider mb-2">
          Demo: Paste a FERC order URL to trigger the full pipeline manually
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={triggerUrl}
            onChange={(e) => setTriggerUrl(e.target.value)}
            placeholder="https://elibrary.ferc.gov/..."
            className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm text-text placeholder-muted"
          />
          <button
            onClick={handleTrigger}
            disabled={triggering || !triggerUrl.trim()}
            className="px-4 py-2 bg-accent text-bg text-sm rounded font-medium hover:bg-accent/90 transition disabled:opacity-50"
          >
            {triggering ? "Triggering..." : "Trigger Pipeline"}
          </button>
        </div>
      </div>

      {/* Corpus table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-muted">No corpus items</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="text-left p-3">Filing Type</th>
                <th className="text-left p-3">Docket #</th>
                <th className="text-left p-3">Jurisdiction</th>
                <th className="text-left p-3">Effective Date</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-border/20">
                  <td className="p-3 mono text-xs">{item.filing_type || "—"}</td>
                  <td className="p-3 mono text-xs">{item.docket_number || "—"}</td>
                  <td className="p-3 text-xs">{item.jurisdiction}</td>
                  <td className="p-3 text-xs">{item.effective_date || "—"}</td>
                  <td className="p-3">
                    {item.source_url ? (
                      <a href={item.source_url} target="_blank" className="text-accent hover:underline text-xs">
                        Link
                      </a>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
