import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function Login() {
  const { signIn, firebaseReady } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await signIn(email, password);
      nav("/app", { replace: true });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Sign-in failed.");
    }
  }

  if (!firebaseReady) {
    return (
      <div className="page stack">
        <h1>Sign in</h1>
        <p className="muted">
          Firebase is not configured. Add <code>.env</code> with your <code>VITE_FIREBASE_*</code> keys
          (see <code>.env.example</code>).
        </p>
        <Link to="/">Back</Link>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <form className="stack card" onSubmit={(e) => void onSubmit(e)}>
        <label className="stack">
          <span className="muted">Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="stack">
          <span className="muted">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <p className="error">{err}</p>}
        <button type="submit">Sign in</button>
        <p className="muted">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
