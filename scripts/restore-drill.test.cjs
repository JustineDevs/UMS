const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { runRestoreDrill } = require("./restore-drill.cjs");

const confirmKey = "RESTORE_DRILL_CONFIRM_DISPOSABLE_TARGET";

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uvs-restore-drill-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const backup = path.join(directory, "backup.dump");
  fs.writeFileSync(backup, "archive fixture");
  return {
    APP_DB_URL: "postgres://postgres.appref:app-secret@pooler.supabase.com:6543/postgres",
    MEDUSA_DB_URL: "postgres://postgres.commerceref:commerce-secret@pooler.supabase.com:6543/postgres",
    RESTORE_DATABASE_URL: "postgres://postgres.restore:restore-secret@pooler.supabase.com:6543/postgres",
    RESTORE_BACKUP_FILE: backup,
    [confirmKey]: "YES",
  };
}

function captureErrors(t) {
  const original = console.error;
  console.error = () => {};
  t.after(() => { console.error = original; });
}

test("refuses missing disposable-target acknowledgement before invoking pg_restore", (t) => {
  captureErrors(t);
  const env = setup(t);
  delete env[confirmKey];
  let calls = 0;
  assert.equal(runRestoreDrill(env, () => { calls += 1; }), 2);
  assert.equal(calls, 0);
});

test("refuses APP and commerce databases as restore targets", (t) => {
  captureErrors(t);
  const env = setup(t);
  let calls = 0;
  for (const source of [env.APP_DB_URL, env.MEDUSA_DB_URL]) {
    assert.equal(runRestoreDrill({ ...env, RESTORE_DATABASE_URL: source }, () => { calls += 1; }), 2);
  }
  assert.equal(calls, 0);
});

test("refuses a source database reached through a different role or port", (t) => {
  captureErrors(t);
  const env = setup(t);
  let calls = 0;
  const aliases = [
    "postgres://other-role.appref:other-secret@pooler.supabase.com:5432/postgres",
    "postgres://other-role.commerceref:other-secret@pooler.supabase.com:6543/postgres",
  ];
  for (const RESTORE_DATABASE_URL of aliases) {
    assert.equal(runRestoreDrill({ ...env, RESTORE_DATABASE_URL }, () => { calls += 1; }), 2);
  }
  assert.equal(calls, 0);
});

test("normalizes the same Supabase project across direct and pooler URLs", (t) => {
  captureErrors(t);
  const env = setup(t);
  const APP_DB_URL = "postgres://postgres:app-secret@db.appref.supabase.co:5432/postgres";
  const RESTORE_DATABASE_URL = "postgres://postgres.appref:other-secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
  let calls = 0;
  assert.equal(runRestoreDrill({ ...env, APP_DB_URL, RESTORE_DATABASE_URL }, () => { calls += 1; }), 2);
  assert.equal(calls, 0);
});

test("rejects ambiguous Supabase pooler identities before invoking pg_restore", (t) => {
  captureErrors(t);
  const env = setup(t);
  let calls = 0;
  assert.equal(runRestoreDrill({ ...env, RESTORE_DATABASE_URL: "postgres://postgres@aws-0-us-east-1.pooler.supabase.com:6543/postgres" }, () => { calls += 1; }), 2);
  assert.equal(calls, 0);
});

test("validates the archive before invoking the destructive restore", (t) => {
  captureErrors(t);
  const env = setup(t);
  const calls = [];
  const status = runRestoreDrill(env, (command, args) => {
    calls.push(args);
    return { status: args[0] === "--list" ? 1 : 0 };
  });
  assert.equal(status, 1);
  assert.deepEqual(calls, [["--list", env.RESTORE_BACKUP_FILE]]);
});

test("restores only after archive validation and wraps changes in one transaction", (t) => {
  captureErrors(t);
  const env = setup(t);
  const calls = [];
  const status = runRestoreDrill(env, (command, args) => {
    calls.push(args);
    return { status: 0 };
  });
  assert.equal(status, 0);
  assert.deepEqual(calls[0], ["--list", env.RESTORE_BACKUP_FILE]);
  assert.ok(calls[1].includes("--clean"));
  assert.ok(calls[1].includes("--single-transaction"));
  assert.equal(calls[1][calls[1].indexOf("--dbname") + 1], env.RESTORE_DATABASE_URL);
});

test("rejects non-PostgreSQL destination URLs before invoking pg_restore", (t) => {
  captureErrors(t);
  const env = setup(t);
  let calls = 0;
  assert.equal(
    runRestoreDrill({ ...env, RESTORE_DATABASE_URL: "https://example.invalid/db" }, () => { calls += 1; }),
    2,
  );
  assert.equal(calls, 0);
});
