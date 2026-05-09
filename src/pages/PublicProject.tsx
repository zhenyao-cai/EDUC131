import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicProject, type PublicProjectView } from "@/services/db";

/**
 * Standalone published site: no app chrome — only the student’s HTML in a sandboxed full-viewport frame.
 */
export function PublicProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<PublicProjectView | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) {
        setData(null);
        return;
      }
      try {
        const pub = await getPublicProject(projectId);
        if (!cancelled) setData(pub);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (data === undefined) {
    return (
      <div className="public-site-root" style={{ display: "grid", placeItems: "center", background: "#1a1d24", color: "#9aa3b5" }}>
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="public-site-root" style={{ display: "grid", placeItems: "center", background: "#1a1d24", color: "#e8ecf4", padding: "1.5rem", textAlign: "center" }}>
        <div>
          <p style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Not found</p>
          <p style={{ margin: 0, color: "#9aa3b5", fontSize: "0.95rem" }}>This project is not published or does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-site-root">
      <iframe
        title={data.toolName || "Published project"}
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={data.html}
      />
    </div>
  );
}
