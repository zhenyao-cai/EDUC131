import { Navigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";

export function Landing() {
  const { loading, firebaseReady } = useSession();

  if (!firebaseReady) {
    return (
      <div className="page stack" style={{ maxWidth: 640 }}>
        <h1>Codeurtool</h1>
        <p className="muted">
          Copy <code>.env.example</code> to <code>.env</code>, add Firebase keys, and enable <strong>Anonymous</strong>{" "}
          sign-in in the Firebase console.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return <Navigate to="/app" replace />;
}
