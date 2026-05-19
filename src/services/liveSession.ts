import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { CLASS_ID } from "@/constants/site";
import { getDb } from "@/firebase";
import type { LiveSessionState, ProjectCommentDoc, UserVotesDoc } from "@/types/models";
import { ensureDefaultClass } from "@/services/db";

export const MAX_VOTES_PER_USER = 5;

const COL = {
  classes: "classes",
  publicProjects: "publicProjects",
  userVotes: "userVotes",
  comments: "comments",
} as const;

function db() {
  return getDb();
}

export function defaultLiveSession(): LiveSessionState {
  return { votingEnabled: false, discussionEnabled: false };
}

export function subscribeLiveSession(onChange: (state: LiveSessionState) => void): Unsubscribe {
  const ref = doc(db(), COL.classes, CLASS_ID);
  return onSnapshot(ref, (snap) => {
    const data = snap.data();
    onChange({
      votingEnabled: data?.votingEnabled === true,
      discussionEnabled: data?.discussionEnabled === true,
    });
  });
}

export async function instructorStartLiveSession(): Promise<void> {
  await ensureDefaultClass();
  await updateDoc(doc(db(), COL.classes, CLASS_ID), {
    votingEnabled: true,
    discussionEnabled: true,
    liveSessionUpdatedAt: Date.now(),
  });
}

export async function instructorEnableVoting(): Promise<void> {
  await ensureDefaultClass();
  await updateDoc(doc(db(), COL.classes, CLASS_ID), {
    votingEnabled: true,
    liveSessionUpdatedAt: Date.now(),
  });
}

export async function instructorDisableVoting(): Promise<void> {
  await ensureDefaultClass();
  await updateDoc(doc(db(), COL.classes, CLASS_ID), {
    votingEnabled: false,
    liveSessionUpdatedAt: Date.now(),
  });
}

export async function instructorEnableDiscussion(): Promise<void> {
  await ensureDefaultClass();
  await updateDoc(doc(db(), COL.classes, CLASS_ID), {
    discussionEnabled: true,
    liveSessionUpdatedAt: Date.now(),
  });
}

export async function instructorDisableDiscussion(): Promise<void> {
  await ensureDefaultClass();
  await updateDoc(doc(db(), COL.classes, CLASS_ID), {
    discussionEnabled: false,
    liveSessionUpdatedAt: Date.now(),
  });
}

export async function instructorHideLiveSession(): Promise<void> {
  await ensureDefaultClass();
  await updateDoc(doc(db(), COL.classes, CLASS_ID), {
    votingEnabled: false,
    discussionEnabled: false,
    liveSessionUpdatedAt: Date.now(),
  });
}

export function subscribeProjectVoteCount(projectId: string, onChange: (count: number) => void): Unsubscribe {
  const ref = doc(db(), COL.publicProjects, projectId);
  return onSnapshot(ref, (snap) => {
    const n = snap.data()?.voteCount;
    onChange(typeof n === "number" && n > 0 ? n : 0);
  });
}

export function subscribeMyVotes(userId: string, onChange: (projectIds: Set<string>) => void): Unsubscribe {
  const ref = doc(db(), COL.userVotes, userId);
  return onSnapshot(ref, (snap) => {
    const ids = snap.data()?.projectIds;
    onChange(new Set(Array.isArray(ids) ? ids : []));
  });
}

export function subscribeGalleryVoteCounts(onChange: (counts: Map<string, number>) => void): Unsubscribe {
  const q = query(collection(db(), COL.publicProjects), where("classId", "==", CLASS_ID));
  return onSnapshot(q, (snap) => {
    const m = new Map<string, number>();
    for (const d of snap.docs) {
      const n = d.data().voteCount;
      m.set(d.id, typeof n === "number" && n > 0 ? n : 0);
    }
    onChange(m);
  });
}

/** Toggle vote on a project (like / unlike). Max 5 projects per user. */
export async function toggleProjectVote(userId: string, projectId: string): Promise<void> {
  const userVotesRef = doc(db(), COL.userVotes, userId);
  const projectRef = doc(db(), COL.publicProjects, projectId);

  await runTransaction(db(), async (tx) => {
    const [userSnap, projectSnap] = await Promise.all([tx.get(userVotesRef), tx.get(projectRef)]);
    if (!projectSnap.exists()) throw new Error("Project not found.");
    if (projectSnap.data()?.classId !== CLASS_ID) throw new Error("Not allowed.");

    const data = userSnap.data() as UserVotesDoc | undefined;
    const projectIds = Array.isArray(data?.projectIds) ? [...data.projectIds] : [];
    const currentCount = typeof projectSnap.data()?.voteCount === "number" ? projectSnap.data()!.voteCount : 0;
    const idx = projectIds.indexOf(projectId);

    if (idx >= 0) {
      projectIds.splice(idx, 1);
      tx.set(
        userVotesRef,
        { classId: CLASS_ID, projectIds, updatedAt: Date.now() } satisfies UserVotesDoc,
        { merge: true },
      );
      tx.update(projectRef, { voteCount: Math.max(0, currentCount - 1) });
      return;
    }

    if (projectIds.length >= MAX_VOTES_PER_USER) {
      throw new Error(`You can only vote for up to ${MAX_VOTES_PER_USER} projects. Remove a vote first.`);
    }

    projectIds.push(projectId);
    tx.set(userVotesRef, { classId: CLASS_ID, projectIds, updatedAt: Date.now() } satisfies UserVotesDoc, {
      merge: true,
    });
    tx.update(projectRef, { voteCount: currentCount + 1 });
  });
}

export function subscribeProjectComments(
  projectId: string,
  onChange: (comments: Array<{ id: string } & ProjectCommentDoc>) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COL.publicProjects, projectId, COL.comments),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectCommentDoc) })));
  });
}

export async function postProjectComment(
  userId: string,
  displayName: string,
  projectId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");
  if (trimmed.length > 500) throw new Error("Comment is too long.");

  const projectSnap = await getDoc(doc(db(), COL.publicProjects, projectId));
  if (!projectSnap.exists()) throw new Error("Project not found.");

  const comment: ProjectCommentDoc = {
    projectId,
    userId,
    displayName: displayName.trim() || "Guest",
    text: trimmed,
    classId: CLASS_ID,
    createdAt: Date.now(),
  };
  await addDoc(collection(db(), COL.publicProjects, projectId, COL.comments), comment);
}

export async function deleteProjectComment(projectId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db(), COL.publicProjects, projectId, COL.comments, commentId));
}

export async function ensurePublicProjectVoteCount(projectId: string): Promise<void> {
  const ref = doc(db(), COL.publicProjects, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (typeof snap.data()?.voteCount !== "number") {
    await updateDoc(ref, { voteCount: 0 });
  }
}
