import fs from "fs";
import path from "path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from "@playwright/test/reporter";

type ReporterOptions = {
  /** Defaults to `process.env.E2E_RUNTIME_LOG_DIR` or a timestamped dir under test-results. */
  outputBase?: string;
};

function isoStamp(): string {
  return new Date().toISOString();
}

function chunkToString(chunk: string | Buffer): string {
  return Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
}

/**
 * Records raw Playwright worker stdio (onStdOut/onStdErr), structured test lifecycle events,
 * and global errors under `stress-test/test-results/runtime-logs/`.
 *
 * Pair with `stress-test/scripts/run-e2e.js` which tees the CLI process to `playwright-cli-raw.log`
 * in the same folder when `E2E_RUNTIME_LOG_DIR` is set.
 */
export default class RuntimeLogReporter implements Reporter {
  private readonly outputBaseOpt: string | undefined;

  private logDir = "";

  private stdioStream: fs.WriteStream | null = null;

  private eventsStream: fs.WriteStream | null = null;

  private errorsStream: fs.WriteStream | null = null;

  constructor(options: ReporterOptions = {}) {
    this.outputBaseOpt = options.outputBase;
  }

  printsToStdio(): boolean {
    return false;
  }

  private resolveLogDir(): string {
    const fromEnv = process.env.E2E_RUNTIME_LOG_DIR?.trim();
    const fromOpt = this.outputBaseOpt?.trim();
    if (fromEnv) {
      return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
    }
    if (fromOpt) {
      return path.isAbsolute(fromOpt) ? fromOpt : path.join(process.cwd(), fromOpt);
    }
    return path.join(process.cwd(), "stress-test", "test-results", "runtime-logs", `run-${Date.now()}`);
  }

  onBegin(config: FullConfig, suite: Suite): void {
    void config;
    this.logDir = this.resolveLogDir();
    fs.mkdirSync(this.logDir, { recursive: true });

    const meta = {
      startedAt: isoStamp(),
      cwd: process.cwd(),
      testCount: suite.allTests().length,
    };
    fs.writeFileSync(path.join(this.logDir, "RUN_META.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");

    fs.writeFileSync(
      path.join(this.logDir, "README.txt"),
      [
        "Maharlika E2E raw runtime logs for this Playwright run.",
        "",
        "- playwright-cli-raw.log: full stdout/stderr of the Playwright CLI (only when using stress-test/scripts/run-e2e.js).",
        "- playwright-worker-stdio.log: raw worker stdout/stderr (tests, expect failures, console.log from tests).",
        "- test-events.ndjson: one JSON object per line for test begin/end and failures.",
        "- global-errors.log: reporter onError lines.",
        "- Per-test: stress-test/test-results/<test-output>/browser-runtime.log (browser console, network errors).",
        "",
        `Opened at ${isoStamp()}`,
        "",
      ].join("\n"),
      "utf8",
    );

    this.stdioStream = fs.createWriteStream(path.join(this.logDir, "playwright-worker-stdio.log"), {
      flags: "a",
    });
    this.eventsStream = fs.createWriteStream(path.join(this.logDir, "test-events.ndjson"), {
      flags: "a",
    });
    this.errorsStream = fs.createWriteStream(path.join(this.logDir, "global-errors.log"), {
      flags: "a",
    });

    this.appendEvent({
      type: "run_begin",
      at: isoStamp(),
      testCount: suite.allTests().length,
    });
  }

  private appendEvent(obj: Record<string, unknown>): void {
    try {
      this.eventsStream?.write(`${JSON.stringify(obj)}\n`);
    } catch {
      /* ignore */
    }
  }

  private streamsEnded = false;

  private closeStreams(): Promise<void> {
    if (this.streamsEnded) {
      return Promise.resolve();
    }
    this.streamsEnded = true;
    const streams = [this.stdioStream, this.eventsStream, this.errorsStream].filter(
      (s): s is fs.WriteStream => s != null,
    );
    this.stdioStream = null;
    this.eventsStream = null;
    this.errorsStream = null;
    return Promise.all(
      streams.map(
        (s) =>
          new Promise<void>((resolve) => {
            s.end(() => resolve());
          }),
      ),
    ).then(() => {});
  }

  onStdOut(chunk: string | Buffer, test: void | TestCase, result: void | TestResult): void {
    void test;
    void result;
    const text = chunkToString(chunk);
    this.stdioStream?.write(text);
  }

  onStdErr(chunk: string | Buffer, test: void | TestCase, result: void | TestResult): void {
    void test;
    void result;
    const text = chunkToString(chunk);
    this.stdioStream?.write(text);
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    this.appendEvent({
      type: "test_begin",
      at: isoStamp(),
      title: test.titlePath().join(" › "),
      expectedStatus: test.expectedStatus,
      retry: result.retry,
    });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const err = result.error;
    this.appendEvent({
      type: "test_end",
      at: isoStamp(),
      title: test.titlePath().join(" › "),
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      error: err
        ? {
            message: err.message,
            stack: err.stack,
            location: err.location,
            snippet: err.snippet,
          }
        : undefined,
      attachments: result.attachments?.map((a) => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType,
      })),
    });

    if (result.status === "failed" || result.status === "timedOut") {
      const title = test.titlePath().join(" › ");
      process.stderr.write(`[maharlika-e2e] ${result.status}: ${title}\n`);
    }
  }

  onError(error: TestError): void {
    const line = `${isoStamp()} ${error.message ?? ""}\n${error.stack ?? ""}\n`;
    this.errorsStream?.write(line);
    this.appendEvent({
      type: "global_error",
      at: isoStamp(),
      message: error.message,
      stack: error.stack,
    });
  }

  onEnd(result: FullResult): void | Promise<void> {
    this.appendEvent({
      type: "run_end",
      at: isoStamp(),
      status: result.status,
      duration: result.duration,
    });
    return this.closeStreams();
  }

}
