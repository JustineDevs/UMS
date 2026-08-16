import { z } from "zod";

const propSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: z.string().min(1).max(40),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.object({ label: z.string().max(120), value: z.string().max(200) }).strict()).max(100).optional(),
  htmlAttr: z.string().max(80).optional(),
  child: z.string().max(80).optional(),
  parent: z.string().max(80).optional(),
  section: z.enum(["content", "style", "advanced"]).optional(),
  sort: z.number().int().min(-1000).max(1000).optional(),
  inline: z.boolean().optional(),
  dataSource: z.string().max(200).optional(),
  responsive: z.boolean().optional(),
}).strict();

const variantSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  props: z.record(z.string().max(80), z.unknown()).optional(),
  styleTokens: z.record(z.string().max(80), z.string().max(500)).optional(),
}).strict();

const slotSchema = z.object({
  name: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  allowedComponentIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  multiple: z.boolean().optional(),
}).strict();

export const cmsComponentDefinitionSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(160),
  description: z.string().max(1000),
  category: z.string().min(1).max(80),
  version: z.number().int().positive().max(100000).default(1),
  structure: z.string().min(1).max(1000),
  markup: z.string().max(100_000).optional(),
  styles: z.string().max(100_000).optional(),
  styleTokens: z.record(z.string().max(80), z.string().max(1000)),
  props: z.array(propSchema).max(100),
  slots: z.array(slotSchema).max(50),
  variants: z.array(variantSchema).min(1).max(50),
  extendsComponentId: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  defaultVariantId: z.string().max(80).optional(),
  isGlobal: z.boolean().optional(),
  match: z.record(z.string().max(80), z.unknown()).optional(),
  resizable: z.boolean().optional(),
  responsive: z.boolean().optional(),
  toolbar: z.array(z.string().max(80)).max(30).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.markup && /<\s*script\b|javascript\s*:/i.test(value.markup)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["markup"], message: "Executable markup is not allowed" });
  }
  if (value.styles && /<\s*\/style\s*>|@import\b|expression\s*\(/i.test(value.styles)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["styles"], message: "Unsafe component CSS is not allowed" });
  }
  if (value.defaultVariantId && !value.variants.some((variant) => variant.id === value.defaultVariantId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["defaultVariantId"], message: "Unknown default variant" });
  }
});

export const cmsComponentWriteSchema = z.object({
  definition: cmsComponentDefinitionSchema,
  expectedVersion: z.number().int().positive().max(100000).optional(),
}).strict();

export const cmsComponentActionSchema = z.object({
  action: z.literal("publish"),
  expectedVersion: z.number().int().positive().max(100000),
}).strict();

const previewRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
}).strict();

const previewTargetSchema = z.object({
  id: z.string().min(1).max(200).nullable().optional(),
  blockId: z.string().min(1).max(200).nullable().optional(),
  label: z.string().max(200).optional(),
  rect: previewRectSchema.optional(),
  prop: z.string().max(80).optional(),
  value: z.string().max(100_000).optional(),
  tagName: z.string().max(40).optional(),
  text: z.string().max(2_000).optional(),
  href: z.string().max(2_000).optional(),
  src: z.string().max(2_000).optional(),
  style: z.record(z.string().max(80), z.string().max(1_000)).optional(),
  parentId: z.string().max(200).nullable().optional(),
  propertyKey: z.string().max(80).nullable().optional(),
  arrayIndex: z.number().int().nonnegative().nullable().optional(),
}).strict();

export const cmsPreviewMessageSchema = z.union(
  [
    z.object({ source: z.literal("cms-preview-ready") }).strict(),
    z.object({ source: z.literal("cms-builder-select"), id: z.string().max(200).nullable() }).strict(),
    z.object({ source: z.literal("cms-builder-draft"), mode: z.enum(["home", "page"]), pageBody: z.string().max(100_000), blocks: z.array(z.unknown()) }).strict(),
    z.object({ source: z.literal("cms-builder-mutation") }).merge(previewTargetSchema),
    z.object({ source: z.literal("cms-builder-dom-mutation") }).merge(previewTargetSchema),
    z.object({ source: z.literal("cms-builder-hover") }).merge(previewTargetSchema),
    z.object({ source: z.literal("cms-builder") }).merge(previewTargetSchema),
  ],
);
