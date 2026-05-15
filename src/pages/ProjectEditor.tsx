import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { HtmlPreview } from "@/components/HtmlPreview";
import { useSession } from "@/contexts/SessionContext";
import { WelcomeJoin } from "@/components/WelcomeJoin";
import { useToast } from "@/contexts/ToastContext";
import { GRADE_OPTIONS, SUBJECT_OPTIONS, isPresetSubject } from "@/constants/taxonomy";
import { deleteProject, getProject, publishProject, unpublishProject, updateProject } from "@/services/db";

export function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { pathname } = useLocation();
  const isHtmlWorkspace = pathname.endsWith("/html");
  const { user, displayName, hasJoined, loading: sessionLoading } = useSession();
  const { toast } = useToast();
  const nav = useNavigate();

  const [toolName, setToolName] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [html, setHtml] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  const [codePct, setCodePct] = useState(52);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const load = useCallback(async () => {
    if (!projectId || !user) return;
    const p = getProject(user.uid, projectId);
    if (!p) {
      nav("/app", { replace: true });
      return;
    }
    setToolName(p.toolName);
    setGradeBand(p.gradeBand);
    setSubject(p.subject);
    setTopic(p.topic);
    setDescription(p.description);
    setHtml(p.html);
    setIsPublished(p.isPublished);
    const restoreKey = `restoreVersion:${projectId}`;
    const restored = sessionStorage.getItem(restoreKey);
    if (restored) {
      setHtml(restored);
      sessionStorage.removeItem(restoreKey);
      toast("Restored version into the editor — Save to keep.", "info");
    }
  }, [projectId, user, nav, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function persistDetails(activityType: "project_saved" | "editor_opened" = "project_saved") {
    if (!projectId || !user) throw new Error("Not ready.");
    await updateProject(
      user.uid,
      projectId,
      displayName,
      { html, toolName, gradeBand, subject, topic, description },
      activityType,
    );
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

  async function onPublish() {
    if (!projectId || !user) return;
    setBusy(true);
    try {
      await persistDetails();
      await publishProject(user.uid, projectId, displayName);
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
      await unpublishProject(user.uid, projectId, displayName);
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
      await deleteProject(user.uid, projectId, displayName);
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
      await persistDetails("editor_opened");
      toast("Details saved — opening editor.", "success");
      nav(`/app/project/${projectId}/html`);
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!projectId || sessionLoading || !user) {
    return (
      <div className={isHtmlWorkspace ? "project-html-shell" : "page"}>
        <p className="muted" style={{ padding: "1rem" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!hasJoined) {
    return <WelcomeJoin />;
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

    </div>
  );
}
