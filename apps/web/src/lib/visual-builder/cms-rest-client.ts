import { z } from "zod";

export type CmsPageRecord = { id: string; slug: string; title: string; body?: string; blocks?: unknown[]; version?: number };
export type CmsComponentRecord = { id: string; name: string; version: number; markup?: string; props: unknown[]; slots: unknown[]; variants: unknown[] };
export type CmsSaveResult<T> = { data: T; correlationId?: string };
export type CmsTransport = (input: string | URL, init?: { method?: string; credentials?: "include" | "omit" | "same-origin"; headers?: Record<string, string>; body?: string }) => Promise<Response>;

const pageSchema = z.object({ id: z.string(), slug: z.string(), title: z.string(), body: z.string().optional(), blocks: z.array(z.unknown()).optional(), version: z.number().optional() }).passthrough();
const componentSchema = z.object({ id: z.string(), name: z.string(), version: z.number(), props: z.array(z.unknown()), slots: z.array(z.unknown()), variants: z.array(z.unknown()) }).passthrough();
const componentSaveSchema = z.object({ definition: z.unknown(), version: z.number().optional() }).passthrough();

async function json<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error(`CMS request failed (${response.status})`);
  if (payload && typeof payload === "object" && "data" in payload) {
    return schema.parse((payload as { data: unknown }).data);
  }
  return schema.parse(payload);
}

export class UvsCmsClient {
  constructor(private readonly transport: CmsTransport, private readonly baseUrl = "") {}
  private url(path: string): string { return `${this.baseUrl}${path}`; }
  async listPages(): Promise<readonly CmsPageRecord[]> {
    const response = await this.transport(this.url("/api/admin/cms/pages"), { credentials: "include" });
    const payload = await json(response, z.union([z.array(pageSchema), z.object({ data: z.array(pageSchema) })]));
    return Array.isArray(payload) ? payload : payload.data;
  }
  async savePage(pageId: string, body: unknown, expectedVersion: number, idempotencyKey: string): Promise<CmsSaveResult<CmsPageRecord>> {
    const response = await this.transport(this.url(`/api/admin/cms/pages/${encodeURIComponent(pageId)}`), { method: "PUT", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey, "if-match": String(expectedVersion) }, body: JSON.stringify(body) });
    return { data: await json(response, pageSchema) };
  }
  async createPage(body: unknown, idempotencyKey: string): Promise<CmsSaveResult<CmsPageRecord>> {
    const response = await this.transport(this.url("/api/admin/cms/pages"), { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(body) });
    return { data: await json(response, pageSchema) };
  }
  async listComponents(): Promise<readonly CmsComponentRecord[]> {
    const response = await this.transport(this.url("/api/admin/cms/components"), { credentials: "include" });
    const payload = await json(response, z.union([z.array(componentSchema), z.object({ data: z.array(componentSchema) })]));
    return Array.isArray(payload) ? payload : payload.data;
  }
  async saveComponent(definition: CmsComponentRecord, expectedVersion: number, idempotencyKey: string): Promise<CmsSaveResult<CmsComponentRecord>> {
    const response = await this.transport(this.url(`/api/admin/cms/components/${encodeURIComponent(definition.id)}`), { method: "PATCH", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey, "if-match": String(expectedVersion) }, body: JSON.stringify({ definition, expectedVersion }) });
    return { data: await json(response, componentSchema) };
  }
  async saveComponentDefinition(definition: unknown, expectedVersion: number | undefined, idempotencyKey: string): Promise<{ definition: unknown; version?: number }> {
    const response = await this.transport(this.url("/api/admin/cms/components"), { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ definition, ...(expectedVersion ? { expectedVersion } : {}) }) });
    return json(response, componentSaveSchema) as Promise<{ definition: unknown; version?: number }>;
  }
  async publishComponent(componentId: string, expectedVersion: number, idempotencyKey: string): Promise<unknown> {
    const response = await this.transport(this.url(`/api/admin/cms/components/${encodeURIComponent(componentId)}`), { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ action: "publish", expectedVersion }) });
    return json(response, z.unknown());
  }
}
