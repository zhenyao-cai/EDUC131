import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function Landing() {
  const { user, firebaseReady } = useAuth();

  return (
    <div className="page stack" style={{ maxWidth: 640 }}>
      <h1>Codeurtool</h1>
      <p>
        Build HTML projects, preview them safely, save version history, publish to a public link, and organize work in
        instructor-led classes with join codes.
      </p>
      {!firebaseReady && (
        <p className="muted">
          To run the app locally, create a Firebase project, enable Email/Password auth and Firestore, then copy{" "}
          <code>.env.example</code> to <code>.env</code> and fill in the keys.
        </p>
      )}
      <div className="row">
        {user ? (
          <Link to="/app">
            <button type="button">Open app</button>
          </Link>
        ) : (
          <>
            <Link to="/login">
              <button type="button">Sign in</button>
            </Link>
            <Link to="/register">
              <button type="button" className="secondary">
                Register
              </button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
