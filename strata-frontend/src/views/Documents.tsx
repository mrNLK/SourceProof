import { useEffect, useState } from "react";
import { getCurrentDocument, getDocumentHistory, getDocumentHtmlUrl } from "../lib/api";

const CLIENTS = ["demo_iou", "demo_developer"];

export default function Documents() {
  const [clientId, setClientId] = useState(CLIENTS[0]);
  const [current, setCurrent] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  useEffect(() => {
    getCurrentDocument(clientId).then(setCurrent).catch(() => setCurrent(null));
    getDocumentHistory(clientId).then(setHistory).catch(() => setHistory([]));
  }, [clientId]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      <div className="mb-6">
        <label className="text-muted text-xs uppercase tracking-wider mr-3">Client</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="bg-panel border border-border text-text rounded px-3 py-1.5 text-sm"
        >
          {CLIENTS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {current && (
        <div className="bg-panel border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Current Published Version
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm">Version {current.version_number}</span>
            <span className="text-muted text-xs">
              Published {current.created_at ? new Date(current.created_at).toLocaleDateString() : "—"}
            </span>
            <button
              onClick={() => setModalUrl(getDocumentHtmlUrl(current.id))}
              className="px-3 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition"
            >
              View
            </button>
          </div>
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider p-4 border-b border-border">
          Version History
        </h2>
        {history.length === 0 ? (
          <div className="p-6 text-center text-muted text-sm">No versions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="text-left p-3">Version</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Docket</th>
                <th className="text-left p-3">What Changed</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((v: any) => (
                <tr
                  key={v.id}
                  className="border-b border-border/50 hover:bg-border/20 cursor-pointer"
                  onClick={() => setModalUrl(getDocumentHtmlUrl(v.id))}
                >
                  <td className="p-3 mono">{v.version_number}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      v.status === "published" ? "bg-accent/20 text-accent" :
                      v.status === "pending_review" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="p-3 mono text-xs">{v.docket_number || "—"}</td>
                  <td className="p-3 text-xs max-w-sm truncate">{v.what_changed || "—"}</td>
                  <td className="p-3 text-xs text-muted">
                    {v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for viewing document HTML */}
      {modalUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-panel border border-border rounded-lg w-4/5 h-4/5 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Document Preview</h3>
              <button
                onClick={() => setModalUrl(null)}
                className="text-muted hover:text-text text-lg"
              >
                X
              </button>
            </div>
            <iframe src={modalUrl} className="flex-1" title="Document Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
