import { ECRClient, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";
import { z } from "zod";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import child_process from "node:child_process";

/**
 * @param {string} command
 * @param {{ input?: string, cwd?: string }} options
 */
function execSync(command, options = {}) {
  console.log("\x1b[1;34m> %s\x1b[0m", command);
  if (typeof options.input === "string") {
    child_process.execSync(command, {
      cwd: options.cwd,
      input: options.input,
      stdio: ["pipe", process.stdout, process.stderr],
    });
    return;
  }
  child_process.execSync(command, { stdio: "inherit", cwd: options.cwd });
}

/** @type {Record<string, { name: string, deps: string[], fn: () => Promise<void> }>} */
const tasks = {};

/**
 * @param {string} name
 * @returns {string[]}
 */
function getTaskDeps(name) {
  const task = tasks[name];
  if (!task) {
    throw new Error(`Task ${name} was not found`);
  }
  const { deps } = task;
  return deps.concat(...deps.map(getTaskDeps));
}

/**
 * @param {string} name
 * @param {string[]} deps
 * @param {() => Promise<void>} fn
 */
function task(name, deps, fn) {
  tasks[name] = { name, deps, fn };
  try {
    getTaskDeps(name);
  } catch (e) {
    if (e instanceof RangeError) {
      delete tasks[name];
      throw new Error(
        `Task ${name} is invalid because its dependencies are recursive`,
      );
    }
    throw e;
  }
}

const AWS_REGION = "us-west-2";

/**
 * @param {string} encodedString
 */
function base64Decode(encodedString) {
  return Buffer.from(encodedString, "base64").toString("utf-8");
}

async function getECRAuthorizationToken() {
  console.log("Getting ECR authorization token from AWS");
  const client = new ECRClient({ region: AWS_REGION });
  const command = new GetAuthorizationTokenCommand({});
  const response = await client.send(command);
  const authorizationDataSchema = z.object({
    authorizationData: z.tuple([
      z.object({
        authorizationToken: z.string(),
        expiresAt: z.date(),
        proxyEndpoint: z.string(),
      }),
    ]),
  });
  const authorizationTokenBase64 = authorizationDataSchema.parse({
    authorizationData: response.authorizationData,
  }).authorizationData[0].authorizationToken;
  return base64Decode(authorizationTokenBase64).substring(4);
}

task("lint", [], async () => {
  if (process.env.CI) {
    execSync("npx prettier --check .");
  } else {
    execSync("npx prettier --write .");
  }
  execSync("npx eslint .");
  execSync("npx tsc");
  execSync("npx tsc", { cwd: "./static" });
});

task("test", [], async () => {
  execSync("node --test");
});

task("build", ["lint", "test"], async () => {
  execSync("docker build -t website .");
  execSync(
    "docker tag website:latest 866631827662.dkr.ecr.us-west-2.amazonaws.com/website:latest",
  );
});

task("deploy", ["build"], async () => {
  execSync(
    "docker login --username AWS --password-stdin 866631827662.dkr.ecr.us-west-2.amazonaws.com",
    { input: await getECRAuthorizationToken() },
  );
  execSync(
    "docker push 866631827662.dkr.ecr.us-west-2.amazonaws.com/website:latest",
  );

  const client = new ECSClient({ region: AWS_REGION });
  const response = await client.send(
    new UpdateServiceCommand({
      cluster: "Prod",
      service: "website-v6-public",
      forceNewDeployment: true,
    }),
  );
  console.log(response);
});

/**
 * @param {string} name
 */
async function runTask(name) {
  const task = tasks[name];
  if (!task) {
    throw new Error(`Task ${name} was not found`);
  }
  const { deps, fn } = task;
  for (const dep of deps) {
    await runTask(dep);
  }
  console.log(`Running task: ${name}`);
  await fn();
}

/**
 * @param {string[]} argv
 */
async function runTasks(argv) {
  const tasksToRun = argv.filter((arg) => arg in tasks);
  if (tasksToRun.length > 1) {
    console.error(
      `Can only run a single task. Given: ${tasksToRun.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  if (tasksToRun.length < 1) {
    console.error(
      `No tasks to run. Available tasks: ${Object.keys(tasks).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  for (const task of tasksToRun) {
    console.log(
      `Running task: ${task} (deps: ${getTaskDeps(task).join(", ")})`,
    );
    runTask(task);
  }
}

await runTasks(process.argv);
