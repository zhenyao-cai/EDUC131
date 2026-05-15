import { Link, NavLink, Outlet } from "react-router-dom";
import { HeaderDisplayName } from "@/components/HeaderDisplayName";
import { WelcomeJoin } from "@/components/WelcomeJoin";
import { useLogVisit, useSession } from "@/contexts/SessionContext";

export function Layout() {
  const { user, hasJoined, loading, authError, firebaseReady, retryAuth } = useSession();

  useLogVisit();

  if (!firebaseReady) {
    return (
      <div className="page">
        <p className="muted">Configure Firebase in .env to use the app.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Connecting to Firebase…</p>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="page stack">
        <h1>Connection problem</h1>
        <p className="muted">{authError}</p>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Try a normal browser tab (not private). Add your site to Firebase → Authentication → Authorized domains.
        </p>
        <button type="button" onClick={retryAuth}>
          Try again
        </button>
      </div>
    );
  }

  if (user && !hasJoined) {
    return <WelcomeJoin />;
  }

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
        <div className="row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/app" style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
            Codeurtool
          </Link>
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/app" end className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}>
              My projects
            </NavLink>
            <NavLink to="/app/gallery" className={({ isActive }) => `app-nav-link app-nav-gallery${isActive ? " is-active" : ""}`}>
              Gallery
            </NavLink>
          </nav>
        </div>

        {user && hasJoined ? (
          <div style={{ marginLeft: "auto" }}>
            <HeaderDisplayName />
          </div>
        ) : null}
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
