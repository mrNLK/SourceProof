import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/reviews", label: "Review Queue" },
  { to: "/documents", label: "Documents" },
  { to: "/corpus", label: "Corpus" },
  { to: "/monitors", label: "Monitors" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-bg border-r border-border flex flex-col min-h-screen">
      <div className="p-5">
        <span className="text-accent font-bold text-xl tracking-tight">STRATA</span>
      </div>
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
    </aside>
  );
}
