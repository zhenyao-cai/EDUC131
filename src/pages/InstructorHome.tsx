import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CopyButton } from "@/components/CopyButton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { createClass, deleteClass, listMyClasses, type UserClassItem } from "@/services/db";

type JustCreated = { classId: string; className: string; joinCode: string };

export function InstructorHome() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [classes, setClasses] = useState<UserClassItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<JustCreated | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const cs = await listMyClasses(user.uid);
    setClasses(cs.filter((c) => c.role === "instructor"));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const className = name.trim() || "Untitled class";
      const { classId, joinCode } = await createClass(user.uid, className);
      setName("");
      setJustCreated({ classId, className, joinCode });
      toast("Class created.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not create class.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteClass(classId: string) {
    if (!user) return;
    if (
      !confirm(
        "Delete this class permanently? All enrollments, join code, and every student project linked to this class will be removed.",
      )
    ) {
      return;
    }
    setRowBusy(classId);
    try {
      await deleteClass(user.uid, classId);
      if (justCreated?.classId === classId) setJustCreated(null);
      toast("Class deleted.", "success");
      await load();
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not delete class.", "error");
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="page stack">
      <h1>Instructor dashboard</h1>

      <section className="card stack">
        <h2>New class</h2>
        <form className="stack" onSubmit={(e) => void onCreate(e)} style={{ maxWidth: 560 }}>
          <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: "0.65rem" }}>
            <label className="stack" style={{ flex: "1 1 200px", minWidth: 0, margin: 0 }}>
              <span className="muted">Class name</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (justCreated) setJustCreated(null);
                }}
                placeholder="e.g. CS 101 — Web basics"
              />
            </label>
            {justCreated ? (
              <div className="row" style={{ flexWrap: "wrap", alignItems: "center", gap: "0.65rem" }}>
                <span className="join-code-text join-code-lg" title="Join code">
                  {justCreated.joinCode}
                </span>
                <CopyButton text={justCreated.joinCode} label="Copy" compact />
              </div>
            ) : null}
          </div>
          {justCreated ? (
            <div className="created-class-strip">
              <span>
                <strong>{justCreated.className}</strong>
                <span className="muted" style={{ marginLeft: "0.35rem" }}>
                  — share the code above with students.
                </span>
              </span>
              <Link to={`/app/class/${justCreated.classId}`} style={{ textDecoration: "none" }}>
                <button type="button">Open class page</button>
              </Link>
            </div>
          ) : null}
          <button type="submit" disabled={busy}>
            Create class &amp; join code
          </button>
        </form>
      </section>

      <section className="stack">
        <h2>Your classes</h2>
        {classes.length === 0 ? (
          <p className="muted">No classes yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
            {classes.map((c) => (
              <li key={c.id} className="card row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong>{c.className}</strong>
                <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                  <Link to={`/app/class/${c.id}`}>
                    <button type="button" className="secondary">
                      Open
                    </button>
                  </Link>
                  <button
                    type="button"
                    className="danger"
                    disabled={rowBusy === c.id}
                    onClick={() => void onDeleteClass(c.id)}
                  >
                    Delete class
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
