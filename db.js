import pg from "pg";
import { Signer } from "@aws-sdk/rds-signer";
import fs from "node:fs";
import { logger } from "./logger.js";

/** @type {pg.PoolConfig} */
const poolConfig = {};

// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_rds_signer.html
if (
  process.env.AWS_EXECUTION_ENV === "AWS_ECS_FARGATE" &&
  process.env.PGHOST &&
  process.env.PGUSER
) {
  const signer = new Signer({
    hostname: process.env.PGHOST,
    port: 5432,
    username: process.env.PGUSER,
  });
  poolConfig.password = () => signer.getAuthToken();
  poolConfig.ssl = {
    ca: fs.readFileSync("rds-combined-ca-bundle.pem").toString(),
  };
}

// https://node-postgres.com/features/connecting
export const pool = new pg.Pool(poolConfig);

/**
 * @template {unknown[]} T
 * @template {unknown[]} V
 * @param {string | import("pg").QueryConfig<V>} query
 * @param {import("./zod.js").ZodSchema<T>} schema
 */
export async function typeSafeQuery(query, schema) {
  const result = await pool.query(query);
  const parseResult = schema.parse(result.rows);
  if (parseResult.ok) {
    return parseResult.data;
  }
  logger.error(parseResult.error);
  throw new Error("Failed to parse");
}

/**
 * https://node-postgres.com/features/queries#query-config-object
 * @param {TemplateStringsArray} strings
 * @param {unknown[]} values
 */
export function sql(strings, ...values) {
  return {
    text: /** @type {typeof strings.reduce<string>} */ (strings.reduce)(
      (prev, curr, i) => (i === 0 ? curr : `${prev}$${i}${curr}`),
      ""
    ),
    values,
  };
}
