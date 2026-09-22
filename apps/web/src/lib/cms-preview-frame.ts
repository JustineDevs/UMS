type PreviewMessageSource = Pick<MessageEvent, "origin" | "source">;

export function cmsPreviewSandbox(
  previewOrigin: string,
  parentOrigin: string,
): string {
  // Preserve origin isolation when the storefront and admin share a host.
  // allow-same-origin is safe here only because the preview remains cross-origin.
  return previewOrigin && parentOrigin && previewOrigin !== parentOrigin
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
