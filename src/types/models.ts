export type UserRole = "student" | "instructor";

export type UserProfile = {
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: number;
};

export type ClassDoc = {
  name: string;
  instructorId: string;
  joinCode: string;
  createdAt: number;
};

export type JoinLinkDoc = {
  classId: string;
  className: string;
};

export type ClassMember = {
  userId: string;
  displayName: string;
  joinedAt: number;
};

export type ProjectDoc = {
  ownerId: string;
  /** When set, project counts as submitted to this class */
  classId: string | null;
  toolName: string;
  gradeBand: string;
  subject: string;
  topic: string;
  description: string;
  /** Current draft HTML */
  html: string;
  isPublished: boolean;
  /** Snapshot id last published (optional) */
  publishedVersionId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ProjectVersionDoc = {
  html: string;
  label: "save" | "publish";
  createdAt: number;
};
