import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/firebase";
import { ensureStudentInClass, logActivity, updateStudentDisplayName } from "@/services/db";

const NAME_KEY = "codeurtool_display_name";

function readStoredName(): string {
  return localStorage.getItem(NAME_KEY)?.trim() ?? "";
}

function hasJoinedBefore(): boolean {
  return readStoredName().length > 0;
}

type SessionState = {
  user: User | null;
  displayName: string;
  hasJoined: boolean;
  loading: boolean;
  joining: boolean;
  updatingName: boolean;
  firebaseReady: boolean;
  completeJoin: (name: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState(readStoredName);
  const [hasJoined, setHasJoined] = useState(hasJoinedBefore);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      setFirebaseReady(true);
      unsub = onAuthStateChanged(auth, async (u) => {
        if (u) {
          setUser(u);
          const name = readStoredName();
          setDisplayName(name);
          setHasJoined(name.length > 0);
          if (name.length > 0) {
            try {
              await ensureStudentInClass(u.uid, name);
            } catch {
              /* class doc may be missing */
            }
          }
        } else {
          try {
            await signInAnonymously(auth);
          } catch {
            setLoading(false);
          }
          return;
        }
        setLoading(false);
      });
    } catch {
      setFirebaseReady(false);
      setLoading(false);
    }
    return () => unsub?.();
  }, []);

  const completeJoin = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required.");
      if (trimmed.length > 120) throw new Error("Name is too long.");
      if (!user) throw new Error("Still connecting…");

      setJoining(true);
      try {
        localStorage.setItem(NAME_KEY, trimmed);
        setDisplayName(trimmed);
        setHasJoined(true);
        await updateStudentDisplayName(user.uid, trimmed);
        await ensureStudentInClass(user.uid, trimmed);
        await logActivity({
          userId: user.uid,
          displayName: trimmed,
          type: "visit",
        });
      } finally {
        setJoining(false);
      }
    },
    [user],
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required.");
      if (trimmed.length > 120) throw new Error("Name is too long.");
      if (!user) throw new Error("Still connecting…");
      if (trimmed === readStoredName()) return;

      setUpdatingName(true);
      try {
        localStorage.setItem(NAME_KEY, trimmed);
        setDisplayName(trimmed);
        await updateStudentDisplayName(user.uid, trimmed);
        await ensureStudentInClass(user.uid, trimmed);
      } finally {
        setUpdatingName(false);
      }
    },
    [user],
  );

  const value = useMemo<SessionState>(
    () => ({
      user,
      displayName,
      hasJoined,
      loading,
      joining,
      updatingName,
      firebaseReady,
      completeJoin,
      updateDisplayName,
    }),
    [user, displayName, hasJoined, loading, joining, updatingName, firebaseReady, completeJoin, updateDisplayName],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Log a return visit once per tab session (after name is set). */
export function useLogVisit() {
  const { user, displayName, hasJoined, loading } = useSession();
  useEffect(() => {
    if (loading || !user || !hasJoined) return;
    const key = `codeurtool_visited_${user.uid}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void logActivity({
      userId: user.uid,
      displayName,
      type: "visit",
    });
  }, [user, displayName, hasJoined, loading]);
}
