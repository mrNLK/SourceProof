import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getReviewDetail,
  approveReview,
  rejectReview,
  requestRevision,
  getDocumentHtmlUrl,
} from "../lib/api";
import { toast } from "../components/Toast";

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getReviewDetail(id)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-muted">Loading...</div>;
  if (!data) return <div className="text-muted">Review not found.</div>;

  const { review, document_version, regulatory_item, extraction_data, impacted_assets, audit_trail } = data;
  const dvId = document_version?.id;

  const handleApprove = async () => {
    await approveReview(id!);
    toast("Document published successfully");
    navigate("/reviews");
  };

  const handleReject = async () => {
    const notes = prompt("Rejection notes:");
    if (notes === null) return;
    await rejectReview(id!, notes);
    toast("Review rejected");
    navigate("/reviews");
  };

  const handleRevision = async () => {
    const notes = prompt("Revision notes:");
    if (notes === null) return;
    await requestRevision(id!, notes);
    toast("Revision requested");
  };

  const impactBadge = (level: string) => {
    const colors: Record<string, string> = {
      HIGH: "bg-red-500/20 text-red-400",
      MEDIUM: "bg-yellow-500/20 text-yellow-400",
      LOW: "bg-gray-500/20 text-gray-400",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[level] || colors.LOW}`}>
        {level}
      </span>
    );
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-4rem)]">
      {/* Left panel */}
      <div className="w-2/5 overflow-auto space-y-4">
        <h1 className="text-xl font-bold mb-4">Review Detail</h1>

        <div className="bg-panel border border-border rounded-lg p-4">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-2">Filing Metadata</h3>
          <div className="space-y-1 text-sm">
            <div><span className="text-muted">Docket:</span> <span className="mono">{regulatory_item?.docket_number || "—"}</span></div>
            <div><span className="text-muted">Type:</span> {regulatory_item?.filing_type || "—"}</div>
            <div>
              <span className="text-muted">Source:</span>{" "}
              {regulatory_item?.source_url ? (
                <a href={regulatory_item.source_url} target="_blank" className="text-accent hover:underline">Link</a>
              ) : "—"}
            </div>
            <div><span className="text-muted">Effective:</span> {extraction_data?.effective_date || "—"}</div>
          </div>
        </div>

        {extraction_data && (
          <div className="bg-panel border border-border rounded-lg p-4">
            <h3 className="text-xs text-muted uppercase tracking-wider mb-2">Extraction Summary</h3>
            <div className="text-sm space-y-2">
              <div>
                <span className="text-muted text-xs">What changed:</span>
                <p className="mt-1">{extraction_data.what_changed}</p>
              </div>
              <div>
                <span className="text-muted text-xs">Plain English:</span>
                <p className="mt-1">{extraction_data.plain_english_summary}</p>
              </div>
            </div>
          </div>
        )}

        {impacted_assets && impacted_assets.length > 0 && (
          <div className="bg-panel border border-border rounded-lg p-4">
            <h3 className="text-xs text-muted uppercase tracking-wider mb-2">Impacted Assets</h3>
            <div className="space-y-2">
              {impacted_assets.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{a.asset_name}</span>
                  {impactBadge(a.impact_level)}
                </div>
              ))}
            </div>
          </div>
        )}

        {audit_trail && audit_trail.length > 0 && (
          <div className="bg-panel border border-border rounded-lg p-4">
            <h3 className="text-xs text-muted uppercase tracking-wider mb-2">Pipeline Trail</h3>
            <div className="space-y-1">
              {audit_trail.map((e: any, i: number) => (
                <div key={i} className="text-xs flex gap-2">
                  <span className="text-muted w-36 shrink-0">
                    {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
                  </span>
                  <span className="mono">{e.event_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 bg-panel border border-border rounded-lg overflow-hidden">
          {dvId ? (
            <iframe
              src={getDocumentHtmlUrl(dvId)}
              className="w-full h-full"
              title="Document Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted">
              No document content available
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleApprove}
            className="px-4 py-2 bg-accent text-bg rounded font-medium text-sm hover:bg-accent/90 transition"
          >
            Approve & Publish
          </button>
          <button
            onClick={handleReject}
            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/20 transition"
          >
            Reject
          </button>
          <button
            onClick={handleRevision}
            className="px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded text-sm hover:bg-yellow-500/20 transition"
          >
            Request Revision
          </button>
        </div>
      </div>
    </div>
  );
}
