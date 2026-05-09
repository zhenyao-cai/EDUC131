/** Preset values for filters and project metadata (stored as plain strings). */

export const GRADE_OPTIONS = [
  "Preschool",
  "K–5",
  "Middle school",
  "High school",
  "Higher ed",
] as const;

export const SUBJECT_OPTIONS = [
  "Science",
  "Math",
  "Language",
  "Arts",
  "Humanities",
  "Engineering",
] as const;

export function isPresetSubject(v: string): boolean {
  return (SUBJECT_OPTIONS as readonly string[]).includes(v);
}
