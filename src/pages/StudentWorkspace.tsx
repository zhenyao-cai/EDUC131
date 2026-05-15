import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { useToast } from "@/contexts/ToastContext";
import { createProject, deleteProject, listMyProjects, syncAllLocalProjectMirrors, unpublishProject } from "@/services/db";
import type { ProjectDoc } from "@/types/models";

type Row = { id: string } & ProjectDoc;

export function StudentWorkspace() {
  const { user, displayName } = useSession();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setProjects(listMyProjects(user.uid) as Row[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    void syncAllLocalProjectMirrors(user.uid).catch(() => {
      /* mirror is best-effort; instructor view updates on next save */
    });
  }, [user, load]);

  async function onNewProject() {
    if (!user) return;
    setBusy(true);
    try {
      const id = await createProject(user.uid, displayName);
      window.location.href = `/app/project/${id}`;
    } finally {
      setBusy(false);
    }
  }

  async function onUnpublishProject(projectId: string) {
    if (!user || !confirm("Unpublish? The public link will stop working.")) return;
    setRowBusy(projectId);
    try {
      await unpublishProject(user.uid, projectId, displayName);
      toast("Unpublished.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Unpublish failed.", "error");
    } finally {
      setRowBusy(null);
    }
  }

  async function onDeleteProject(projectId: string) {
    if (!user || !confirm("Delete this project permanently?")) return;
    setRowBusy(projectId);
    try {
      await deleteProject(user.uid, projectId, displayName);
      toast("Project deleted.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Delete failed.", "error");
    } finally {
      setRowBusy(null);
    }
  }

  const published = projects.filter((p) => p.isPublished);
  const drafts = projects.filter((p) => !p.isPublished);

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>My projects</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Saved on this device only. Publish to share in the class gallery.
          </p>
        </div>
        <button type="button" onClick={() => void onNewProject()} disabled={busy}>
          New project
        </button>
      </div>

      <section className="stack">
        <h2>Unpublished</h2>
        {drafts.length === 0 ? (
          <p className="muted">No drafts yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {drafts.map((p) => (
              <li key={p.id} className="card row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <strong>{p.toolName || "Untitled project"}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {p.subject} {p.topic ? `· ${p.topic}` : ""}
                  </div>
                </div>
                <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                  <Link to={`/app/project/${p.id}`}>
                    <button type="button" className="secondary">
                      Details
                    </button>
                  </Link>
                  <Link to={`/app/project/${p.id}/html`}>
                    <button type="button">HTML editor</button>
                  </Link>
                  <button type="button" className="danger" disabled={rowBusy === p.id} onClick={() => void onDeleteProject(p.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <h2>Published</h2>
        {published.length === 0 ? (
          <p className="muted">Nothing published yet. Open a project and use Publish.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {published.map((p) => (
              <li key={p.id} className="card row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <strong>{p.toolName || "Untitled project"}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">
                      Public link
                    </a>
                  </div>
                </div>
                <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                  <Link to={`/app/project/${p.id}`}>
                    <button type="button" className="secondary">
                      Details
                    </button>
                  </Link>
                  <Link to={`/app/project/${p.id}/html`}>
                    <button type="button">HTML editor</button>
                  </Link>
                  <button type="button" className="secondary" disabled={rowBusy === p.id} onClick={() => void onUnpublishProject(p.id)}>
                    Unpublish
                  </button>
                  <button type="button" className="danger" disabled={rowBusy === p.id} onClick={() => void onDeleteProject(p.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
