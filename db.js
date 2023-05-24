import pg from "pg";
import { z } from "./zod.js";

export const pool = new pg.Pool({
  user: "postgres",
});

/**
 * @template {unknown[]} T
 * @param {string} query
 * @param {import("./zod.js").ZodSchema<T>} schema
 */
export async function typeSafeQuery(query, schema) {
  const client = await pool.connect();
  const result = await client.query(query);
  client.release();
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
