#!/usr/bin/env node
//
// check-node-version.mjs - Fail if the Node major version drifts.
//
// The Node major is declared in six places. Dependabot can only update one of
// them (@types/node): it will not touch `engines`, it cannot rename
// @tsconfig/nodeNN to the next major, and it does not read the `version` option
// of a dev container feature.
//
// So a Node major bump always arrives as a partial PR. This turns that into a
// red build on the PR rather than a mismatch discovered later.
//
// Usage:
//   npm run check:node
//

import { readFileSync } from "node:fs";

/** First run of digits in a value, e.g. "^26.1.2" and "@tsconfig/node26" -> "26". */
const major = (value) => String(value ?? "").match(/\d+/)?.[0];

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const tsconfig = readFileSync("tsconfig.json", "utf8");
const devcontainer = readFileSync(".devcontainer/devcontainer.json", "utf8");

const devDeps = pkg.devDependencies ?? {};

const declarations = {
  "package.json engines.node": major(pkg.engines?.node),
  "package.json devEngines.runtime.version": major(
    pkg.devEngines?.runtime?.version,
  ),
  "package.json @types/node": major(devDeps["@types/node"]),
  "package.json @tsconfig/nodeNN": major(
    Object.keys(devDeps).find((name) => /^@tsconfig\/node\d+$/.test(name)),
  ),
  "tsconfig.json extends": tsconfig.match(/@tsconfig\/node(\d+)\//)?.[1],
  ".devcontainer/devcontainer.json node feature": devcontainer.match(
    /features\/node:\d+"\s*:\s*\{\s*"version"\s*:\s*"(\d+)"/,
  )?.[1],
};

const majors = new Set(Object.values(declarations));

if (majors.size === 1 && !majors.has(undefined)) {
  console.log(
    `Node ${[...majors][0]} is declared consistently in all ${Object.keys(declarations).length} places.`,
  );
  process.exit(0);
}

console.error("Node major version is inconsistent across the repo:\n");
for (const [where, found] of Object.entries(declarations)) {
  console.error(`  ${(found ?? "NOT FOUND").padEnd(9)} ${where}`);
}
console.error(
  "\nA Node major bump has to change all of these together. Dependabot only\n" +
    "updates @types/node, so the rest are expected to be edited by hand in the\n" +
    "same pull request.",
);
process.exit(1);
