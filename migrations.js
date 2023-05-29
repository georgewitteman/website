import fs from "node:fs";
import { pool } from "./db.js";
import path from "node:path";
import { logger } from "./logger.js";

/**
 * @param {fs.PathLike} file
 */
async function runMigration(file) {
  logger.info(`Migration file: ${file}`);
  const migration = (await fs.promises.readFile(file)).toString().trim();
  logger.info(migration);

  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    await client.query(migration);
    await client.query("COMMIT");
    logger.info("Migration committed successfully!");
  } catch (e) {
    logger.error("Migration failed. Rolling back transaction");
    logger.error(e);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

export async function runMigrations() {
  const filenames = await fs.promises.readdir("./migrations");
  filenames.sort();
  logger.info(`Found files: ${filenames.join(", ")}`);
  for (const filename of filenames) {
    if (!filename.match(/\d\d\d_\w+\.sql/g)) {
      logger.warn(
        `File in migrations directory that didn't match the expected file name format: ${filename}`
      );
      continue;
    }
    const fullPath = new URL(
      path.join("./migrations", filename),
      import.meta.url
    ).pathname;
    await runMigration(fullPath);
  }
  logger.info("All migrations finished!");
}
