import child_process from "node:child_process";
import { ECRClient, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";
import { z } from "./zod.js";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";

process.env.AWS_REGION = "us-west-2";

/**
 * @param {string} encodedString
 */
function base64Decode(encodedString) {
  return Buffer.from(encodedString, "base64").toString("utf-8");
}

/**
 * @param {string} command
 * @param {{ input?: string }} options
 */
function execSync(command, options = {}) {
  console.log("> %s", command);
  if (typeof options.input === "string") {
    child_process.execSync(command, {
      input: options.input,
      stdio: ["pipe", process.stdout, process.stderr],
    });
    return;
  }
  child_process.execSync(command, { stdio: "inherit" });
}

async function getECRAuthorizationToken() {
  console.log("Getting ECR authorization token from AWS");
  const client = new ECRClient({});
  const command = new GetAuthorizationTokenCommand({});
  const response = await client.send(command);
  const authorizationDataSchema = z.object({
    authorizationData: z
      .array(
        z.object({
          authorizationToken: z.string(),
          expiresAt: z.date(),
          proxyEndpoint: z.string(),
        })
      )
      .length(1),
  });
  const authorizationTokenBase64 = authorizationDataSchema.unsafeParse({
    authorizationData: response.authorizationData,
  }).authorizationData[0].authorizationToken;
  return base64Decode(authorizationTokenBase64).substring(4);
}

async function updateECSService() {
  const client = new ECSClient({});
  const response = await client.send(
    new UpdateServiceCommand({
      cluster: "Prod",
      service: "website-v5",
      forceNewDeployment: true,
    })
  );
  console.log(response);
}

execSync("npx eslint .");
execSync("npm run typecheck");
execSync("node --test");

execSync(
  "docker login --username AWS --password-stdin 866631827662.dkr.ecr.us-west-2.amazonaws.com",
  { input: await getECRAuthorizationToken() }
);
execSync("docker build -t website .");
execSync(
  "docker tag website:latest 866631827662.dkr.ecr.us-west-2.amazonaws.com/website:latest"
);
execSync(
  "docker push 866631827662.dkr.ecr.us-west-2.amazonaws.com/website:latest"
);

await updateECSService();
