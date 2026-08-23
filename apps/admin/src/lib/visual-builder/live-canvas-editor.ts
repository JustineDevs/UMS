import { applyDomMutation, DomEditorSession, type DomMutation, type DomSelection } from "./dom-command-engine";

export type LiveCanvasSelection = DomSelection & { source: "click" | "hover" };

/**
 * The visual-builder editor operates on the iframe document, not a duplicate React
 * preview. This adapter keeps that contract explicit and gives the builder a
 * single lifecycle for selection, mutation history, and drag/drop wiring.
 */
export class LiveCanvasEditor {
  readonly session: DomEditorSession;
  private observer: MutationObserver | null = null;
  private readonly onSelection?: (selection: LiveCanvasSelection | null) => void;
  private readonly onDrop?: (parent: HTMLElement, index: number, componentId: string) => void;
  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!isElement(target)) return;
    const elementTarget = target as HTMLElement;
    if (elementTarget.dataset.uvsOverlay === "true") return;
    const element = elementTarget.closest<HTMLElement>("[data-cms-id], [data-uvs-editable], [data-uvs-id]");
    const selection = this.select(element, "click");
    if (selection) event.preventDefault();
  };
  private readonly onPointerOver = (event: PointerEvent): void => {
    const target = event.target;
    if (!isElement(target)) return;
    const element = (target as HTMLElement).closest<HTMLElement>("[data-cms-id], [data-uvs-editable], [data-uvs-id]");
    if (element) this.select(element, "hover");
  };
  private readonly onDragOver = (event: DragEvent): void => {
    if (event.dataTransfer?.types.includes("application/x-uvs-component")) event.preventDefault();
  };
  private readonly onDropEvent = (event: DragEvent): void => {
    const componentId = event.dataTransfer?.getData("application/x-uvs-component");
    const target = event.target;
    if (!componentId || !isElement(target)) return;
    event.preventDefault();
    const parent = (target as HTMLElement).closest<HTMLElement>("[data-cms-slot], [data-cms-id], body") ?? this.document.body;
    const index = parent.children.length;
    this.onDrop?.(parent, index, componentId);
  };

  constructor(
    readonly document: Document,
    options: {
      onSelection?: (selection: LiveCanvasSelection | null) => void;
      onDrop?: (parent: HTMLElement, index: number, componentId: string) => void;
    } = {},
  ) {
    this.session = new DomEditorSession(document);
    this.onSelection = options.onSelection;
    this.onDrop = options.onDrop;
  }

  attach(): void {
    this.session.decorate();
    this.document.body.dataset.uvsEditor = "true";
    const Observer = this.document.defaultView?.MutationObserver ?? (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    if (Observer) {
      this.observer = new Observer(() => this.session.decorate());
      this.observer.observe(this.document.body, { childList: true, subtree: true, attributes: true });
    }
    this.document.addEventListener("click", this.onClick, true);
    this.document.addEventListener("pointerover", this.onPointerOver, true);
    this.document.addEventListener("dragover", this.onDragOver, true);
    this.document.addEventListener("drop", this.onDropEvent, true);
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.document.removeEventListener("click", this.onClick, true);
    this.document.removeEventListener("pointerover", this.onPointerOver, true);
    this.document.removeEventListener("dragover", this.onDragOver, true);
    this.document.removeEventListener("drop", this.onDropEvent, true);
    delete this.document.body.dataset.uvsEditor;
  }

  select(element: HTMLElement | null, source: "click" | "hover" = "click"): LiveCanvasSelection | null {
    const selection = this.session.select(element);
    const result = selection ? { ...selection, source } : null;
    this.onSelection?.(result);
    return result;
  }

  mutate(command: DomMutation): void {
    applyDomMutation(command, "after");
    this.session.history.add(command);
  }
}

function isElement(value: EventTarget | null): value is Element {
  return Boolean(value && (value as Node).nodeType === 1);
}
