import { NavLink } from "react-router-dom";
import { useClient } from "../lib/ClientContext";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/reviews", label: "Review Queue" },
  { to: "/documents", label: "Documents" },
  { to: "/corpus", label: "Corpus" },
  { to: "/monitors", label: "Monitors" },
];

export default function Sidebar() {
  const { clients, activeClient, switchClient, userEmail } = useClient();

  return (
    <aside className="w-56 bg-bg border-r border-border flex flex-col min-h-screen">
      <div className="p-5">
        <span className="text-accent font-bold text-xl tracking-tight">STRATA</span>
      </div>

      {/* Client switcher */}
      {clients.length > 0 && (
        <div className="px-4 pb-4">
          <label className="text-muted text-[10px] uppercase tracking-wider block mb-1">
            Client
          </label>
          <select
            value={activeClient?.id || ""}
            onChange={(e) => switchClient(e.target.value)}
            className="w-full bg-panel border border-border text-text rounded px-2 py-1.5 text-xs"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {activeClient && (
            <span className="text-[10px] text-muted mt-0.5 block">
              Role: {activeClient.role}
            </span>
          )}
        </div>
      )}

      <nav className="flex-1 px-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm mb-1 transition-colors ${
                isActive
                  ? "bg-panel text-accent"
                  : "text-muted hover:text-text hover:bg-panel/50"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted truncate">{userEmail}</div>
      </div>
    </aside>
  );
}
