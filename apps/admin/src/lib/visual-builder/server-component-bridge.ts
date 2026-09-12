import { z } from "zod";
import { sanitizeCmsHtml } from "@universal-music-store/validation";

const fieldSchema = z.object({ name: z.string().min(1).max(100), value: z.string().max(100_000) }).strict();
export const editorSaveRequestSchema = z.object({ component: z.string().min(1).max(100), id: z.string().min(1).max(100), expectedVersion: z.number().int().positive(), fields: z.array(fieldSchema).max(100) }).strict();
export type EditorSaveRequest = z.infer<typeof editorSaveRequestSchema>;
export type EditorSaveResponse = { html: string; version: number; id: string; component: string };

export function sanitizeEditorFields(fields: readonly z.infer<typeof fieldSchema>[]): z.infer<typeof fieldSchema>[] {
  return fields.flatMap((field) => {
    const name = field.name.trim().replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!name) return [];
    const value = /(^|\.)content$|(^|\.)excerpt$|html/i.test(name) ? sanitizeCmsHtml(field.value) : field.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    return [{ name, value }];
  });
}

export function createEditorSaveRequest(component: string, id: string, expectedVersion: number, fields: readonly z.infer<typeof fieldSchema>[]): EditorSaveRequest {
  return editorSaveRequestSchema.parse({ component, id, expectedVersion, fields: sanitizeEditorFields(fields) });
}

export function acceptEditorSaveResponse(value: unknown): EditorSaveResponse {
  return z.object({ html: z.string().max(100_000), version: z.number().int().positive(), id: z.string(), component: z.string() }).strict().parse(value);
}
