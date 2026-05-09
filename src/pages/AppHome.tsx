import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { InstructorHome } from "@/pages/InstructorHome";
import { StudentHome } from "@/pages/StudentHome";

export function AppHome() {
  const { user, profile, loading, firebaseReady } = useAuth();

  if (!firebaseReady) {
    return (
      <div className="page">
        <p className="muted">Configure Firebase in .env to use the app.</p>
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="page stack">
        <p>Your profile is missing. Try signing out and registering again.</p>
      </div>
    );
  }

  if (profile.role === "instructor") {
    return <InstructorHome />;
  }

  return <StudentHome />;
}
