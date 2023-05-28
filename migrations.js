import fs from "node:fs";
import { pool } from "./db.js";

const file = process.argv[2];
console.log("Migration file: %s", file);
if (!file) {
  throw new Error("Missing file");
}

const migration = (await fs.promises.readFile(file)).toString();
console.log(migration);

const client = await pool.connect();
await client.query("BEGIN");
try {
  console.log(await client.query(migration));
  await client.query("COMMIT");
  console.log("Migration committed successfully!");
} catch (e) {
  console.error("Migration failed. Rolling back transaction");
  console.error(e);
  await client.query("ROLLBACK");
} finally {
  client.release();
  await pool.end();
}
