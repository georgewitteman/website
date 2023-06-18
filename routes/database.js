import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { sql, typeSafeQuery } from "../db.js";
import { html } from "../html.js";
import { documentLayout } from "../layout.js";
import { z } from "../zod.js";

export const router = new Router();

router.get("/database/table", async () => {
  // https://www.postgresql.org/docs/current/view-pg-tables.html
  const tables = await typeSafeQuery(
    sql`SELECT schemaname, tablename, tableowner, tablespace, hasindexes, hasrules, hastriggers, rowsecurity FROM pg_catalog.pg_tables`,
    z.array(
      z.object({
        schemaname: z.string(),
        tablename: z.string(),
        tableowner: z.string(),
        tablespace: z.string().nullish(),
        hasindexes: z.boolean(),
        hasrules: z.boolean(),
        hastriggers: z.boolean(),
        rowsecurity: z.boolean(),
      }),
    ),
  );
  return new MyResponse().html(
    documentLayout({
      title: "Tables",
      main: html`
        <h1>Tables</h1>
        <table class="table">
          <thead>
            <tr>
            <th scope="col">schemaname</th>
            <th scope="col">tablename</th>
            <th scope="col">tableowner</th>
            <th scope="col">tablespace</th>
            <th scope="col">hasindexes</th>
            <th scope="col">hasrules</th>
            <th scope="col">hastriggers</th>
            <th scope="col">rowsecurity</th>
            </td>
          </thead>
          <tbody>
            ${tables.map(
              (row) =>
                html`
                  <tr>
                    <td>
                      <pre><code>${row.schemaname}</code></pre>
                    </td>
                    <td>
                      <pre><code><a href="/database/table/${row.tablename}">${row.tablename}</a></code></pre>
                    </td>
                    <td>
                      <pre><code>${row.tableowner}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.tablespace ?? "<null>"}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.hasindexes
                        ? "true"
                        : "false"}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.hasrules ? "true" : "false"}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.hastriggers
                        ? "true"
                        : "false"}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.rowsecurity
                        ? "true"
                        : "false"}</code></pre>
                    </td>
                  </tr>
                `,
            )}
          </tbody>
        </table>
    `,
    }),
  );
});

router.get("/database/table/:name", async (_, params) => {
  const tableName = params.name;
  if (!tableName) {
    return new MyResponse().html(
      documentLayout({
        title: "No table name",
        main: html` <h1>Invalid table name: ${tableName}</h1> `,
      }),
    );
  }

  // https://www.postgresql.org/docs/current/infoschema-columns.html
  const tables = await typeSafeQuery(
    sql`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name = ${tableName};`,
    z.array(
      z.object({
        table_name: z.string(),
        column_name: z.string(),
        data_type: z.string(),
      }),
    ),
  );
  return new MyResponse().html(
    documentLayout({
      title: "Tables",
      main: html`
        <h1>Table: ${tableName}</h1>
        <a href="/database/table">&lsaquo; List tables</a>
        <table class="table">
          <thead>
            <tr>
            <th scope="col">table_name</th>
            <th scope="col">column_name</th>
            <th scope="col">data_type</th>
            </td>
          </thead>
          <tbody>
            ${tables.map(
              (row) =>
                html`
                  <tr>
                    <td>
                      <pre><code>${row.table_name}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.column_name}</code></pre>
                    </td>
                    <td>
                      <pre><code>${row.data_type}</code></pre>
                    </td>
                  </tr>
                `,
            )}
          </tbody>
        </table>
    `,
    }),
  );
});
