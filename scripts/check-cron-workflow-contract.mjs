import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const workflowPath = path.join(root, ".github/workflows/storefront-cron.yml");
const workerPath = path.join(root, "workers/backend/src/cron.ts");

function sorted(values) {
  return [...new Set(values)].sort();
}

export function validateCronWorkflowContract(workflow, worker) {
  const workflowTasks = sorted([...workflow.matchAll(/\/internal\/cron\/([a-z-]+)/g)].map((match) => match[1]));
  const workerTasks = sorted([...worker.matchAll(/task === "([a-z-]+)"/g)].map((match) => match[1]));
  const missingFromWorkflow = workerTasks.filter((task) => !workflowTasks.includes(task));
  const missingFromWorker = workflowTasks.filter((task) => !workerTasks.includes(task));
  const errors = [];

  if (!workflow.includes("BACKEND_WORKER_URL: ${{ vars.BACKEND_WORKER_URL || 'https://ums-backend-production.pcg0255.workers.dev' }}")) {
    errors.push("workflow must keep the canonical production Worker fallback URL");
  }
  if (!workflow.includes("CRON_SECRET: ${{ secrets.STOREFRONT_CRON_SECRET }}")) {
    errors.push("workflow must use the protected STOREFRONT_CRON_SECRET secret");
  }
  if (missingFromWorkflow.length) errors.push(`Worker tasks missing from workflow: ${missingFromWorkflow.join(", ")}`);
  if (missingFromWorker.length) errors.push(`Workflow tasks missing from Worker: ${missingFromWorker.join(", ")}`);

  return { errors, workflowTasks, workerTasks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateCronWorkflowContract(
    fs.readFileSync(workflowPath, "utf8"),
    fs.readFileSync(workerPath, "utf8"),
  );
  if (result.errors.length) {
    console.error("Cron workflow contract failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Cron workflow contract passed: ${result.workerTasks.length} Worker tasks match.`);
  }
}
