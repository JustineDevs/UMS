import { serializeHtml } from "./builder-actions";

export type CanvasDocument = { body: { innerHTML: string }; head: { innerHTML: string } };
export type CanvasFrame = { addEventListener(type: "load" | "beforeunload" | "unload", listener: () => void): void; contentDocument: CanvasDocument | null };

export class CanvasController {
  document: CanvasDocument | null = null;
  loaded = false;
  constructor(private readonly frame: CanvasFrame) {}
  bootstrap(onReady: (document: CanvasDocument) => void): void {
    this.frame.addEventListener("load", () => { this.document = this.frame.contentDocument; this.loaded = this.document !== null; if (this.document) onReady(this.document); });
    this.frame.addEventListener("beforeunload", () => { this.loaded = false; });
    this.frame.addEventListener("unload", () => { this.document = null; this.loaded = false; });
  }
  setHtml(html: string): void { if (!this.document) throw new Error("Canvas is not loaded"); this.document.body.innerHTML = html; }
  getHtml(): string { if (!this.document) throw new Error("Canvas is not loaded"); return serializeHtml(`<head>${this.document.head.innerHTML}</head><body>${this.document.body.innerHTML}</body>`); }
}

export type TreeNode = { id: string; name: string; children: TreeNode[] };
export function buildNodeTree(nodes: readonly { id: string; name: string; children: readonly string[] }[], rootIds: readonly string[]): TreeNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visit = (id: string): TreeNode => { const node = byId.get(id); if (!node) throw new Error(`Unknown node: ${id}`); return { id, name: node.name, children: node.children.map(visit) }; };
  return rootIds.map(visit);
}

export class RichTextEditor {
  private readonly history: string[] = [];
  private index = -1;
  constructor(public value = "") { this.commit(value); }
  commit(value: string): void { this.history.splice(++this.index, this.history.length - this.index, value); this.value = value; }
  undo(): string { if (this.index > 0) this.value = this.history[--this.index] ?? this.value; return this.value; }
  redo(): string { if (this.index < this.history.length - 1) this.value = this.history[++this.index] ?? this.value; return this.value; }
}

export type CmsApiTransport = (input: string | URL, init?: { method?: string; credentials?: "include" | "omit" | "same-origin"; headers?: Record<string, string>; body?: string }) => Promise<Response>;
export class CmsApiClient {
  constructor(private readonly transport: CmsApiTransport, private readonly baseUrl: string) {}
  async get<T>(path: string): Promise<T> { const response = await this.transport(`${this.baseUrl}${path}`, { credentials: "include" }); if (!response.ok) throw new Error(`CMS request failed: ${response.status}`); return response.json() as Promise<T>; }
  async save<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> { const response = await this.transport(`${this.baseUrl}${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`CMS save failed: ${response.status}`); return response.json() as Promise<T>; }
}

export type EditorSaveRequest = { componentId: string; field: string; value: string; expectedVersion: number };
export type EditorSaveResponse = { componentId: string; field: string; value: string; version: number; html: string };
export function createEditorSaveRequest(componentId: string, field: string, value: string, expectedVersion: number): EditorSaveRequest {
  if (!componentId || !field || !Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error("Invalid editor save request");
  return { componentId, field, value, expectedVersion };
}
