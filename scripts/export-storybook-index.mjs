#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(process.cwd(), "storybook-static");
const source = path.join(directory, "index.json");
const target = path.join(directory, "stories.json");

if (!fs.existsSync(source)) {
  throw new Error(`Storybook index not found at ${source}`);
}
fs.copyFileSync(source, target);
console.log(`Exported ${target}`);
