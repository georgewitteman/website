import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { html } from "../html.js";
import { documentLayout } from "../layout.js";
import { logger } from "../logger.js";
import { getMigration, listMigrations, runMigration } from "../migrations.js";

export const router = new Router();

router.get("/migrations", async () => {
  const migrations = await listMigrations();
  return MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Migrations",
      body: html`
      <header>
        <nav><a href="/">&lsaquo; Home</a><br /></nav>
      </header>
      <main>
        <h1>Migrations</h1>
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Completed On</th>
            </td>
          </thead>
          <tbody>
            ${migrations.map(
              ({ name, completedOn }) =>
                html`
                  <tr>
                    <td><a href="/migration/${name}">${name}</a></td>
                    <td>${completedOn?.toLocaleString()}</td>
                  </tr>
                `,
            )}
          </tbody>
        </table>
      </main>
    `,
    }),
  );
});

/**
 * @param {string | undefined} name
 */
function migrationNotFound(name) {
  return MyResponse.html(
    404,
    {},
    documentLayout({
      title: name ?? "<missing>",
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>
        <main>
          <h1>Migration not found: ${name}</h1>
        </main>
      `,
    }),
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

  return MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Migrations",
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>
        <main>
          <h1>Migration: ${migration.name}</h1>
          <a href="/migrations">&lsaquo; List migrations</a>
          <dl>
            <dt>Name</dt>
            <dd>${migration.name}</dd>

            <dt>Completed on</dt>
            <dd>
              ${migration.completedOn
                ? migration.completedOn.toLocaleString()
                : html`<em>Not completed</em>`}
            </dd>

            <dt>Content</dt>
            <dd>
              <pre><code>${migration.content}</code></pre>
            </dd>
          </dl>
          <form method="POST">
            <button type="submit" ${migration.completedOn ? "disabled" : null}>
              Run migration
            </button>
          </form>
        </main>
      `,
    }),
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
    return MyResponse.html(
      400,
      {},
      html`Migration already completed on
      ${migration.completedOn.toLocaleString()}`,
    );
  }

  await runMigration(name);

  return MyResponse.redirectFound(req.pathname);
});
