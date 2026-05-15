import { signInAnonymously, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/firebase";
import { clearLocalProjectsForUser } from "@/services/localProjects";

export const DISPLAY_NAME_KEY = "codeurtool_display_name";

export function clearLocalUserStorage(userId: string): void {
  localStorage.removeItem(DISPLAY_NAME_KEY);
  clearLocalProjectsForUser(userId);
  sessionStorage.removeItem(`codeurtool_visited_${userId}`);
}

/** After instructor removal: new anonymous Firebase user and clean local data. */
export async function resetToNewAnonymousSession(): Promise<void> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (uid) clearLocalUserStorage(uid);
  await signOut(auth);
  await signInAnonymously(auth);
}
