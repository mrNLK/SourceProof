import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReviewQueue } from "../lib/api";
import { useClient } from "../lib/ClientContext";

export default function ReviewQueue() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { activeClient } = useClient();

  useEffect(() => {
    if (!activeClient) return;
    setLoading(true);
    getReviewQueue()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [activeClient?.id]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Pending Reviews</h1>
      {activeClient && (
        <p className="text-muted text-sm mb-6">{activeClient.name}</p>
      )}

      {loading ? (
        <div className="text-muted">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-panel border border-border rounded-lg p-8 text-center text-muted">
          No pending reviews
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="text-left p-3">Filing Type</th>
                <th className="text-left p-3">Docket #</th>
                <th className="text-left p-3">Summary</th>
                <th className="text-left p-3">Impacted Assets</th>
                <th className="text-left p-3">Queued At</th>
                <th className="text-left p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-border/20">
                  <td className="p-3 mono text-xs">{item.filing_type || "—"}</td>
                  <td className="p-3 mono text-xs">{item.docket_number || "—"}</td>
                  <td className="p-3 text-xs max-w-xs truncate">
                    {(item.plain_english_summary || "").slice(0, 100)}
                  </td>
                  <td className="p-3 text-center">{item.impacted_asset_count}</td>
                  <td className="p-3 text-xs text-muted">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => navigate(`/reviews/${item.id}`)}
                      className="px-3 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
