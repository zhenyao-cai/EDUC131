export type ClassDoc = {
  name: string;
  createdAt: number;
  votingEnabled?: boolean;
  discussionEnabled?: boolean;
  liveSessionUpdatedAt?: number;
};

export type LiveSessionState = {
  votingEnabled: boolean;
  discussionEnabled: boolean;
};

export type UserVotesDoc = {
  classId: string;
  projectIds: string[];
  updatedAt: number;
};

export type ProjectCommentDoc = {
  projectId: string;
  userId: string;
  displayName: string;
  text: string;
  classId: string;
  createdAt: number;
};

export type ClassMember = {
  userId: string;
  displayName: string;
  joinedAt: number;
  lastSeenAt: number;
  /** Set when instructor removes this visitor; they get a new anonymous id on next visit. */
  removedAt?: number | null;
};

export type ActivityType =
  | "visit"
  | "project_created"
  | "project_saved"
  | "project_published"
  | "project_unpublished"
  | "project_deleted"
  | "editor_opened";

export type ActivityDoc = {
  classId: string;
  userId: string;
  displayName: string;
  type: ActivityType;
  projectId?: string;
  projectName?: string;
  createdAt: number;
};

export type ProjectDoc = {
  ownerId: string;
  classId: string;
  toolName: string;
  gradeBand: string;
  subject: string;
  topic: string;
  description: string;
  html: string;
  isPublished: boolean;
  publishedVersionId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ProjectVersionDoc = {
  html: string;
  label: "save" | "publish";
  createdAt: number;
};

export type StudentProfile = {
  displayName: string;
  createdAt: number;
  lastSeenAt: number;
};
