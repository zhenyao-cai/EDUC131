import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/firebase";

/** Firebase auth for instructor pages only — not tied to student name or localStorage. */
type InstructorAuthState = {
  user: User | null;
  loading: boolean;
  firebaseReady: boolean;
};

const InstructorAuthContext = createContext<InstructorAuthState | null>(null);

export function InstructorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      setFirebaseReady(true);
      unsub = onAuthStateChanged(auth, async (u) => {
        if (u) {
          setUser(u);
          setLoading(false);
        } else {
          try {
            await signInAnonymously(auth);
          } catch {
            setLoading(false);
          }
        }
      });
    } catch {
      setFirebaseReady(false);
      setLoading(false);
    }
    return () => unsub?.();
  }, []);

  const value = useMemo(() => ({ user, loading, firebaseReady }), [user, loading, firebaseReady]);

  return <InstructorAuthContext.Provider value={value}>{children}</InstructorAuthContext.Provider>;
}

export function useInstructorAuth(): InstructorAuthState {
  const ctx = useContext(InstructorAuthContext);
  if (!ctx) throw new Error("useInstructorAuth must be used within InstructorAuthProvider");
  return ctx;
}
