import z from "zod";

const opportunitySchema = z.object({
  id: z.string(),
  title: z.string().default("Opportunity"),
  account: z.string(),
  stage: z.string(),
  priority: z.number(),
  health: z.string(),
  value: z.string(),
  probability: z.number().min(0).max(1).default(0),
});

export const opportunitiesSchema = z.array(opportunitySchema);

export type OpportunityRow = z.infer<typeof opportunitySchema>;
