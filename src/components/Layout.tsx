import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export function Layout() {
  const { user, profile, logOut, updateDisplayName } = useAuth();
  const { toast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  async function saveDisplayName() {
    setSavingName(true);
    try {
      await updateDisplayName(nameDraft);
      setEditingName(false);
      toast("Name updated.", "success");
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not update name.", "error");
    } finally {
      setSavingName(false);
    }
  }

  function cancelEditName() {
    setEditingName(false);
    setNameDraft(profile?.displayName ?? "");
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
        <Link to="/app" style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
          Codeurtool
        </Link>
        {user && (
          <div className="row" style={{ marginLeft: "auto", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            {editingName ? (
              <>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={120}
                  autoFocus
                  disabled={savingName}
                  aria-label="Display name"
                  style={{ minWidth: "10rem", maxWidth: "16rem" }}
                />
                <button type="button" disabled={savingName || !nameDraft.trim()} onClick={() => void saveDisplayName()}>
                  Save
                </button>
                <button type="button" className="secondary" disabled={savingName} onClick={cancelEditName}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {profile ? (
                  <button
                    type="button"
                    className="header-name-btn"
                    title="Click to change your name"
                    onClick={() => {
                      setNameDraft(profile.displayName);
                      setEditingName(true);
                    }}
                  >
                    {profile.displayName}
                  </button>
                ) : (
                  <span className="header-user-name">{user.email}</span>
                )}
                {profile ? <span className="header-user-role">({profile.role})</span> : null}
              </>
            )}
            <Link to="/app" className="header-user-link" title="Go to workspace">
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Workspace
              </span>
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
