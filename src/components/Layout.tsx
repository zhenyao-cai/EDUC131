import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function Layout() {
  const { user, profile, logOut } = useAuth();

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <Link to="/app" style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
          Codeurtool
        </Link>
        {user && (
          <div className="row" style={{ marginLeft: "auto" }}>
            <Link to="/app" className="header-user-link" title="Go to workspace">
              <span className="header-user-name">{profile?.displayName ?? user.email}</span>
              <span className="header-user-role">({profile?.role})</span>
            </Link>
            <button type="button" className="secondary" onClick={() => void logOut()}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
