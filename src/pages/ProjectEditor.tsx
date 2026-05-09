import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { HtmlPreview } from "@/components/HtmlPreview";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { GRADE_OPTIONS, SUBJECT_OPTIONS, isPresetSubject } from "@/constants/taxonomy";
import {
  deleteProject,
  getProject,
  listMyClasses,
  listVersions,
  publishProject,
  saveVersion,
  unpublishProject,
  updateProject,
  type UserClassItem,
} from "@/services/db";
import type { ProjectVersionDoc } from "@/types/models";

export function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { pathname } = useLocation();
  const isHtmlWorkspace = pathname.endsWith("/html");
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();

  const isStudent = profile?.role === "student";
  const showVersionHistory = Boolean(profile && profile.role !== "student");

  const [toolName, setToolName] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [html, setHtml] = useState("");
  const [classId, setClassId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [classes, setClasses] = useState<UserClassItem[]>([]);
  const [versions, setVersions] = useState<Array<{ id: string } & ProjectVersionDoc>>([]);
  const [busy, setBusy] = useState(false);

  const [codePct, setCodePct] = useState(52);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const load = useCallback(async () => {
    if (!projectId || !user) return;
    const p = await getProject(projectId);
    if (!p || p.ownerId !== user.uid) {
      nav("/app", { replace: true });
      return;
    }
    setToolName(p.toolName);
    setGradeBand(p.gradeBand);
    setSubject(p.subject);
    setTopic(p.topic);
    setDescription(p.description);
    setHtml(p.html);
    setClassId(p.classId);
    setIsPublished(p.isPublished);
    const cs = await listMyClasses(user.uid);
    setClasses(cs.filter((c) => c.role === "student"));
    if (showVersionHistory) {
      const vs = await listVersions(projectId, user.uid);
      setVersions(vs as Array<{ id: string } & ProjectVersionDoc>);
    } else {
      setVersions([]);
    }
    const restoreKey = `restoreVersion:${projectId}`;
    const restored = sessionStorage.getItem(restoreKey);
    if (restored) {
      setHtml(restored);
      sessionStorage.removeItem(restoreKey);
      toast("Restored version into the editor — Save to keep.", "info");
    }
  }, [projectId, user, nav, showVersionHistory, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (authLoading) return;
    if (!user && projectId) {
      nav("/login", { replace: true });
    }
  }, [authLoading, user, projectId, nav]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const r = splitRef.current.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      setCodePct(Math.min(82, Math.max(18, pct)));
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  async function persistDetails() {
    if (!projectId || !user) throw new Error("Not signed in.");
    await updateProject(user.uid, projectId, {
      html,
      toolName,
      gradeBand,
      subject,
      topic,
      description,
      classId: classId || null,
    });
  }

  async function saveDraft() {
    if (!projectId || !user) return;
    setBusy(true);
    try {
      await persistDetails();
      toast("Saved.", "success");
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function snapshotVersion() {
    if (!projectId || !user || isStudent) return;
    setBusy(true);
    try {
      await persistDetails();
      await saveVersion(user.uid, projectId, html, "save");
      toast("Version saved.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Version save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!projectId || !user) return;
    setBusy(true);
    try {
      await persistDetails();
      await publishProject(user.uid, projectId, profile?.displayName ?? user.displayName ?? "Student");
      setIsPublished(true);
      const publicUrl = `${window.location.origin}/p/${projectId}`;
      toast(`Published. Public URL: ${publicUrl}`, "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Publish failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onUnpublish() {
    if (!projectId || !user) return;
    setBusy(true);
    try {
      await unpublishProject(user.uid, projectId);
      setIsPublished(false);
      toast("Unpublished.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Unpublish failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!projectId || !user) return;
    if (!confirm("Delete this project and all versions?")) return;
    setBusy(true);
    try {
      await deleteProject(user.uid, projectId);
      nav("/app", { replace: true });
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveDetailsOnly() {
    if (!projectId || !user) return;
    setBusy(true);
    try {
      await persistDetails();
      toast("Details saved.", "success");
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openHtmlEditorFromDetails() {
    if (!projectId || !user || !toolName.trim()) return;
    setBusy(true);
    try {
      await persistDetails();
      toast("Details saved — opening editor.", "success");
      nav(`/app/project/${projectId}/html`);
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openEditorWithRestoredVersion(versionHtml: string) {
    if (!projectId || !user) return;
    setBusy(true);
    try {
      await persistDetails();
      sessionStorage.setItem(`restoreVersion:${projectId}`, versionHtml);
      nav(`/app/project/${projectId}/html`);
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!projectId || authLoading || !user) {
    return (
      <div className={isHtmlWorkspace ? "project-html-shell" : "page"}>
        <p className="muted" style={{ padding: "1rem" }}>
          Loading…
        </p>
      </div>
    );
  }

  const detailsOk = toolName.trim().length > 0;

  if (isHtmlWorkspace) {
    return (
      <div className="project-html-shell">
        <header className="project-html-toolbar">
          <Link to="/app">
            <button type="button" className="secondary">
              ← Dashboard
            </button>
          </Link>
          <h1 title={toolName || "Untitled"}>{toolName.trim() || "Untitled project"}</h1>
          <button
            type="button"
            className="secondary"
            disabled={!isPublished}
            title={isPublished ? "Open published site in a new tab" : "Publish first to get a full-page public link."}
            onClick={() => isPublished && window.open(`/p/${projectId}`, "_blank", "noopener,noreferrer")}
          >
            Preview site
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void saveDraft()}>
            Save
          </button>
          {!isStudent && (
            <button type="button" className="secondary" disabled={busy} onClick={() => void snapshotVersion()}>
              Save version
            </button>
          )}
          {!isPublished ? (
            <button type="button" disabled={busy} onClick={() => void onPublish()}>
              Publish
            </button>
          ) : (
            <button type="button" className="secondary" disabled={busy} onClick={() => void onUnpublish()}>
              Unpublish
            </button>
          )}
          <button type="button" className="danger" disabled={busy} onClick={() => void onDelete()}>
            Delete
          </button>
        </header>
        <div ref={splitRef} className="project-html-split">
          <div className="project-html-code-col" style={{ width: `${codePct}%`, flexShrink: 0 }}>
            <textarea className="code" value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} />
          </div>
          <div
            className="project-html-gutter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and preview"
            onMouseDown={(e) => {
              e.preventDefault();
              dragging.current = true;
            }}
          />
          <div className="project-html-preview-wrap">
            <HtmlPreview html={html} fill />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Project details</h1>
          <p className="muted">Set metadata here, then open the full-screen HTML workspace.</p>
        </div>
        <Link to="/app">
          <button type="button" className="secondary">
            Dashboard
          </button>
        </Link>
      </div>

      <div className="stack card">
        <h2>Details</h2>
        <div
          className="stack"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.75rem" }}
        >
          <label className="stack">
            <span className="muted">Tool / project name *</span>
            <input value={toolName} onChange={(e) => setToolName(e.target.value)} required />
          </label>
          <label className="stack" style={{ gridColumn: "1 / -1" }}>
            <span className="muted">School level</span>
            {gradeBand && !(GRADE_OPTIONS as readonly string[]).includes(gradeBand) ? (
              <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.35rem" }}>
                Saved as <strong>{gradeBand}</strong> — choose a level below to update.
              </p>
            ) : null}
            <div className="grade-pill-row" role="group" aria-label="School level">
              {GRADE_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`grade-pill${gradeBand === g ? " is-selected" : ""}`}
                  onClick={() => setGradeBand(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </label>
          <label className="stack">
            <span className="muted">Subject</span>
            <select value={isPresetSubject(subject) ? subject : ""} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Choose subject…</option>
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {!isPresetSubject(subject) && subject ? (
              <p className="muted" style={{ fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                Currently saved: <strong>{subject}</strong> — pick a subject above to update.
              </p>
            ) : null}
          </label>
          <label className="stack">
            <span className="muted">Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </label>
        </div>
        <label className="stack">
          <span className="muted">Description</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="stack">
          <span className="muted">Class (submission)</span>
          <select
            value={classId ?? ""}
            onChange={(e) => setClassId(e.target.value || null)}
            disabled={classes.length === 0}
          >
            <option value="">Not linked to a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className}
              </option>
            ))}
          </select>
        </label>
        {classes.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            Join a class from your student dashboard to link this project for your instructor.
          </p>
        )}
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <button type="button" className="secondary" disabled={busy} onClick={() => void saveDetailsOnly()}>
          Save details
        </button>
        <button
          type="button"
          disabled={!detailsOk || busy}
          title={!detailsOk ? "Add a project name first." : undefined}
          onClick={() => void openHtmlEditorFromDetails()}
        >
          Open HTML editor (full screen)
        </button>
        <button type="button" className="danger" disabled={busy} onClick={() => void onDelete()}>
          Delete project
        </button>
      </div>

      {showVersionHistory && (
        <section className="card stack">
          <h2>Version history</h2>
          {versions.length === 0 ? (
            <p className="muted">No saved versions yet. Use the HTML editor → Save version.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Label</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{new Date(v.createdAt).toLocaleString()}</td>
                    <td>{v.label}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => void openEditorWithRestoredVersion(v.html)}
                      >
                        Open editor &amp; load
                      </button>
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
