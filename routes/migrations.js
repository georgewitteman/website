import { MyResponse } from "../lib/Response.js";
import { Router } from "../lib/Router.js";
import { h, render } from "../lib/html.js";
import { documentLayout } from "../lib/layout.js";
import { logger } from "../lib/logger.js";
import {
  getMigration,
  listMigrations,
  runMigration,
} from "../lib/migrations.js";
import { route } from "../lib/route.js";

export const router = new Router();

/**
 * @param {string | undefined} name
 */
async function migrationNotFound(name) {
  return new MyResponse(404).html(
    render(
      await documentLayout({
        title: name ?? "<missing>",
        main: [h("h1", {}, [`Migration not found: ${name ?? "<undefined>"}`])],
      }),
    ),
  );
}

async function getMigrations() {
  const migrations = await listMigrations();
  return new MyResponse().html(
    render(
      await documentLayout({
        title: "Migrations",
        main: [
          h("h1", {}, ["Migrations"]),
          h("table", { class: "table" }, [
            h("thread", {}, [
              h("tr", {}, [
                h("th", { scope: "col" }, ["Name"]),
                h("th", { scope: "col" }, ["Completed On"]),
              ]),
            ]),
            h(
              "tbody",
              {},
              migrations.map(({ name, completedOn }) =>
                h("tr", {}, [
                  h("td", {}, [h("a", { href: `/migration/${name}` }, [name])]),
                  h("td", {}, [completedOn?.toLocaleString() ?? ""]),
                ]),
              ),
            ),
          ]),
        ],
      }),
    ),
  );
}

/**
 * @param {string | undefined} name
 */
async function getOneMigration(name) {
  if (!name) {
    logger.warn(`Migration name is empty or nullish: ${name ?? "<nullish>"}`);
    return migrationNotFound(name);
  }

  const migration = await getMigration(name);
  if (!migration) {
    logger.warn(`Migration not found: ${name}`);
    return migrationNotFound(name);
  }

  return new MyResponse().html(
    render(
      await documentLayout({
        title: "Migrations",
        main: [
          h("h1", {}, [`Migration: ${migration.name}`]),
          h("a", { href: "/migrations" }, ["\u2039 List migrations"]),
          h("dl", {}, [
            h("dt", {}, ["Name"]),
            h("dd", {}, [migration.name]),

            h("dt", {}, ["Completed On"]),
            h("dd", {}, [
              migration.completedOn?.toLocaleString() ?? "Not completed",
            ]),

            h("dt", {}, ["Content"]),
            h("dd", {}, [h("pre", {}, [h("code", {}, [migration.content])])]),
          ]),
          h("form", { method: "POST" }, [
            h(
              "button",
              { type: "submit", disabled: Boolean(migration.completedOn) },
              ["Run migration"],
            ),
          ]),
        ],
      }),
    ),
  );
}

/**
 * @param {string | undefined} name
 */
async function postOneMigration(name) {
  if (!name) {
    logger.warn(`Migration empty or not a string: ${name ?? "<nullish>"}`);
    return MyResponse.redirectFound(route("migrations"));
  }

  const migration = await getMigration(name);
  if (!migration) {
    logger.warn(`Migration not found (is string): ${name}`);
    return MyResponse.redirectFound(route("migration", name));
  }

  if (migration.completedOn) {
    return new MyResponse(404).html(`Migration already completed on
    ${migration.completedOn.toLocaleString()}`);
  }

  await runMigration(name);

  return MyResponse.redirectFound(route("migration", name));
}

router.get("/migrations", async () => await getMigrations());

router.get(
  "/migration/:name",
  async (_, params) => await getOneMigration(params.name),
);

router.post(
  "/migration/:name",
  async (_, params) => await postOneMigration(params.name),
);
