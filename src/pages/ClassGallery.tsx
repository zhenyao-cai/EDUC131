import { useCallback, useEffect, useMemo, useState } from "react";
import { HtmlPreview } from "@/components/HtmlPreview";
import { CLASS_NAME } from "@/constants/site";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/constants/taxonomy";
import { getClass, listClassMembers, listPublishedProjectsForClass } from "@/services/db";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function ClassGallery() {
  const [className, setClassName] = useState(CLASS_NAME);
  const [gallery, setGallery] = useState<Awaited<ReturnType<typeof listPublishedProjectsForClass>>>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listClassMembers>>>([]);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const load = useCallback(async () => {
    const [c, published, roster] = await Promise.all([getClass(), listPublishedProjectsForClass(), listClassMembers()]);
    if (c?.name) setClassName(c.name);
    setGallery(published);
    setMembers(roster);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerDisplayById = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) m.set(row.userId, row.displayName);
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

  return (
    <div className="page-wide stack">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Gallery</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Published projects from everyone in {className}.
          </p>
        </div>
      </div>

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
          <p className="muted">Nothing published yet.</p>
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
                    {item.description ? (
                      <p style={{ fontSize: "0.88rem", margin: "0.45rem 0 0" }}>{item.description}</p>
                    ) : null}
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
    </div>
  );
}
