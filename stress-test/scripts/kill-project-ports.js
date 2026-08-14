#!/usr/bin/env node
/**
 * Kill processes on project dev ports (3000, 3001, 4000, 9000, 17711).
 * 17711 is the local POS terminal-agent (TERMINAL_AGENT_PORT).
 * Fallback when npx kill-port fails (e.g. on Windows with orphan Node processes).
 */
const { execSync } = require("child_process");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const ports = [3000, 3001, 4000, 9000, 17711];
const isWin = process.platform === "win32";

function killPortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const lines = out.trim().split("\n").filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const last = parts[parts.length - 1];
      if (last && /^\d+$/.test(last)) {
        pids.add(last);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`[kill-ports] Killed PID ${pid} (port ${port})`);
      } catch {
        // Ignore - process may already be gone
      }
    }
  } catch {
    // netstat returned nothing = no process on port
  }
}

function killPortUnix(port) {
  let killed = false;
  try {
    execSync(`fuser -k -n tcp ${port} 2>/dev/null`, {
      stdio: "ignore",
    });
    killed = true;
  } catch {
    // Try lsof fallback below.
  }

  if (killed) {
    console.log(`[kill-ports] Killed process on port ${port}`);
    return;
  }

  try {
    execSync(`lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
    console.log(`[kill-ports] Killed process on port ${port}`);
  } catch {
    // No process on port.
  }
}

for (const port of ports) {
  if (isWin) {
    killPortWindows(port);
  } else {
    killPortUnix(port);
  }
}

console.log("[kill-ports] Done. Ports 3000, 3001, 4000, 9000, 17711 should be free.");
