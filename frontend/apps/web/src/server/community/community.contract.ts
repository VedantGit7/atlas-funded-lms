// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { z } from "zod";
import type {
  createCommentBodySchema,
  createPostBodySchema,
  createReactionBodySchema,
  createSpaceBodySchema,
  deleteReactionBodySchema,
  deleteSpaceBodySchema,
  updateCommentBodySchema,
  updateSpaceBodySchema,
} from "./community.dto";

export type CreateSpaceBody = z.output<typeof createSpaceBodySchema>;
export type UpdateSpaceBody = z.output<typeof updateSpaceBodySchema>;
export type DeleteSpaceBody = z.output<typeof deleteSpaceBodySchema>;
export type CreatePostBody = z.output<typeof createPostBodySchema>;
export type CreateCommentBody = z.output<typeof createCommentBodySchema>;
export type UpdateCommentBody = z.output<typeof updateCommentBodySchema>;
export type CreateReactionBody = z.output<typeof createReactionBodySchema>;
export type DeleteReactionBody = z.output<typeof deleteReactionBodySchema>;
