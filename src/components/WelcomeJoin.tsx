import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";

export function WelcomeJoin() {
  const { completeJoin, joining } = useSession();
  const [name, setName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await completeJoin(name);
  }

  return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "min(100%, 70vh)" }}>
      <div className="card stack" style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ margin: 0 }}>Welcome to Codeurtool</h1>
        <p className="muted" style={{ margin: 0 }}>
          What should we call you? Your name is saved on this browser so your projects stay here when you come back.
        </p>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label className="stack">
            <span className="muted">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={120}
              autoFocus
              required
              disabled={joining}
            />
          </label>
          <button type="submit" disabled={joining || !name.trim()}>
            {joining ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
