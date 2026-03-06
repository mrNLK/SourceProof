const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// Admin
export const getMonitors = () => request("/admin/monitors");
export const initMonitors = () => request("/admin/monitors/init", { method: "POST" });
export const deleteMonitor = (id: string) =>
  request(`/admin/monitors/${id}`, { method: "DELETE" });
export const getCorpus = () => request("/admin/corpus");
export const initCorpus = () => request("/admin/corpus/init", { method: "POST" });
export const syncCorpus = () => request("/admin/corpus/sync", { method: "POST" });
export const getAssets = (clientId?: string) =>
  request(`/admin/assets${clientId ? `?client_id=${clientId}` : ""}`);
export const triggerPipeline = (sourceUrl: string) =>
  request("/admin/test/trigger", {
    method: "POST",
    body: JSON.stringify({ source_url: sourceUrl, monitor_id: "manual_trigger" }),
  });

// Reviews
export const getReviewQueue = () => request("/reviews/queue");
export const getReviewDetail = (id: string) => request(`/reviews/${id}`);
export const approveReview = (id: string) =>
  request(`/reviews/${id}/approve`, { method: "POST" });
export const rejectReview = (id: string, notes: string) =>
  request(`/reviews/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
export const requestRevision = (id: string, notes: string) =>
  request(`/reviews/${id}/request-revision`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });

// Documents
export const getCurrentDocument = (clientId: string) =>
  request(`/documents/${clientId}/current`);
export const getDocumentHistory = (clientId: string) =>
  request(`/documents/${clientId}/history`);
export const getAuditTrail = (dvId: string) =>
  request(`/documents/${dvId}/audit-trail`);
export const getDocumentHtmlUrl = (dvId: string) =>
  `${API_BASE}/documents/${dvId}/html`;
