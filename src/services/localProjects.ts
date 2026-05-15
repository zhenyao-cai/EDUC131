import { CLASS_ID } from "@/constants/site";
import type { ProjectDoc } from "@/types/models";

const STORAGE_VERSION = 1;

export type LocalProject = { id: string } & ProjectDoc;

function storageKey(ownerId: string): string {
  return `codeurtool_projects_v${STORAGE_VERSION}_${ownerId}`;
}

function readAll(ownerId: string): LocalProject[] {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && p.ownerId === ownerId && typeof p.id === "string");
  } catch {
    return [];
  }
}

function writeAll(ownerId: string, projects: LocalProject[]): void {
  localStorage.setItem(storageKey(ownerId), JSON.stringify(projects));
}

const defaultHtml =
  '<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>My page</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n';

function emptyProject(ownerId: string, id: string): LocalProject {
  const now = Date.now();
  return {
    id,
    ownerId,
    classId: CLASS_ID,
    toolName: "",
    gradeBand: "",
    subject: "",
    topic: "",
    description: "",
    html: defaultHtml,
    isPublished: false,
    publishedVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function listLocalProjects(ownerId: string): LocalProject[] {
  return readAll(ownerId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLocalProject(ownerId: string, projectId: string): LocalProject | null {
  return readAll(ownerId).find((p) => p.id === projectId) ?? null;
}

export function createLocalProject(ownerId: string): string {
  const id = crypto.randomUUID();
  const all = readAll(ownerId);
  all.push(emptyProject(ownerId, id));
  writeAll(ownerId, all);
  return id;
}

export function updateLocalProject(
  ownerId: string,
  projectId: string,
  patch: Partial<Pick<ProjectDoc, "html" | "toolName" | "gradeBand" | "subject" | "topic" | "description" | "isPublished" | "publishedVersionId">>,
): LocalProject {
  const all = readAll(ownerId);
  const i = all.findIndex((p) => p.id === projectId);
  if (i < 0) throw new Error("Project not found.");
  if (all[i].ownerId !== ownerId) throw new Error("Not allowed.");
  const next: LocalProject = {
    ...all[i],
    ...patch,
    classId: CLASS_ID,
    updatedAt: Date.now(),
  };
  all[i] = next;
  writeAll(ownerId, all);
  return next;
}

export function deleteLocalProject(ownerId: string, projectId: string): void {
  const all = readAll(ownerId).filter((p) => p.id !== projectId);
  writeAll(ownerId, all);
}

export function clearLocalProjectsForUser(ownerId: string): void {
  localStorage.removeItem(storageKey(ownerId));
}
