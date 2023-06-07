import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { html } from "../html.js";
import { documentLayout } from "../layout.js";
import { listMigrations } from "../migrations.js";

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
            <tr><th scope="col">Name</th></td>
        </thead>
        <tbody>
          ${migrations.map(
            (name) =>
              html`
                <tr>
                  <td>${name}</td>
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

// router.get("/migration/:name", async (req) => {
//   const migrations = await listMigrations();
//   return MyResponse.html(
//     200,
//     {},
//     documentLayout({
//       title: "Migrations",
//       body: html`
//       <header>
//         <nav><a href="/">&lsaquo; Home</a><br /></nav>
//       </header>
//       <main>
//         <h1>Migrations</h1>
//         <table>
//           <thead>
//             <tr><th scope="col">Name</th></td>
//         </thead>
//         <tbody>
//           ${migrations.map(
//             (name) =>
//               html`
//                 <tr>
//                   <td>${name}</td>
//                 </tr>
//               `,
//           )}
//         </tbody>
//         </table>
//       </main>
//     `,
//     }),
//   );
// });
