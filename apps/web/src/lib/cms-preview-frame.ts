type PreviewMessageSource = Pick<MessageEvent, "origin" | "source">;

export function cmsPreviewSandbox(
  previewOrigin: string,
  parentOrigin: string,
  isDevelopment = false,
): string {
  // `allow-scripts` plus `allow-same-origin` is unsafe when both documents
  // share an origin: the framed document can remove its own sandbox. Keep
  // same-origin previews opaque; only grant the real origin to a separately
  // hosted storefront preview.
  return previewOrigin && parentOrigin && (
    previewOrigin !== parentOrigin || isDevelopment
  )
    ? "allow-scripts allow-same-origin"
    : "allow-scripts";
}

function hasSandboxToken(frame: HTMLIFrameElement, token: string): boolean {
  return (frame.getAttribute("sandbox") ?? "")
    .split(/\s+/)
    .includes(token);
}

export function cmsPreviewTargetOrigin(
  frame: HTMLIFrameElement,
  expectedOrigin: string,
): string {
  if (
    frame.hasAttribute("sandbox") &&
    !hasSandboxToken(frame, "allow-same-origin")
  ) {
    return "*";
  }
  return expectedOrigin || "*";
}

export function isCmsPreviewMessageFromFrame(
  event: PreviewMessageSource,
  frame: HTMLIFrameElement,
  expectedOrigin: string,
): boolean {
  if (event.source !== frame.contentWindow) return false;
  if (event.origin === expectedOrigin) return true;

  // A sandbox without allow-same-origin has an opaque origin. In that case,
  // authenticate the sender by the exact WindowProxy and the sandbox policy.
  return (
    event.origin === "null" &&
    frame.hasAttribute("sandbox") &&
    hasSandboxToken(frame, "allow-scripts") &&
    !hasSandboxToken(frame, "allow-same-origin")
  );
}
