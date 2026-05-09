import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  createProject,
  deleteProject,
  joinClassWithCode,
  listMyClasses,
  listMyProjects,
  unpublishProject,
  type UserClassItem,
} from "@/services/db";
import type { ProjectDoc } from "@/types/models";

type Row = { id: string } & ProjectDoc;

export function StudentHome() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Row[]>([]);
  const [classes, setClasses] = useState<UserClassItem[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [ps, cs] = await Promise.all([listMyProjects(user.uid), listMyClasses(user.uid)]);
    setProjects(ps as Row[]);
    setClasses(cs);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setBusy(true);
    try {
      await joinClassWithCode(user.uid, profile.displayName, joinCode);
      setJoinCode("");
      toast("Joined class.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not join.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onNewProject() {
    if (!user) return;
    setBusy(true);
    try {
      const id = await createProject(user.uid);
      window.location.href = `/app/project/${id}`;
    } finally {
      setBusy(false);
    }
  }

  async function onUnpublishProject(projectId: string) {
    if (!user || !confirm("Unpublish? The public link will stop working.")) return;
    setRowBusy(projectId);
    try {
      await unpublishProject(user.uid, projectId);
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
      await deleteProject(user.uid, projectId);
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

  const studentClasses = classes.filter((c) => c.role === "student");

  return (
    <div className="page stack">
      <h1>Student workspace</h1>

      <section className="card stack">
        <h2>Join a class</h2>
        <form className="row" onSubmit={(e) => void onJoin(e)}>
          <input
            placeholder="Join code (e.g. ABC12X)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <button type="submit" disabled={busy}>
            Join
          </button>
        </form>
        {studentClasses.length > 0 && (
          <div>
            <p className="muted">Your classes</p>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {studentClasses.map((c) => (
                <li key={c.id} className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span>{c.className}</span>
                  <Link to={`/app/class/${c.id}`}>
                    <button type="button" className="secondary">
                      Class page &amp; gallery
                    </button>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Projects</h2>
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
              <li key={p.id} className="card row" style={{ justifyContent: "space-between" }}>
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
                  <button
                    type="button"
                    className="danger"
                    disabled={rowBusy === p.id}
                    onClick={() => void onDeleteProject(p.id)}
                  >
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
              <li key={p.id} className="card row" style={{ justifyContent: "space-between" }}>
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
                  <button
                    type="button"
                    className="secondary"
                    disabled={rowBusy === p.id}
                    onClick={() => void onUnpublishProject(p.id)}
                  >
                    Unpublish
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={rowBusy === p.id}
                    onClick={() => void onDeleteProject(p.id)}
                  >
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
