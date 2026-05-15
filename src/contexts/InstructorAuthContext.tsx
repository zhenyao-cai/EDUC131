import type { User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/firebase";
import { ensureAnonymousAuth } from "@/services/firebaseAuthBootstrap";

/** Firebase auth for instructor pages only — not tied to student name or localStorage. */
type InstructorAuthState = {
  user: User | null;
  loading: boolean;
  authError: string | null;
  firebaseReady: boolean;
  retryAuth: () => void;
};

const InstructorAuthContext = createContext<InstructorAuthState | null>(null);

export function InstructorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retryAuth = useCallback(() => {
    setAuthError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const auth = getFirebaseAuth();
      setFirebaseReady(true);
      void ensureAnonymousAuth(auth)
        .then((u) => {
          if (!cancelled) {
            setUser(u);
            setAuthError(null);
          }
        })
        .catch((ex: unknown) => {
          if (!cancelled) {
            setUser(null);
            setAuthError(ex instanceof Error ? ex.message : "Could not connect to Firebase.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } catch (ex: unknown) {
      setFirebaseReady(false);
      setAuthError(ex instanceof Error ? ex.message : "Firebase is not configured.");
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo(
    () => ({ user, loading, authError, firebaseReady, retryAuth }),
    [user, loading, authError, firebaseReady, retryAuth],
  );

  return <InstructorAuthContext.Provider value={value}>{children}</InstructorAuthContext.Provider>;
}

export function useInstructorAuth(): InstructorAuthState {
  const ctx = useContext(InstructorAuthContext);
  if (!ctx) throw new Error("useInstructorAuth must be used within InstructorAuthProvider");
  return ctx;
}
