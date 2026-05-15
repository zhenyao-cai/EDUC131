import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/firebase";
import { ensureStudentInClass, isMemberRemoved, logActivity, updateStudentDisplayName } from "@/services/db";
import { ensureAnonymousAuth } from "@/services/firebaseAuthBootstrap";
import { clearLocalUserStorage, DISPLAY_NAME_KEY, resetToNewAnonymousSession } from "@/services/sessionReset";

function readStoredName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY)?.trim() ?? "";
}

function hasJoinedBefore(): boolean {
  return readStoredName().length > 0;
}

type SessionState = {
  user: User | null;
  displayName: string;
  hasJoined: boolean;
  loading: boolean;
  authError: string | null;
  joining: boolean;
  updatingName: boolean;
  firebaseReady: boolean;
  completeJoin: (name: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  retryAuth: () => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState(readStoredName);
  const [hasJoined, setHasJoined] = useState(hasJoinedBefore);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retryAuth = useCallback(() => {
    setAuthError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const bootstrap = async () => {
      try {
        const auth = getFirebaseAuth();
        setFirebaseReady(true);
        const u = await ensureAnonymousAuth(auth);
        if (cancelled) return;

        if (await isMemberRemoved(u.uid)) {
          clearLocalUserStorage(u.uid);
          setDisplayName("");
          setHasJoined(false);
          await resetToNewAnonymousSession();
          if (!cancelled) setAttempt((n) => n + 1);
          return;
        }

        const name = readStoredName();
        setUser(u);
        setDisplayName(name);
        setHasJoined(name.length > 0);
        setAuthError(null);

        if (name.length > 0) {
          try {
            await ensureStudentInClass(u.uid, name);
          } catch (ex: unknown) {
            setAuthError(ex instanceof Error ? ex.message : "Could not sync your profile to the class.");
          }
        }

        unsub = onAuthStateChanged(auth, (next) => {
          if (next && next.uid !== u.uid) {
            setUser(next);
          }
        });
      } catch (ex: unknown) {
        if (!cancelled) {
          setUser(null);
          setAuthError(ex instanceof Error ? ex.message : "Could not connect to Firebase.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [attempt]);

  const completeJoin = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required.");
      if (trimmed.length > 120) throw new Error("Name is too long.");
      if (!user) throw new Error("Still connecting…");

      setJoining(true);
      try {
        localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
        setDisplayName(trimmed);
        setHasJoined(true);
        await updateStudentDisplayName(user.uid, trimmed);
        await ensureStudentInClass(user.uid, trimmed);
        setAuthError(null);
        await logActivity({
          userId: user.uid,
          displayName: trimmed,
          type: "visit",
        });
      } catch (ex: unknown) {
        const message = ex instanceof Error ? ex.message : "Could not save your name to the class.";
        setAuthError(message);
        throw new Error(message);
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
        localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
        setDisplayName(trimmed);
        await updateStudentDisplayName(user.uid, trimmed);
        await ensureStudentInClass(user.uid, trimmed);
        setAuthError(null);
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
      authError,
      joining,
      updatingName,
      firebaseReady,
      completeJoin,
      updateDisplayName,
      retryAuth,
    }),
    [user, displayName, hasJoined, loading, authError, joining, updatingName, firebaseReady, completeJoin, updateDisplayName, retryAuth],
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
