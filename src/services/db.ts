import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "@/firebase";
import type {
  ClassDoc,
  ClassMember,
  JoinLinkDoc,
  ProjectDoc,
  ProjectVersionDoc,
  UserProfile,
  UserRole,
} from "@/types/models";

const COL = {
  users: "users",
  classes: "classes",
  joinLinks: "joinLinks",
  members: "members",
  userClasses: "userClasses",
  projects: "projects",
  versions: "versions",
  publicProjects: "publicProjects",
} as const;

function db(): Firestore {
  return getDb();
}

function randJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  role: UserRole,
): Promise<void> {
  const ref = doc(db(), COL.users, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile: UserProfile = {
      displayName,
      email,
      role,
      createdAt: Date.now(),
    };
    await setDoc(ref, profile);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db(), COL.users, uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function createClass(instructorId: string, name: string) {
  const joinCode = randJoinCode();
  const classRef = doc(collection(db(), COL.classes));
  const classId = classRef.id;
  const batch = writeBatch(db());
  const classDoc: ClassDoc = {
    name,
    instructorId,
    joinCode,
    createdAt: Date.now(),
  };
  batch.set(classRef, classDoc);
  const link: JoinLinkDoc = { classId, className: name };
  batch.set(doc(db(), COL.joinLinks, joinCode), link);
  batch.set(doc(db(), COL.userClasses, instructorId, "items", classId), {
    classId,
    className: name,
    role: "instructor" as const,
    joinedAt: Date.now(),
  });
  await batch.commit();
  return { classId, joinCode };
}

export async function joinClassWithCode(
  userId: string,
  displayName: string,
  joinCodeRaw: string,
): Promise<{ classId: string; className: string }> {
  const code = joinCodeRaw.trim().toUpperCase();
  const linkSnap = await getDoc(doc(db(), COL.joinLinks, code));
  if (!linkSnap.exists()) throw new Error("Invalid join code.");
  const link = linkSnap.data() as JoinLinkDoc;
  const classId = link.classId;
  const memberRef = doc(db(), COL.classes, classId, COL.members, userId);
  const existing = await getDoc(memberRef);
  if (existing.exists()) {
    return { classId, className: link.className };
  }
  const member: ClassMember = { userId, displayName, joinedAt: Date.now() };
  const batch = writeBatch(db());
  batch.set(memberRef, member);
  batch.set(doc(db(), COL.userClasses, userId, "items", classId), {
    classId,
    className: link.className,
    role: "student" as const,
    joinedAt: Date.now(),
  });
  await batch.commit();
  return { classId, className: link.className };
}

export type UserClassItem = {
  id: string;
  classId: string;
  className: string;
  role: "student" | "instructor";
  joinedAt: number;
};

export async function listMyClasses(userId: string): Promise<UserClassItem[]> {
  const q = query(collection(db(), COL.userClasses, userId, "items"), orderBy("joinedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as DocumentData;
    return {
      id: d.id,
      classId: String(data.classId ?? d.id),
      className: String(data.className ?? ""),
      role: data.role === "instructor" ? "instructor" : "student",
      joinedAt: typeof data.joinedAt === "number" ? data.joinedAt : 0,
    };
  });
}

export async function getClass(classId: string): Promise<ClassDoc | null> {
  const snap = await getDoc(doc(db(), COL.classes, classId));
  if (!snap.exists()) return null;
  return snap.data() as ClassDoc;
}

export async function isClassMember(classId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db(), COL.classes, classId, COL.members, userId));
  return snap.exists();
}

export async function listClassMembers(classId: string): Promise<ClassMember[]> {
  const snap = await getDocs(collection(db(), COL.classes, classId, COL.members));
  return snap.docs.map((d) => d.data() as ClassMember);
}

export async function countSubmittedProjectsForStudent(classId: string, studentId: string) {
  const q = query(
    collection(db(), COL.projects),
    where("classId", "==", classId),
    where("ownerId", "==", studentId),
  );
  const snap = await getDocs(q);
  return snap.size;
}

export async function deleteStudentFromClass(
  instructorId: string,
  classId: string,
  studentId: string,
) {
  const cls = await getClass(classId);
  if (!cls || cls.instructorId !== instructorId) throw new Error("Not allowed.");

  const projSnap = await getDocs(
    query(collection(db(), COL.projects), where("classId", "==", classId), where("ownerId", "==", studentId)),
  );

  let batch = writeBatch(db());
  let n = 0;
  for (const p of projSnap.docs) {
    const vers = await getDocs(collection(db(), COL.projects, p.id, COL.versions));
    for (const v of vers.docs) {
      batch.delete(v.ref);
      n++;
      if (n >= 400) {
        await batch.commit();
        batch = writeBatch(db());
        n = 0;
      }
    }
    batch.delete(p.ref);
    batch.delete(doc(db(), COL.publicProjects, p.id));
    n += 2;
    if (n >= 400) {
      await batch.commit();
      batch = writeBatch(db());
      n = 0;
    }
  }
  batch.delete(doc(db(), COL.classes, classId, COL.members, studentId));
  batch.delete(doc(db(), COL.userClasses, studentId, "items", classId));
  await batch.commit();
}

/** Removes the class, join link, roster enrollments, instructor link, and all class-linked projects. */
export async function deleteClass(instructorId: string, classId: string) {
  const cls = await getClass(classId);
  if (!cls || cls.instructorId !== instructorId) throw new Error("Not allowed.");

  const joinCode = cls.joinCode;

  const projSnap = await getDocs(query(collection(db(), COL.projects), where("classId", "==", classId)));

  let batch = writeBatch(db());
  let n = 0;
  for (const p of projSnap.docs) {
    const vers = await getDocs(collection(db(), COL.projects, p.id, COL.versions));
    for (const v of vers.docs) {
      batch.delete(v.ref);
      n++;
      if (n >= 450) {
        await batch.commit();
        batch = writeBatch(db());
        n = 0;
      }
    }
    batch.delete(p.ref);
    batch.delete(doc(db(), COL.publicProjects, p.id));
    n += 2;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db());
      n = 0;
    }
  }

  const memberSnap = await getDocs(collection(db(), COL.classes, classId, COL.members));
  for (const m of memberSnap.docs) {
    batch.delete(m.ref);
    batch.delete(doc(db(), COL.userClasses, m.id, "items", classId));
    n += 2;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db());
      n = 0;
    }
  }

  batch.delete(doc(db(), COL.joinLinks, joinCode));
  batch.delete(doc(db(), COL.userClasses, instructorId, "items", classId));
  batch.delete(doc(db(), COL.classes, classId));
  await batch.commit();
}

const emptyProject = (): Omit<ProjectDoc, "ownerId"> => ({
  classId: null,
  toolName: "",
  gradeBand: "",
  subject: "",
  topic: "",
  description: "",
  html: "<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"><title>My page</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n",
  isPublished: false,
  publishedVersionId: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export async function createProject(ownerId: string) {
  const ref = await addDoc(collection(db(), COL.projects), {
    ...emptyProject(),
    ownerId,
  });
  return ref.id;
}

export async function getProject(projectId: string): Promise<(ProjectDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db(), COL.projects, projectId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as ProjectDoc) };
}

export async function listMyProjects(ownerId: string) {
  const q = query(
    collection(db(), COL.projects),
    where("ownerId", "==", ownerId),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectDoc) }));
}

export async function listProjectsForClass(classId: string) {
  const q = query(collection(db(), COL.projects), where("classId", "==", classId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectDoc) }));
}

export async function updateProject(
  ownerId: string,
  projectId: string,
  patch: Partial<
    Pick<
      ProjectDoc,
      | "html"
      | "toolName"
      | "gradeBand"
      | "subject"
      | "topic"
      | "description"
      | "classId"
    >
  >,
) {
  const p = await getProject(projectId);
  if (!p || p.ownerId !== ownerId) throw new Error("Not allowed.");
  const ref = doc(db(), COL.projects, projectId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: Date.now(),
  });
  if (p.isPublished) {
    const pubRef = doc(db(), COL.publicProjects, projectId);
    const pubSnap = await getDoc(pubRef);
    if (pubSnap.exists()) {
      const after = await getProject(projectId);
      if (!after) return;
      await updateDoc(pubRef, {
        html: after.html,
        toolName: after.toolName,
        gradeBand: after.gradeBand,
        subject: after.subject,
        topic: after.topic,
        description: after.description,
        classId: after.classId,
        updatedAt: Date.now(),
      });
    }
  }
}

export async function saveVersion(
  ownerId: string,
  projectId: string,
  html: string,
  label: ProjectVersionDoc["label"],
) {
  const p = await getProject(projectId);
  if (!p || p.ownerId !== ownerId) throw new Error("Not found.");
  await addDoc(collection(db(), COL.projects, projectId, COL.versions), {
    html,
    label,
    createdAt: Date.now(),
  } satisfies ProjectVersionDoc);
}

export async function listVersions(projectId: string, ownerId: string) {
  const p = await getProject(projectId);
  if (!p || p.ownerId !== ownerId) return [];
  const q = query(
    collection(db(), COL.projects, projectId, COL.versions),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectVersionDoc) }));
}

export async function publishProject(ownerId: string, projectId: string, ownerDisplayName: string) {
  const ref = doc(db(), COL.projects, projectId);
  const verRef = doc(collection(db(), COL.projects, projectId, COL.versions));
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Missing project.");
    const data = snap.data() as ProjectDoc;
    if (data.ownerId !== ownerId) throw new Error("Not allowed.");
    const version: ProjectVersionDoc = { html: data.html, label: "publish", createdAt: Date.now() };
    tx.set(verRef, version);
    tx.update(ref, {
      isPublished: true,
      publishedVersionId: verRef.id,
      updatedAt: Date.now(),
    });
    tx.set(doc(db(), COL.publicProjects, projectId), {
      html: data.html,
      toolName: data.toolName,
      gradeBand: data.gradeBand,
      subject: data.subject,
      topic: data.topic,
      description: data.description,
      ownerId,
      ownerDisplayName: ownerDisplayName || "Student",
      classId: data.classId,
      updatedAt: Date.now(),
    });
  });
}

export async function unpublishProject(ownerId: string, projectId: string) {
  const ref = doc(db(), COL.projects, projectId);
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Missing project.");
    const data = snap.data() as ProjectDoc;
    if (data.ownerId !== ownerId) throw new Error("Not allowed.");
    tx.update(ref, { isPublished: false, publishedVersionId: null, updatedAt: Date.now() });
    tx.delete(doc(db(), COL.publicProjects, projectId));
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
  classId?: string | null;
  updatedAt?: number;
};

export type ClassPublishedProject = PublicProjectView & { id: string };

export async function listPublishedProjectsForClass(classId: string): Promise<ClassPublishedProject[]> {
  const q = query(
    collection(db(), COL.publicProjects),
    where("classId", "==", classId),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as PublicProjectView) }));
}

export async function getPublicProject(projectId: string): Promise<PublicProjectView | null> {
  const snap = await getDoc(doc(db(), COL.publicProjects, projectId));
  if (!snap.exists()) return null;
  return snap.data() as PublicProjectView;
}

export async function deleteProject(ownerId: string, projectId: string) {
  const p = await getProject(projectId);
  if (!p || p.ownerId !== ownerId) throw new Error("Not allowed.");
  const vers = await getDocs(collection(db(), COL.projects, projectId, COL.versions));
  let batch = writeBatch(db());
  let n = 0;
  for (const v of vers.docs) {
    batch.delete(v.ref);
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db());
      n = 0;
    }
  }
  batch.delete(doc(db(), COL.projects, projectId));
  batch.delete(doc(db(), COL.publicProjects, projectId));
  await batch.commit();
}

export async function instructorDeleteProject(instructorId: string, projectId: string) {
  const p = await getProject(projectId);
  if (!p || !p.classId) throw new Error("Not found.");
  const cls = await getClass(p.classId);
  if (!cls || cls.instructorId !== instructorId) throw new Error("Not allowed.");
  const vers = await getDocs(collection(db(), COL.projects, projectId, COL.versions));
  let batch = writeBatch(db());
  let n = 0;
  for (const v of vers.docs) {
    batch.delete(v.ref);
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db());
      n = 0;
    }
  }
  batch.delete(doc(db(), COL.projects, projectId));
  batch.delete(doc(db(), COL.publicProjects, projectId));
  await batch.commit();
}
