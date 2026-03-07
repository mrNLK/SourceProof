const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Auth context — set once at app init, threaded into every request.
let _userEmail = import.meta.env.VITE_USER_EMAIL || "admin@strata.demo";
let _clientId = ""; // UUID, set dynamically after loading clients

export function setAuthContext(email: string, clientId: string) {
  _userEmail = email;
  _clientId = clientId;
}

export function getActiveClientId() {
  return _clientId;
}

export function getActiveUserEmail() {
  return _userEmail;
}

async function request(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (_userEmail) headers["X-User-Email"] = _userEmail;
  if (_clientId) headers["X-Client-Id"] = _clientId;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// Clients
// /clients/mine only needs X-User-Email, not X-Client-Id (bootstrap-safe)
export const getMyClients = () => request("/clients/mine");
export const getCurrentClient = () => request("/clients/current");
export const getMe = () => request("/clients/users/me");

// Admin
export const getMonitors = () => request("/admin/monitors");
export const initMonitors = () => request("/admin/monitors/init", { method: "POST" });
export const deleteMonitor = (id: string) =>
  request(`/admin/monitors/${id}`, { method: "DELETE" });
export const getCorpus = () => request("/admin/corpus");
export const initCorpus = () => request("/admin/corpus/init", { method: "POST" });
export const syncCorpus = () => request("/admin/corpus/sync", { method: "POST" });
export const getAssets = () => request("/admin/assets");
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

// Documents — no longer take clientId param; scoped by active client header
export const getCurrentDocument = () => request("/documents/current");
export const getDocumentHistory = () => request("/documents/history");
export const getAuditTrail = (dvId: string) =>
  request(`/documents/${dvId}/audit-trail`);
export const getDocumentHtmlUrl = (dvId: string) =>
  `${API_BASE}/documents/${dvId}/html`;
