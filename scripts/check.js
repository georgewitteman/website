import { execSync } from "./run.js";

execSync("npx prettier --write .");
execSync("npx eslint .");
execSync("npx tsc");
execSync("node --test");
