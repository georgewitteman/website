import fs from "node:fs";
import { getPool, sql, typeSafeQuery } from "./db.js";
import path from "node:path";
import { logger } from "./logger.js";
import { z } from "./zod.js";

/**
 * @param {string} name
 */
function resolveMigrationPath(name) {
  return path.join("./migrations", name);
}

async function ensureMigrationTable() {
  await typeSafeQuery(
    sql`
    CREATE TABLE IF NOT EXISTS migration (
      name TEXT NOT NULL PRIMARY KEY,
      completed_on TIMESTAMP
    );
  `,
    z.array(z.object({})),
  );
}

/**
 * @param {string} name
 */
export async function runMigration(name) {
  await ensureMigrationTable();

  const existingMigration = await getMigration(name);
  if (existingMigration?.completedOn) {
    throw new Error("Migration already completed");
  }

  const migration = await getMigrationContent(name);
  if (!migration) {
    throw new Error(`Unable to find migration for ${name}`);
  }
  logger.info(migration);

  const client = await getPool().connect();
  await client.query("BEGIN");
  try {
    await client.query(migration);
    await client.query(
      sql`INSERT INTO migration (name, completed_on) VALUES (${name}, NOW())`,
    );
    await client.query("COMMIT");
    logger.info("Migration committed successfully!");
  } catch (e) {
    logger.error("Migration failed. Rolling back transaction", e);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

/**
 * @param {string} name
 */
export async function getMigration(name) {
  await ensureMigrationTable();

  const content = await getMigrationContent(name);
  if (typeof content !== "string") {
    return undefined;
  }

  const queryResult = await typeSafeQuery(
    sql`SELECT * FROM migration WHERE name = ${name}`,
    z
      .array(z.object({ name: z.string(), completed_on: z.date().nullable() }))
      .max(1),
  );

  return { name, content, completedOn: queryResult[0]?.completed_on ?? null };
}

export async function listMigrations() {
  const filenames = await fs.promises.readdir("./migrations");
  filenames.sort();
  return Promise.all(
    filenames.map(async (name) => {
      const migration = await getMigration(name);
      if (!migration) {
        throw new Error("Unexpected error");
      }
      return migration;
    }),
  );
}

/**
 * @param {string} name
 */
async function getMigrationContent(name) {
  try {
    const content = (await fs.promises.readFile(resolveMigrationPath(name)))
      .toString()
      .trim();
    return content;
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      typeof err.code === "string" &&
      (err.code === "ENOENT" || err.code === "EISDIR")
    ) {
      logger.warn(err);
      return undefined;
    }
    throw err;
  }
}
