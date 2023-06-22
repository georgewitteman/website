import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { sql, typeSafeQuery } from "../db.js";
import { h, render } from "../html.js";
import { documentLayout } from "../layout.js";
import { z } from "zod";

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
    render(
      await documentLayout({
        title: "Tables",
        main: [
          h("h1", {}, ["Tables"]),
          h("table", { class: "table" }, [
            h("thread", {}, [
              h("tr", {}, [
                h("th", { scope: "col" }, ["schemaname"]),
                h("th", { scope: "col" }, ["tablename"]),
                h("th", { scope: "col" }, ["tableowner"]),
                h("th", { scope: "col" }, ["tablespace"]),
                h("th", { scope: "col" }, ["hasindexes"]),
                h("th", { scope: "col" }, ["hasrules"]),
                h("th", { scope: "col" }, ["hastriggers"]),
                h("th", { scope: "col" }, ["rowsecurity"]),
              ]),
            ]),
            h(
              "tbody",
              {},
              tables.map((row) =>
                h("tr", {}, [
                  h("td", {}, [
                    h("pre", {}, [h("code", {}, [row.schemaname])]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [
                      h("code", {}, [
                        h("a", { href: `/database/table/${row.tablename}` }, [
                          row.tablename,
                        ]),
                      ]),
                    ]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [h("code", {}, [row.tableowner])]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [h("code", {}, [row.tablespace ?? "<null>"])]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [
                      h("code", {}, [row.hasindexes ? "true" : "false"]),
                    ]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [
                      h("code", {}, [row.hasrules ? "true" : "false"]),
                    ]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [
                      h("code", {}, [row.hastriggers ? "true" : "false"]),
                    ]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [
                      h("code", {}, [row.rowsecurity ? "true" : "false"]),
                    ]),
                  ]),
                ]),
              ),
            ),
          ]),
        ],
      }),
    ),
  );
});

router.get("/database/table/:name", async (_, params) => {
  const tableName = params.name;
  if (typeof tableName !== "string") {
    return new MyResponse().html(
      render(
        await documentLayout({
          title: "No table name",
          main: [h("h1", {}, [`Invalid table name type: ${typeof tableName}`])],
        }),
      ),
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
    render(
      await documentLayout({
        title: "Tables",
        main: [
          h("h1", {}, [`Table: ${tableName}`]),
          h("a", { href: "/database/table" }, ["\u2039 List tables"]),
          h("table", { class: "table" }, [
            h("thead", {}, [
              h("tr", {}, [
                h("th", { scope: "col" }, ["table_name"]),
                h("th", { scope: "col" }, ["column_name"]),
                h("th", { scope: "col" }, ["data_type"]),
              ]),
            ]),
            h(
              "tbody",
              {},
              tables.map((row) =>
                h("tr", {}, [
                  h("td", {}, [
                    h("pre", {}, [h("code", {}, [row.table_name])]),
                  ]),
                  h("td", {}, [
                    h("pre", {}, [h("code", {}, [row.column_name])]),
                  ]),
                  h("td", {}, [h("pre", {}, [h("code", {}, [row.data_type])])]),
                ]),
              ),
            ),
          ]),
        ],
      }),
    ),
  );
});
