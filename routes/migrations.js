import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { h, render } from "../html.js";
import { documentLayout } from "../layout.js";
import { logger } from "../logger.js";
import { getMigration, listMigrations, runMigration } from "../migrations.js";

export const router = new Router();

router.get("/migrations", async () => {
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
});

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

router.get("/migration/:name", async (req, params) => {
  const name = params.name;
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
});

router.post("/migration/:name", async (req, params) => {
  const name = params.name;
  if (!name) {
    logger.warn(`Migration empty or not a string: ${name ?? "<nullish>"}`);
    return MyResponse.redirectFound(req.pathname);
  }

  const migration = await getMigration(name);
  if (!migration) {
    logger.warn(`Migration not found (is string): ${name}`);
    return MyResponse.redirectFound(req.pathname);
  }

  if (migration.completedOn) {
    return new MyResponse(404).html(`Migration already completed on
    ${migration.completedOn.toLocaleString()}`);
  }

  await runMigration(name);

  return MyResponse.redirectFound(req.pathname);
});
