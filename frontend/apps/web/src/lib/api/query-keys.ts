import { withQueryHost } from "./query-host";

/**
 * Tenant-scoped React Query keys. Client hooks append host scope via `withQueryHost`.
 */
export const queryKeys = {
  root: ["atlas"] as const,

  me: (host?: string) => withQueryHost([...queryKeys.root, "me"] as const, host),

  notifications: (params?: { limit?: number }, host?: string) =>
    withQueryHost([...queryKeys.root, "notifications", params ?? {}] as const, host),

  courses: {
    all: (host?: string) => withQueryHost([...queryKeys.root, "courses"] as const, host),
    detail: (courseId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "courses", courseId] as const, host),
  },

  learningPaths: {
    all: (host?: string) => withQueryHost([...queryKeys.root, "learning-paths"] as const, host),
    detail: (pathId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "learning-paths", pathId] as const, host),
  },

  assessments: {
    all: (host?: string) => withQueryHost([...queryKeys.root, "assessments"] as const, host),
    detail: (assessmentId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "assessments", assessmentId] as const, host),
    attempt: (attemptId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "attempts", attemptId] as const, host),
  },

  community: {
    spaces: (host?: string) => withQueryHost([...queryKeys.root, "community", "spaces"] as const, host),
    space: (spaceId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "community", "spaces", spaceId] as const, host),
    post: (postId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "community", "posts", postId] as const, host),
  },

  admin: {
    members: (host?: string) => withQueryHost([...queryKeys.root, "admin", "members"] as const, host),
    roles: (host?: string) => withQueryHost([...queryKeys.root, "admin", "roles"] as const, host),
    branding: (host?: string) => withQueryHost([...queryKeys.root, "admin", "branding"] as const, host),
  },

  studio: {
    courses: (host?: string) => withQueryHost([...queryKeys.root, "studio", "courses"] as const, host),
    course: (courseId: string, host?: string) =>
      withQueryHost([...queryKeys.root, "studio", "courses", courseId] as const, host),
  },

  platform: {
    shell: (host?: string) => withQueryHost([...queryKeys.root, "platform", "shell"] as const, host),
  },
} as const;
