import express from "express";
import { router as utilsRouter } from "../routes/utils.js";
import morgan from "morgan";
import helmet from "helmet";
import { config } from "./config.js";
import nunjucks from "nunjucks";

export const app = express();

// https://mozilla.github.io/nunjucks/getting-started.html
nunjucks.configure("views", {
  autoescape: true,
  express: app,
});
app.set("view engine", "njk");

// https://expressjs.com/en/advanced/best-practice-security.html#reduce-fingerprinting
app.disable("x-powered-by");

// https://expressjs.com/en/guide/behind-proxies.html
app.set("trust proxy", config.express.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: config.helmet.contentSecurityPolicy,
    strictTransportSecurity: config.helmet.strictTransportSecurity,
  }),
);
app.use(morgan("combined"));
app.use(express.static("static"));
app.use(express.json());
app.use(utilsRouter);

app.get("/test", (_req, res) => {
  res.render("test", { hello: "Hello, ", world: "world!" });
});
