import { useEffect, useState } from "react";
import { getMonitors, initMonitors } from "../lib/api";
import { toast } from "../components/Toast";
import { useClient } from "../lib/ClientContext";

export default function Monitors() {
  const { activeClient } = useClient();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  const load = () => {
    if (!activeClient) return;
    setLoading(true);
    getMonitors()
      .then(setMonitors)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [activeClient?.id]);

  const handleInit = async () => {
    setInitializing(true);
    try {
      const res = await initMonitors();
      toast(`Created ${res.monitors.length} monitors`);
      load();
    } catch {
      toast("Initialization failed");
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Monitors</h1>
        <button
          onClick={handleInit}
          disabled={initializing}
          className="px-4 py-2 bg-accent/10 text-accent text-sm rounded hover:bg-accent/20 transition disabled:opacity-50"
        >
          {initializing ? "Initializing..." : "Initialize FERC Monitors"}
        </button>
      </div>

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted">Loading...</div>
        ) : monitors.length === 0 ? (
          <div className="p-6 text-center text-muted">No monitors configured</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Query</th>
                <th className="text-left p-3">Frequency</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m: any) => (
                <tr key={m.monitor_id || m.id} className="border-b border-border/50 hover:bg-border/20">
                  <td className="p-3 font-medium text-sm">{m.name}</td>
                  <td className="p-3 text-xs text-muted max-w-md truncate">{m.query}</td>
                  <td className="p-3 mono text-xs">{m.frequency}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      m.status === "active"
                        ? "bg-accent/20 text-accent"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {m.status}
                    </span>
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
