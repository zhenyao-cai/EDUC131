import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/models";

export function Register() {
  const { signUp, firebaseReady } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await signUp(email, password, displayName, role);
      nav("/app", { replace: true });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Registration failed.");
    }
  }

  if (!firebaseReady) {
    return (
      <div className="page stack">
        <h1>Create account</h1>
        <p className="muted">
          Configure Firebase in <code>.env</code> first.
        </p>
        <Link to="/">Back</Link>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      <h1>Create account</h1>
      <form className="stack card" onSubmit={(e) => void onSubmit(e)}>
        <label className="stack">
          <span className="muted">Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label className="stack">
          <span className="muted">Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="stack">
          <span className="muted">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        <fieldset className="stack" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>Choose your role</legend>
          <div className="role-picker">
            <label className={`role-card${role === "student" ? " is-selected" : ""}`}>
              <input type="radio" name="account-type" checked={role === "student"} onChange={() => setRole("student")} />
              <span className="role-card-title">I’m a student</span>
            </label>
            <label className={`role-card${role === "instructor" ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="account-type"
                checked={role === "instructor"}
                onChange={() => setRole("instructor")}
              />
              <span className="role-card-title">I’m an instructor</span>
            </label>
          </div>
        </fieldset>

        {err && <p className="error">{err}</p>}
        <button type="submit">Register</button>
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
