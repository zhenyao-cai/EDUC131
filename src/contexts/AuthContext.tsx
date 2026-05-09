import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/firebase";
import { ensureUserProfile, getUserProfile, updateUserProfileDisplayName } from "@/services/db";
import type { UserProfile, UserRole } from "@/types/models";

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  logOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      setFirebaseReady(true);
      unsub = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          // After registration, Firestore may lag slightly behind Auth; avoid flashing "profile missing".
          let p: UserProfile | null = await getUserProfile(u.uid);
          for (let attempt = 0; attempt < 6 && p == null; attempt++) {
            await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
            p = await getUserProfile(u.uid);
          }
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    } catch {
      setFirebaseReady(false);
      setLoading(false);
    }
    return () => unsub?.();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const p = await getUserProfile(cred.user.uid);
    setProfile(p);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string, role: UserRole) => {
    const auth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(cred.user.uid, email, displayName, role);
    await updateProfile(cred.user, { displayName });
    const p = await getUserProfile(cred.user.uid);
    setProfile(p);
  }, []);

  const logOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) throw new Error("Not signed in.");
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error("Name is required.");
    if (trimmed.length > 120) throw new Error("Name is too long.");
    await updateProfile(u, { displayName: trimmed });
    await updateUserProfileDisplayName(u.uid, trimmed);
    const p = await getUserProfile(u.uid);
    setProfile(p);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      firebaseReady,
      signIn,
      signUp,
      logOut,
      refreshProfile,
      updateDisplayName,
    }),
    [user, profile, loading, firebaseReady, signIn, signUp, logOut, refreshProfile, updateDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
