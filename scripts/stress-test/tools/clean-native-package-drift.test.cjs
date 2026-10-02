const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildWindowsCleanupCommand,
  isWindowsFsRemovalError,
  packageDirLooksForeign,
  removePath,
} = require("./clean-native-package-drift.cjs");

test("packageDirLooksForeign flags linux native packages as drift on win32", () => {
  assert.equal(
    packageDirLooksForeign("@swc+core-linux-x64-gnu@1.15.18", "win32"),
    true,
  );
  assert.equal(
    packageDirLooksForeign("@rollup+rollup-linux-x64-gnu@4.59.0", "win32"),
    true,
  );
  assert.equal(
    packageDirLooksForeign("@esbuild+linux-x64@0.28.0", "win32"),
    true,
  );
});

test("packageDirLooksForeign keeps current-platform native packages", () => {
  assert.equal(
    packageDirLooksForeign("@swc+core-win32-x64-msvc@1.15.18", "win32"),
    false,
  );
  assert.equal(
    packageDirLooksForeign("@rollup+rollup-linux-x64-gnu@4.59.0", "linux"),
    false,
  );
  assert.equal(
    packageDirLooksForeign("@esbuild+darwin-arm64@0.28.0", "darwin"),
    false,
  );
});

test("packageDirLooksForeign ignores unrelated packages", () => {
  assert.equal(packageDirLooksForeign("rollup@4.59.0", "linux"), false);
  assert.equal(
    packageDirLooksForeign("@types+node@20.19.37", "win32"),
    false,
  );
});

test("isWindowsFsRemovalError only triggers on expected windows removal failures", () => {
  assert.equal(isWindowsFsRemovalError({ code: "EPERM" }, "win32"), true);
  assert.equal(isWindowsFsRemovalError({ code: "EACCES" }, "win32"), true);
  assert.equal(isWindowsFsRemovalError({ code: "ENOENT" }, "win32"), false);
  assert.equal(isWindowsFsRemovalError({ code: "EPERM" }, "linux"), false);
});

test("buildWindowsCleanupCommand targets directory and file removal", () => {
  assert.equal(
    buildWindowsCleanupCommand("C:\\tmp\\native-dir"),
    'if exist "C:\\tmp\\native-dir" rd /s /q "C:\\tmp\\native-dir" & if exist "C:\\tmp\\native-dir" del /f /q "C:\\tmp\\native-dir"',
  );
});

test("removePath falls back to native windows shell cleanup on EPERM", () => {
  const calls = [];
  const fsImpl = {
    rmSync() {
      const err = new Error("permission denied");
      err.code = "EPERM";
      throw err;
    },
    existsSync: (() => {
      let n = 0;
      return () => {
        n += 1;
        return n <= 2;
      };
    })(),
  };

  removePath("C:\\tmp\\broken-native-dir", {
    platform: "win32",
    fsImpl,
    execFileSyncImpl(command, args) {
      calls.push([command, args]);
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "cmd.exe");
  assert.equal(calls[1][0], "powershell.exe");
});
