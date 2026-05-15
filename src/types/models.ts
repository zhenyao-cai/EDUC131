export type ClassDoc = {
  name: string;
  createdAt: number;
};

export type ClassMember = {
  userId: string;
  displayName: string;
  joinedAt: number;
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
