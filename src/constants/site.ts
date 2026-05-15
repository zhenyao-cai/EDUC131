/** Fixed class for this deployment (create `classes/{id}` in Firestore or set in .env). */
export const CLASS_ID = import.meta.env.VITE_CLASS_ID?.trim() || "main";

export const CLASS_NAME = import.meta.env.VITE_CLASS_NAME?.trim() || "Class";

/** Optional secret for /instructor?key=... (client-side gate; set in Netlify env). */
export const INSTRUCTOR_KEY = import.meta.env.VITE_INSTRUCTOR_KEY?.trim() || "";

export function isInstructorAccess(key: string | null): boolean {
  if (!INSTRUCTOR_KEY) return true;
  return key === INSTRUCTOR_KEY;
}
