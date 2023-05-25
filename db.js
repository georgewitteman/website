import pg from "pg";
import { z } from "./zod.js";

// https://node-postgres.com/features/connecting
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_rds_signer.html
export const pool = new pg.Pool();

/**
 * @template {unknown[]} T
 * @param {string} query
 * @param {import("./zod.js").ZodSchema<T>} schema
 */
export async function typeSafeQuery(query, schema) {
  const result = await pool.query(query);
  const parseResult = schema.parse(result.rows);
  if (parseResult.ok){
    return parseResult.data
  }
  console.error(parseResult.error);
  throw new Error("Failed to parse")
}

// const rows = await typeSafeQuery("SELECT NOW()", z.array(z.object({now: z.date()})).length(1))
// console.log(rows);

// await pool.end();
