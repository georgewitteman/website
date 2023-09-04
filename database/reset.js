import path from "node:path";
import fs from "node:fs";
import { getPool, sql } from "../lib/db.js";
import { logger } from "../lib/logger.js";

const schemaPath = path.join(
  path.dirname(import.meta.url).replace("file:", ""),
  "schema.sql",
);
const content = (await fs.promises.readFile(schemaPath)).toString().trim();
const client = await getPool().connect();
logger.info("Starting transaction");
await client.query("BEGIN");
try {
  logger.info("Running DROP");
  await client.query(sql`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
  `);
  logger.info("Running migration");
  await client.query(content);
  logger.info("Committing transaction");
  await client.query("COMMIT");
  logger.info("Migration committed successfully!");
} catch (e) {
  logger.error("Migration failed. Rolling back transaction", e);
  await client.query("ROLLBACK");
} finally {
  client.release();
  await getPool().end();
}
