import { z } from "zod";

export const e2eAuthRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(512),
}).strict();

export const e2eAuthResponseSchema = z.object({ ok: z.literal(true) }).strict();
