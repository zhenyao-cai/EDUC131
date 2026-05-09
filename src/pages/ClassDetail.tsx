import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyButton } from "@/components/CopyButton";
import { HtmlPreview } from "@/components/HtmlPreview";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/constants/taxonomy";
import {
  countSubmittedProjectsForStudent,
  deleteStudentFromClass,
  getClass,
  instructorDeleteProject,
  isClassMember,
  listClassMembers,
  listProjectsForClass,
  leaveClass,
  listPublishedProjectsForClass,
  type ClassPublishedProject,
} from "@/services/db";
import type { ClassMember, ProjectDoc } from "@/types/models";

type MemberRow = ClassMember & { submitted: number };
type ProjectRow = { id: string } & ProjectDoc;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function ClassDetail() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [cls, setCls] = useState<Awaited<ReturnType<typeof getClass>>>(null);
  const [isInstructor, setIsInstructor] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [gallery, setGallery] = useState<ClassPublishedProject[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [instructorTab, setInstructorTab] = useState<"students" | "gallery">("students");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const load = useCallback(async () => {
    if (!classId || !user) return;
    setErr(null);
    const c = await getClass(classId);
    if (!c) {
      setErr("Class not found.");
      setCls(null);
      return;
    }
    const instructor = c.instructorId === user.uid;
    const member = await isClassMember(classId, user.uid);
    if (!instructor && !member) {
      setErr("You are not in this class.");
      setCls(null);
      return;
    }
    setCls(c);
    setIsInstructor(instructor);

    const published = await listPublishedProjectsForClass(classId);
    setGallery(published);

    if (instructor) {
      const raw = await listClassMembers(classId);
      const withCounts = await Promise.all(
        raw.map(async (m) => ({
          ...m,
          submitted: await countSubmittedProjectsForStudent(classId, m.userId),
        })),
      );
      setMembers(withCounts);
      const ps = await listProjectsForClass(classId);
      setProjects(ps as ProjectRow[]);
    } else {
      setMembers([]);
      setProjects([]);
    }
  }, [classId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerDisplayById = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) {
      m.set(row.userId, row.displayName);
    }
    return m;
  }, [members]);

  const gradeFilterChoices = useMemo(() => {
    const fromData = gallery.map((g) => g.gradeBand).filter(Boolean);
    return uniqueSorted([...GRADE_OPTIONS, ...fromData]);
  }, [gallery]);

  const subjectFilterChoices = useMemo(() => {
    const fromData = gallery.map((g) => g.subject).filter(Boolean);
    return uniqueSorted([...SUBJECT_OPTIONS, ...fromData]);
  }, [gallery]);

  const filteredGallery = useMemo(() => {
    return gallery.filter((g) => {
      if (filterGrade && g.gradeBand !== filterGrade) return false;
      if (filterSubject && g.subject !== filterSubject) return false;
      return true;
    });
  }, [gallery, filterGrade, filterSubject]);

  function projectsForStudent(studentId: string) {
    return projects.filter((p) => p.ownerId === studentId);
  }

  function toggleStudentRow(studentId: string) {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  }

  async function removeStudent(studentId: string) {
    if (!classId || !user) return;
    if (!confirm("Remove this student and delete all of their projects in this class?")) return;
    try {
      await deleteStudentFromClass(user.uid, classId, studentId);
      if (expandedStudentId === studentId) setExpandedStudentId(null);
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Delete failed.");
    }
  }

  async function onLeaveClassAsStudent() {
    if (!classId || !user) return;
    if (
      !confirm(
        "Leave this class? You will be removed from the roster. Your projects stay in your account but will no longer be linked to this class.",
      )
    ) {
      return;
    }
    setLeaveBusy(true);
    try {
      await leaveClass(user.uid, classId);
      toast("Left class.", "success");
      nav("/app");
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not leave class.", "error");
    } finally {
      setLeaveBusy(false);
    }
  }

  async function removeProject(projectId: string) {
    if (!user) return;
    if (!confirm("Delete this project permanently?")) return;
    try {
      await instructorDeleteProject(user.uid, projectId);
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Delete failed.");
    }
  }

  if (!classId) {
    return <div className="page">Missing class.</div>;
  }

  if (err) {
    return (
      <div className="page stack">
        <p className="error">{err}</p>
        <Link to="/app">Back</Link>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="page-wide">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const gallerySection = (
    <>
      {gallery.length > 0 && (
        <div className="card row" style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <label className="stack" style={{ minWidth: 160, flex: "0 1 200px" }}>
            <span className="muted">Level</span>
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
              <option value="">All levels</option>
              {gradeFilterChoices.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="stack" style={{ minWidth: 160, flex: "0 1 200px" }}>
            <span className="muted">Subject</span>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">All subjects</option>
              {subjectFilterChoices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {(filterGrade || filterSubject) && (
            <button type="button" className="secondary" onClick={() => { setFilterGrade(""); setFilterSubject(""); }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <section className="stack">
        {filteredGallery.length === 0 ? (
          <p className="muted">Nothing matches these filters, or nothing is published for this class yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
              gap: "1rem",
            }}
          >
            {filteredGallery.map((item) => {
              const owner =
                item.ownerDisplayName?.trim() || ownerDisplayById.get(item.ownerId ?? "")?.trim() || "Student";
              return (
                <article key={item.id} className="card stack" style={{ minWidth: 0 }}>
                  <div>
                    <strong>{item.toolName || "Untitled"}</strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      By {owner}
                      {item.gradeBand ? ` · ${item.gradeBand}` : ""}
                      {item.subject ? ` · ${item.subject}` : ""}
                      {item.topic ? ` · ${item.topic}` : ""}
                    </div>
                    {item.description ? <p style={{ fontSize: "0.88rem", margin: "0.45rem 0 0" }}>{item.description}</p> : null}
                  </div>
                  <div style={{ transform: "scale(0.88)", transformOrigin: "top center" }}>
                    <HtmlPreview html={item.html} compact />
                  </div>
                  <div className="row">
                    <a href={`/p/${item.id}`} target="_blank" rel="noreferrer">
                      <button type="button">Open site</button>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );

  const studentsSection = (
    <section className="card stack">
      <h2 style={{ marginTop: 0 }}>Roster</h2>
      {members.length === 0 ? (
        <p className="muted">No students yet. Share the join code from the header so they can enroll.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Projects in class</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const mine = projectsForStudent(m.userId);
              return (
                <Fragment key={m.userId}>
                  <tr>
                    <td>
                      <button type="button" className="roster-name-btn" onClick={() => toggleStudentRow(m.userId)}>
                        {m.displayName}
                      </button>
                    </td>
                    <td>{m.submitted}</td>
                    <td>
                      <button type="button" className="danger" onClick={() => void removeStudent(m.userId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                  {expandedStudentId === m.userId ? (
                    <tr>
                      <td colSpan={3} className="student-projects-panel">
                        {mine.length === 0 ? (
                          <p className="muted">No projects linked to this class yet.</p>
                        ) : (
                          <table style={{ width: "100%", margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Published</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {mine.map((p) => (
                                <tr key={p.id}>
                                  <td>{p.toolName || "Untitled"}</td>
                                  <td>{p.isPublished ? "Yes" : "No"}</td>
                                  <td>
                                    <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                                      {p.isPublished && (
                                        <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">
                                          <button type="button" className="secondary">
                                            Open
                                          </button>
                                        </a>
                                      )}
                                      <button type="button" className="danger" onClick={() => void removeProject(p.id)}>
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );

  return (
    <div className="page-wide stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div className="stack" style={{ gap: "0.35rem" }}>
          <h1 style={{ margin: 0 }}>{cls.name}</h1>
          {isInstructor ? (
            <div className="row" style={{ flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                Join code
              </span>
              <span className="join-code-text join-code-lg">{cls.joinCode}</span>
              <CopyButton text={cls.joinCode} label="Copy" compact />
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                — students enroll from their dashboard with this code.
              </span>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Browse published projects from your classmates.
            </p>
          )}
        </div>
        <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
          {!isInstructor ? (
            <button type="button" className="secondary" disabled={leaveBusy} onClick={() => void onLeaveClassAsStudent()}>
              Leave class
            </button>
          ) : null}
          <Link to="/app">
            <button type="button" className="secondary">
              Back
            </button>
          </Link>
        </div>
      </div>

      {isInstructor ? (
        <div className="class-tab-row" role="tablist" aria-label="Class sections">
          <button
            type="button"
            role="tab"
            aria-selected={instructorTab === "students"}
            className={`class-tab${instructorTab === "students" ? " is-active" : ""}`}
            onClick={() => setInstructorTab("students")}
          >
            Students
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={instructorTab === "gallery"}
            className={`class-tab${instructorTab === "gallery" ? " is-active" : ""}`}
            onClick={() => setInstructorTab("gallery")}
          >
            Class gallery
          </button>
        </div>
      ) : null}

      {!isInstructor ? gallerySection : null}
      {isInstructor && instructorTab === "gallery" ? gallerySection : null}
      {isInstructor && instructorTab === "students" ? studentsSection : null}
    </div>
  );
}
