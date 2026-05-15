import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/firebase";
import { CLASS_ID, CLASS_NAME } from "@/constants/site";
import {
  createLocalProject,
  deleteLocalProject,
  getLocalProject,
  listLocalProjects,
  updateLocalProject,
  type LocalProject,
} from "@/services/localProjects";
import type { ActivityDoc, ActivityType, ClassDoc, ClassMember, ProjectDoc, StudentProfile } from "@/types/models";

const COL = {
  students: "students",
  classes: "classes",
  members: "members",
  projects: "projects",
  publicProjects: "publicProjects",
  activities: "activities",
} as const;

/** Copy to Firestore so instructors can see all class work (students still edit via localStorage). */
export async function syncProjectMirror(project: LocalProject) {
  const { id, ...data } = project;
  await setDoc(doc(db(), COL.projects, id), data);
}

/** Push every local project to Firestore (e.g. after opening the app or before instructor review). */
export async function syncAllLocalProjectMirrors(ownerId: string) {
  const projects = listLocalProjects(ownerId);
  await Promise.all(projects.map((p) => syncProjectMirror(p)));
}

async function deleteProjectMirror(projectId: string) {
  await deleteDoc(doc(db(), COL.projects, projectId));
}

function db() {
  return getDb();
}

export async function ensureDefaultClass(): Promise<ClassDoc> {
  const ref = doc(db(), COL.classes, CLASS_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const classDoc: ClassDoc = { name: CLASS_NAME, createdAt: Date.now() };
    await setDoc(ref, classDoc);
    return classDoc;
  }
  return snap.data() as ClassDoc;
}

export async function getClass(): Promise<ClassDoc | null> {
  const snap = await getDoc(doc(db(), COL.classes, CLASS_ID));
  if (!snap.exists()) return null;
  return snap.data() as ClassDoc;
}

export async function updateStudentDisplayName(uid: string, displayName: string) {
  const trimmed = displayName.trim();
  const ref = doc(db(), COL.students, uid);
  const snap = await getDoc(ref);
  const now = Date.now();
  if (!snap.exists()) {
    await setDoc(ref, { displayName: trimmed, createdAt: now, lastSeenAt: now } satisfies StudentProfile);
  } else {
    await updateDoc(ref, { displayName: trimmed, lastSeenAt: now });
  }
  const memberRef = doc(db(), COL.classes, CLASS_ID, COL.members, uid);
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists() && !(memberSnap.data() as ClassMember).removedAt) {
    await updateDoc(memberRef, { displayName: trimmed });
  }

  const pubQ = query(collection(db(), COL.publicProjects), where("ownerId", "==", uid));
  const pubSnap = await getDocs(pubQ);
  await Promise.all(
    pubSnap.docs.map((d) => updateDoc(d.ref, { ownerDisplayName: trimmed })),
  );
}

export async function getClassMember(userId: string): Promise<ClassMember | null> {
  const snap = await getDoc(doc(db(), COL.classes, CLASS_ID, COL.members, userId));
  if (!snap.exists()) return null;
  return snap.data() as ClassMember;
}

export async function isMemberRemoved(userId: string): Promise<boolean> {
  const member = await getClassMember(userId);
  return member?.removedAt != null;
}

/** Add or update a student in the class roster (only after they choose a name). */
export async function ensureStudentInClass(userId: string, displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) return;

  await ensureDefaultClass();
  const now = Date.now();

  const memberRef = doc(db(), COL.classes, CLASS_ID, COL.members, userId);
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists()) {
    const existing = memberSnap.data() as ClassMember;
    if (existing.removedAt) return;
    await updateDoc(memberRef, { displayName: trimmed, lastSeenAt: now });
  } else {
    const member: ClassMember = { userId, displayName: trimmed, joinedAt: now, lastSeenAt: now };
    await setDoc(memberRef, member);
  }

  const studentRef = doc(db(), COL.students, userId);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) {
    await setDoc(studentRef, { displayName: trimmed, createdAt: now, lastSeenAt: now } satisfies StudentProfile);
  } else {
    await updateDoc(studentRef, { displayName: trimmed, lastSeenAt: now });
  }
}

async function deleteAllCloudProjectsForOwner(ownerId: string) {
  const [pubSnap, projSnap] = await Promise.all([
    getDocs(query(collection(db(), COL.publicProjects), where("ownerId", "==", ownerId))),
    getDocs(query(collection(db(), COL.projects), where("ownerId", "==", ownerId))),
  ]);
  await Promise.all([
    ...pubSnap.docs.map((d) => deleteDoc(d.ref)),
    ...projSnap.docs.map((d) => deleteDoc(d.ref)),
  ]);
}

/** Instructor: remove visitor from class; hide gallery; they return as a new anonymous user. */
export async function instructorRemoveMember(userId: string) {
  const now = Date.now();
  const memberRef = doc(db(), COL.classes, CLASS_ID, COL.members, userId);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return;

  await updateDoc(memberRef, { removedAt: now });
  await deleteAllCloudProjectsForOwner(userId);
}

export async function logActivity(
  input: Pick<ActivityDoc, "userId" | "displayName" | "type" | "projectId" | "projectName">,
) {
  await addDoc(collection(db(), COL.activities), {
    ...input,
    classId: CLASS_ID,
    createdAt: Date.now(),
  } satisfies ActivityDoc);
}

export async function listActivities(limitN = 200): Promise<Array<{ id: string } & ActivityDoc>> {
  const q = query(collection(db(), COL.activities), where("classId", "==", CLASS_ID));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ActivityDoc) }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limitN);
}

function isNamedMember(m: ClassMember): boolean {
  const name = m.displayName?.trim();
  return Boolean(name && name !== "(not named yet)");
}

export async function listClassMembers(opts?: { includeRemoved?: boolean }): Promise<ClassMember[]> {
  const snap = await getDocs(collection(db(), COL.classes, CLASS_ID, COL.members));
  let rows = snap.docs.map((d) => d.data() as ClassMember).filter(isNamedMember);
  if (!opts?.includeRemoved) rows = rows.filter((m) => !m.removedAt);
  return rows.sort((a, b) => (b.lastSeenAt ?? b.joinedAt) - (a.lastSeenAt ?? a.joinedAt));
}

export async function getRemovedMemberIds(): Promise<Set<string>> {
  const snap = await getDocs(collection(db(), COL.classes, CLASS_ID, COL.members));
  const ids = new Set<string>();
  for (const d of snap.docs) {
    const m = d.data() as ClassMember;
    if (m.removedAt) ids.add(m.userId);
  }
  return ids;
}

/** Projects live in this browser's localStorage — only the owner can read or edit them. */
export async function createProject(ownerId: string, displayName: string): Promise<string> {
  const id = createLocalProject(ownerId);
  const created = getLocalProject(ownerId, id);
  if (created) await syncProjectMirror(created);
  await logActivity({
    userId: ownerId,
    displayName,
    type: "project_created",
    projectId: id,
    projectName: "",
  });
  return id;
}

export function getProject(ownerId: string, projectId: string): LocalProject | null {
  return getLocalProject(ownerId, projectId);
}

export function listMyProjects(ownerId: string): LocalProject[] {
  return listLocalProjects(ownerId);
}

export async function updateProject(
  ownerId: string,
  projectId: string,
  displayName: string,
  patch: Partial<Pick<ProjectDoc, "html" | "toolName" | "gradeBand" | "subject" | "topic" | "description">>,
  activityType: ActivityType = "project_saved",
) {
  const before = getLocalProject(ownerId, projectId);
  if (!before) throw new Error("Not allowed.");
  const after = updateLocalProject(ownerId, projectId, patch);
  await syncProjectMirror(after);

  if (after.isPublished) {
    const pubRef = doc(db(), COL.publicProjects, projectId);
    const pubSnap = await getDoc(pubRef);
    if (pubSnap.exists()) {
      await updateDoc(pubRef, {
        html: after.html,
        toolName: after.toolName,
        gradeBand: after.gradeBand,
        subject: after.subject,
        topic: after.topic,
        description: after.description,
        classId: CLASS_ID,
        updatedAt: Date.now(),
      });
    }
  }

  await logActivity({
    userId: ownerId,
    displayName,
    type: activityType,
    projectId,
    projectName: patch.toolName ?? before.toolName,
  });
}

export async function publishProject(ownerId: string, projectId: string, ownerDisplayName: string) {
  if (await isMemberRemoved(ownerId)) throw new Error("You no longer have access to publish.");
  const data = getLocalProject(ownerId, projectId);
  if (!data || data.ownerId !== ownerId) throw new Error("Not allowed.");

  await syncProjectMirror(data);

  await setDoc(doc(db(), COL.publicProjects, projectId), {
    html: data.html,
    toolName: data.toolName,
    gradeBand: data.gradeBand,
    subject: data.subject,
    topic: data.topic,
    description: data.description,
    ownerId,
    ownerDisplayName: ownerDisplayName || "Student",
    classId: CLASS_ID,
    updatedAt: Date.now(),
  });

  const published = updateLocalProject(ownerId, projectId, { isPublished: true, publishedVersionId: projectId });
  await syncProjectMirror(published);

  await logActivity({
    userId: ownerId,
    displayName: ownerDisplayName,
    type: "project_published",
    projectId,
    projectName: data.toolName,
  });
}

export async function unpublishProject(ownerId: string, projectId: string, displayName: string) {
  const data = getLocalProject(ownerId, projectId);
  if (!data || data.ownerId !== ownerId) throw new Error("Not allowed.");

  await deleteDoc(doc(db(), COL.publicProjects, projectId));
  const draft = updateLocalProject(ownerId, projectId, { isPublished: false, publishedVersionId: null });
  await syncProjectMirror(draft);

  await logActivity({
    userId: ownerId,
    displayName,
    type: "project_unpublished",
    projectId,
    projectName: data.toolName,
  });
}

export type PublicProjectView = {
  html: string;
  toolName: string;
  gradeBand: string;
  subject: string;
  topic: string;
  description: string;
  ownerId?: string;
  ownerDisplayName?: string;
  classId?: string;
  updatedAt?: number;
};

export type ClassPublishedProject = PublicProjectView & { id: string };

/** Gallery: all published projects from every student (Firestore). */
export async function listPublishedProjectsForClass(): Promise<ClassPublishedProject[]> {
  const removed = await getRemovedMemberIds();
  const q = query(
    collection(db(), COL.publicProjects),
    where("classId", "==", CLASS_ID),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as PublicProjectView) }))
    .filter((p) => !p.ownerId || !removed.has(p.ownerId));
}

/** Instructor: all projects synced from student browsers (drafts + published). */
export async function listProjectsForClass(): Promise<Array<{ id: string } & ProjectDoc>> {
  const removed = await getRemovedMemberIds();
  const q = query(collection(db(), COL.projects), where("classId", "==", CLASS_ID));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ProjectDoc) }))
    .filter((p) => !removed.has(p.ownerId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPublicProject(projectId: string): Promise<PublicProjectView | null> {
  const snap = await getDoc(doc(db(), COL.publicProjects, projectId));
  if (!snap.exists()) return null;
  const data = snap.data() as PublicProjectView;
  if (data.ownerId && (await isMemberRemoved(data.ownerId))) return null;
  return data;
}

export async function deleteProject(ownerId: string, projectId: string, displayName: string) {
  const p = getLocalProject(ownerId, projectId);
  if (!p || p.ownerId !== ownerId) throw new Error("Not allowed.");
  const toolName = p.toolName;

  if (p.isPublished) {
    await deleteDoc(doc(db(), COL.publicProjects, projectId));
  }
  await deleteProjectMirror(projectId);
  deleteLocalProject(ownerId, projectId);

  await logActivity({
    userId: ownerId,
    displayName,
    type: "project_deleted",
    projectId,
    projectName: toolName,
  });
}

/** Removes cloud copies (student's local copy on their device is unchanged). */
export async function instructorDeleteProject(projectId: string) {
  await deleteDoc(doc(db(), COL.publicProjects, projectId));
  await deleteProjectMirror(projectId);
}
