import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CLASS_NAME, INSTRUCTOR_KEY, isInstructorAccess } from "@/constants/site";
import { useInstructorAuth } from "@/contexts/InstructorAuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  ensureDefaultClass,
  getClass,
  getRemovedMemberIds,
  instructorDeleteProject,
  instructorRemoveMember,
  listActivities,
  listClassMembers,
  listProjectsForClass,
} from "@/services/db";
import type { ActivityDoc, ProjectDoc } from "@/types/models";

type ProjectRow = { id: string } & ProjectDoc;
type ActivityRow = { id: string } & ActivityDoc;

const ACTIVITY_LABELS: Record<ActivityDoc["type"], string> = {
  visit: "Visited site",
  project_created: "Created project",
  project_saved: "Saved project",
  project_published: "Published",
  project_unpublished: "Unpublished",
  project_deleted: "Deleted project",
  editor_opened: "Opened HTML editor",
};

export function InstructorDashboard() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: sessionLoading, authError, firebaseReady, retryAuth } = useInstructorAuth();
  const key = searchParams.get("key");
  const allowed = isInstructorAccess(key);

  const [tab, setTab] = useState<"activity" | "students" | "projects">("activity");
  const [className, setClassName] = useState(CLASS_NAME);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listClassMembers>>>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed || !user) return;
    setDataLoading(true);
    setLoadError(null);
    try {
      await ensureDefaultClass();
      const [c, roster, ps] = await Promise.all([getClass(), listClassMembers(), listProjectsForClass()]);
      if (c?.name) setClassName(c.name);
      setMembers(roster);
      setProjects(ps as ProjectRow[]);

      try {
        const [acts, removed] = await Promise.all([listActivities(), getRemovedMemberIds()]);
        setActivities((acts as ActivityRow[]).filter((a) => !removed.has(a.userId)));
        setLoadError(null);
      } catch (ex: unknown) {
        const message = ex instanceof Error ? ex.message : "Could not load activity.";
        setActivities([]);
        setLoadError(message);
      }
    } catch (ex: unknown) {
      const message = ex instanceof Error ? ex.message : "Could not load class data.";
      setLoadError(message);
      toast(message, "error");
    } finally {
      setDataLoading(false);
    }
  }, [allowed, user, toast]);

  useEffect(() => {
    if (!allowed || sessionLoading || !user) return;
    void load();
  }, [allowed, sessionLoading, user, load]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) m.set(row.userId, row.displayName);
    return m;
  }, [members]);

  function projectsForStudent(studentId: string) {
    return projects.filter((p) => p.ownerId === studentId);
  }

  async function removeProject(projectId: string) {
    if (!confirm("Delete this project permanently?")) return;
    setBusy(true);
    try {
      await instructorDeleteProject(projectId);
      toast("Project deleted.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string, name: string) {
    if (
      !confirm(
        `Remove "${name}" from the class?\n\nTheir gallery work will be hidden. If they open the site again on the same browser, they will start fresh as a new visitor.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await instructorRemoveMember(userId);
      toast("Visitor removed.", "success");
      setExpandedStudentId(null);
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Remove failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseReady) {
    return (
      <div className="page stack">
        <h1>Instructor</h1>
        <p className="muted">
          Firebase is not configured. Add your <code>VITE_FIREBASE_*</code> keys to <code>.env</code> and restart{" "}
          <code>npm run dev</code>.
        </p>
        <Link to="/app">Back to student workspace</Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="page stack">
        <h1>Instructor</h1>
        <p className="muted">Add the correct access key to the URL, for example:</p>
        <p>
          <code>/instructor?key=your-secret</code>
        </p>
        {INSTRUCTOR_KEY ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Set <code>VITE_INSTRUCTOR_KEY</code> in your environment to require a key.
          </p>
        ) : null}
        <Link to="/app">Back to student workspace</Link>
      </div>
    );
  }

  return (
    <div className="page-wide stack">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Instructor — {className}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Class-wide view from the cloud — all students who entered a name on any device.
          </p>
        </div>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary"
            disabled={dataLoading || sessionLoading || !user}
            onClick={() => void load()}
          >
            {dataLoading ? "Refreshing…" : "Refresh"}
          </button>
          <Link to="/app">
            <button type="button" className="secondary">
              Student view
            </button>
          </Link>
        </div>
      </div>

      {sessionLoading ? <p className="muted">Connecting to Firebase…</p> : null}

      {!sessionLoading && authError ? (
        <div className="card stack" style={{ borderColor: "var(--danger, #c62828)" }}>
          <p style={{ margin: 0 }}>{authError}</p>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            On mobile: avoid private/incognito mode. In Firebase Console → Authentication → Settings → Authorized
            domains, add your Netlify URL (e.g. <code>your-site.netlify.app</code>).
          </p>
          <button type="button" onClick={retryAuth}>
            Try again
          </button>
        </div>
      ) : null}

      {!sessionLoading && !authError && !user ? (
        <p className="muted">Not signed in. Tap Try again or refresh the page.</p>
      ) : null}

      {loadError ? (
        <div className="card stack" style={{ borderColor: "var(--danger, #c62828)" }}>
          <p style={{ margin: 0 }}>{loadError}</p>
          {!loadError.includes("index") ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Check that <strong>Anonymous</strong> sign-in is enabled in Firebase Authentication, then click Try again.
            </p>
          ) : null}
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="class-tab-row" role="tablist">
        <button
          type="button"
          className={`class-tab${tab === "activity" ? " is-active" : ""}`}
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
        <button
          type="button"
          className={`class-tab${tab === "students" ? " is-active" : ""}`}
          onClick={() => setTab("students")}
        >
          Students ({members.length})
        </button>
        <button
          type="button"
          className={`class-tab${tab === "projects" ? " is-active" : ""}`}
          onClick={() => setTab("projects")}
        >
          All projects ({projects.length})
        </button>
      </div>

      {tab === "activity" && (
        <section className="card stack">
          <h2 style={{ marginTop: 0 }}>Recent activity</h2>
          {activities.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Student</th>
                  <th>Action</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>{a.displayName || nameById.get(a.userId) || a.userId.slice(0, 8)}</td>
                    <td>{ACTIVITY_LABELS[a.type] ?? a.type}</td>
                    <td>{a.projectName?.trim() || (a.projectId ? "—" : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "students" && (
        <section className="card stack">
          <h2 style={{ marginTop: 0 }}>Students</h2>
          <p className="muted" style={{ margin: 0 }}>
            Only students who chose a name appear here. Each browser is one student; this list is the same on every device you use as instructor.
          </p>
          {members.length === 0 ? (
            <p className="muted">No students yet. They must open the site and enter a name.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Projects</th>
                  <th>Last seen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <Fragment key={m.userId}>
                    <tr>
                      <td>
                        <button type="button" className="roster-name-btn" onClick={() => setExpandedStudentId((p) => (p === m.userId ? null : m.userId))}>
                          {m.displayName}
                        </button>
                      </td>
                      <td>{projectsForStudent(m.userId).length}</td>
                      <td>{new Date(m.lastSeenAt ?? m.joinedAt).toLocaleString()}</td>
                      <td>
                        <button type="button" className="danger" disabled={busy} onClick={() => void removeMember(m.userId, m.displayName)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                    {expandedStudentId === m.userId ? (
                      <tr>
                        <td colSpan={4} className="student-projects-panel">
                          {projectsForStudent(m.userId).length === 0 ? (
                            <p className="muted">No projects yet.</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                              {projectsForStudent(m.userId).map((p) => (
                                <li key={p.id}>
                                  {p.toolName || "Untitled"} — {p.isPublished ? "published" : "draft"}
                                  {p.isPublished ? (
                                    <>
                                      {" "}
                                      <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">
                                        open
                                      </a>
                                    </>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "projects" && (
        <section className="card stack">
          <h2 style={{ marginTop: 0 }}>All projects</h2>
          <p className="muted" style={{ margin: 0 }}>
            Includes drafts and published work. Updates when students save on their devices.
          </p>
          {projects.length === 0 ? (
            <p className="muted">No projects yet. Students need to create and save at least once.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.toolName || "Untitled"}</td>
                    <td className="muted" style={{ fontSize: "0.85rem" }}>
                      {nameById.get(p.ownerId) ?? p.ownerId.slice(0, 8)}
                    </td>
                    <td>{p.isPublished ? "Published" : "Draft"}</td>
                    <td>
                      <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                        {p.isPublished && (
                          <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">
                            <button type="button" className="secondary">
                              Open
                            </button>
                          </a>
                        )}
                        <button type="button" className="danger" disabled={busy} onClick={() => void removeProject(p.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
