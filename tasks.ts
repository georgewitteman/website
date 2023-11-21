import { ECRClient, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";
import { z } from "zod";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import child_process from "node:child_process";

function execSync(
  command: string,
  options: { input?: string; cwd?: string } = {},
) {
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

const tasks: Record<
  string,
  { name: string; deps: string[]; fn: () => Promise<void> }
> = {};

function getTaskDeps(name: string): string[] {
  const task = tasks[name];
  if (!task) {
    throw new Error(`Task ${name} was not found`);
  }
  const { deps } = task;
  return deps.concat(...deps.map(getTaskDeps));
}

function task(name: string, deps: string[], fn: () => Promise<void>) {
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

function base64Decode(encodedString: string) {
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
  execSync("bunx prettier --check .");
  execSync("bunx eslint .");
  execSync("bunx tsc");
  execSync("bunx tsc", { cwd: "./static" });
  execSync("bunx tsc", { cwd: "./static" });
});

task("test", [], async () => {
  execSync("bun test");
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

async function runTask(name: string) {
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

async function runTasks(argv: string[]) {
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
