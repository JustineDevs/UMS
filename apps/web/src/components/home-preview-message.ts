import { z } from "zod";
import type { CmsBlock, CmsComponentInstance, CmsNode } from "@universal-music-store/platform-data";

const recordSchema = z.record(z.string(), z.unknown());

const componentInstanceSchema: z.ZodType<CmsComponentInstance> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(200),
    componentId: z.string().min(1).max(200),
    variantId: z.string().max(200).optional(),
    props: recordSchema,
    slots: z.record(z.array(componentInstanceSchema)),
    styleOverrides: z.record(z.string().max(2_000)).optional(),
    lockedStructure: z.boolean().optional(),
  }),
);

const cmsNodeSchema: z.ZodType<CmsNode> = z.object({
  id: z.string().min(1).max(200),
  componentId: z.string().min(1).max(200),
  parentId: z.string().max(200).nullable(),
  slot: z.string().max(200).nullable(),
  props: recordSchema,
  styles: z.record(z.string().max(2_000)),
  children: z.array(z.string().min(1).max(200)).max(1_000),
  variantId: z.string().max(200).optional(),
  blockType: z.string().max(200).optional(),
  lockedStructure: z.boolean().optional(),
});

const cmsBlockSchema: z.ZodType<CmsBlock> = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(200),
  props: recordSchema,
  componentId: z.string().max(200).optional(),
  variantId: z.string().max(200).optional(),
  slots: z.record(z.array(componentInstanceSchema)).optional(),
  styleOverrides: z.record(z.string().max(2_000)).optional(),
});

const homePreviewMessageSchema = z.object({
  source: z.literal("cms-builder-draft"),
  mode: z.literal("home"),
  tree: z.array(cmsNodeSchema).max(1_000).optional(),
  blocks: z.array(cmsBlockSchema).max(1_000).optional(),
}).refine((message) => message.tree !== undefined || message.blocks !== undefined);

export function parseHomePreviewMessage(value: unknown): {
  tree?: CmsNode[];
  blocks?: CmsBlock[];
} | null {
  const result = homePreviewMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}
