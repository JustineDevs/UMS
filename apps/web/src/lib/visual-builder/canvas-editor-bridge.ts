import { serializeHtml } from "./builder-actions";
import { readResponseJson } from "../read-response-json";

export type CanvasDocument = { body: { innerHTML: string }; head: { innerHTML: string } };
export type CanvasFrame = { addEventListener(type: "load" | "beforeunload" | "unload", listener: () => void): void; removeEventListener?(type: "load" | "beforeunload" | "unload", listener: () => void): void; contentDocument: CanvasDocument | null };

export class CanvasController {
  document: CanvasDocument | null = null;
  loaded = false;
  private disposed = false;
  private readyCallback: ((document: CanvasDocument) => void) | null = null;
  private readonly onLoad = () => { if (this.disposed) return; this.document = this.frame.contentDocument; this.loaded = this.document !== null; if (this.document) this.readyCallback?.(this.document); };
  private readonly onBeforeUnload = () => { this.loaded = false; };
  private readonly onUnload = () => { this.document = null; this.loaded = false; };
  constructor(private readonly frame: CanvasFrame) {}
  bootstrap(onReady: (document: CanvasDocument) => void): void {
    this.dispose();
    this.disposed = false;
    this.readyCallback = onReady;
    this.frame.addEventListener("load", this.onLoad);
    this.frame.addEventListener("beforeunload", this.onBeforeUnload);
    this.frame.addEventListener("unload", this.onUnload);
  }
  dispose(): void {
    this.disposed = true;
    this.frame.removeEventListener?.("load", this.onLoad);
    this.frame.removeEventListener?.("beforeunload", this.onBeforeUnload);
    this.frame.removeEventListener?.("unload", this.onUnload);
    this.readyCallback = null;
    this.document = null;
    this.loaded = false;
  }
  setHtml(html: string): void { if (!this.document) throw new Error("Canvas is not loaded"); this.document.body.innerHTML = html; }
  getHtml(): string {
    if (!this.document) throw new Error("Canvas is not loaded");
    // Sanitize the editable payloads without passing the document shell through
    // the HTML sanitizer, which intentionally removes head/body wrappers.
    const head = serializeHtml(this.document.head.innerHTML);
    const body = serializeHtml(this.document.body.innerHTML);
    return `<head>${head}</head><body>${body}</body>`;
  }
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
  async get<T>(path: string): Promise<T> { const response = await this.transport(`${this.baseUrl}${path}`, { credentials: "include" }); if (!response.ok) throw new Error(`CMS request failed: ${response.status}`); return readResponseJson<T>(response, {} as T); }
  async save<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> { const response = await this.transport(`${this.baseUrl}${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`CMS save failed: ${response.status}`); return readResponseJson<T>(response, {} as T); }
}

export type EditorSaveRequest = { componentId: string; field: string; value: string; expectedVersion: number };
export function createEditorSaveRequest(componentId: string, field: string, value: string, expectedVersion: number): EditorSaveRequest {
  if (!componentId || !field || !Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error("Invalid editor save request");
  return { componentId, field, value, expectedVersion };
}
