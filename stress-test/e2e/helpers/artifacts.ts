import fs from "fs";
import type { ConsoleMessage, Page, Request, Response } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

export type ConsoleIssue = { type: "error" | "warning"; text: string };

const consoleIssuesKey = Symbol("maharlikaConsoleIssuesHandlers");

const browserRuntimeLogKey = Symbol("maharlikaBrowserRuntimeLogCleanup");

function appendLine(filePath: string, line: string): void {
  fs.appendFileSync(filePath, `${line}\n`, "utf8");
}

type ConsoleIssuesHandlers = {
  onConsole: (msg: ConsoleMessage) => void;
  onPageError: (err: Error) => void;
};

/**
 * Collect console errors/warnings; fail the test explicitly if unexpected noise appears.
 * Call {@link detachConsoleListener} in `finally` to avoid leaks across tests.
 * Uses targeted `off()` handlers so {@link attachFullBrowserRuntimeLog} keeps working.
 */
export function attachConsoleListener(
  page: Page,
  bucket: ConsoleIssue[],
  options?: { allowSubstrings?: string[] },
): void {
  detachConsoleListener(page);
  const allow = options?.allowSubstrings ?? [
    "favicon",
    "ResizeObserver",
    "Hydration",
    "Download the React DevTools",
  ];
  const onConsole = (msg: ConsoleMessage): void => {
    const t = msg.type();
    if (t !== "error" && t !== "warning") return;
    const text = msg.text();
    if (allow.some((a) => text.includes(a))) return;
    bucket.push({ type: t as "error" | "warning", text });
  };
  const onPageError = (err: Error): void => {
    bucket.push({ type: "error", text: String(err) });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  (page as unknown as { [consoleIssuesKey]?: ConsoleIssuesHandlers })[consoleIssuesKey] = {
    onConsole,
    onPageError,
  };
}

export function detachConsoleListener(page: Page): void {
  const stored = (page as unknown as { [consoleIssuesKey]?: ConsoleIssuesHandlers })[
    consoleIssuesKey
  ];
  if (stored) {
    page.off("console", stored.onConsole);
    page.off("pageerror", stored.onPageError);
    delete (page as unknown as { [consoleIssuesKey]?: ConsoleIssuesHandlers })[consoleIssuesKey];
  }
}

export function assertNoUnexpectedConsole(bucket: ConsoleIssue[], allowErrors = 0): void {
  const errors = bucket.filter((b) => b.type === "error");
  if (errors.length > allowErrors) {
    throw new Error(
      `Unexpected console errors (${errors.length}): ${errors.map((e) => e.text).join(" | ")}`,
    );
  }
}

type RuntimeLogHandlers = {
  onConsole: (msg: ConsoleMessage) => void;
  onPageError: (err: Error) => void;
  onRequestFailed: (req: Request) => void;
  onResponse: (res: Response) => void;
};

/**
 * Append a complete browser-side runtime log under the test output directory:
 * `browser-runtime.log` (console of all levels, page errors, failed requests, HTTP error responses).
 * Call {@link detachBrowserRuntimeLog} in `afterEach` (registered globally from playwright config).
 */
export function attachFullBrowserRuntimeLog(page: Page, testInfo: TestInfo): void {
  detachBrowserRuntimeLog(page);
  const logPath = testInfo.outputPath("browser-runtime.log");
  appendLine(logPath, `# browser-runtime.log started ${new Date().toISOString()}`);
  appendLine(logPath, `# outputDir ${testInfo.outputDir}`);

  const onConsole = (msg: ConsoleMessage): void => {
    const loc = msg.location();
    const where =
      loc.url && loc.lineNumber != null
        ? ` ${loc.url}:${loc.lineNumber}:${loc.columnNumber ?? 0}`
        : "";
    appendLine(logPath, `[console:${msg.type()}]${where} ${msg.text()}`);
  };

  const onPageError = (err: Error): void => {
    appendLine(logPath, `[pageerror] ${err.stack ?? String(err)}`);
  };

  const onRequestFailed = (req: Request): void => {
    const fail = req.failure();
    appendLine(
      logPath,
      `[requestfailed] ${req.method()} ${req.url()} ${fail?.errorText ?? ""}`,
    );
  };

  const onResponse = (res: Response): void => {
    const status = res.status();
    if (status >= 400) {
      appendLine(logPath, `[response] ${status} ${res.url()}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  (page as unknown as { [browserRuntimeLogKey]?: RuntimeLogHandlers })[browserRuntimeLogKey] = {
    onConsole,
    onPageError,
    onRequestFailed,
    onResponse,
  };
}

export function detachBrowserRuntimeLog(page: Page): void {
  const stored = (page as unknown as { [browserRuntimeLogKey]?: RuntimeLogHandlers })[
    browserRuntimeLogKey
  ];
  if (!stored) {
    return;
  }
  page.off("console", stored.onConsole);
  page.off("pageerror", stored.onPageError);
  page.off("requestfailed", stored.onRequestFailed);
  page.off("response", stored.onResponse);
  delete (page as unknown as { [browserRuntimeLogKey]?: RuntimeLogHandlers })[browserRuntimeLogKey];
}

/** Named checkpoint screenshot under Playwright's test output dir. */
export async function screenshotCheckpoint(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page
    .screenshot({ path: testInfo.outputPath(`checkpoint-${name}.png`), fullPage: false })
    .catch(() => {});
}
