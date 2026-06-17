import { z } from "zod";

export const noBodySchema = z.object({}).strict();
export const emptyBodySchema = noBodySchema;
