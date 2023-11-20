import express from "express";
import { router as utilsRouter } from "../routes/utils.js";
import morgan from "morgan";
import helmet from "helmet";
import { config } from "./config.js";

export const app = express();

// https://expressjs.com/en/advanced/best-practice-security.html#reduce-fingerprinting
app.disable("x-powered-by");

app.set("trust proxy", config.express.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: config.helmet.contentSecurityPolicy,
    strictTransportSecurity: config.helmet.strictTransportSecurity,
  }),
);
app.use(morgan("common"));
app.use(express.static("static"));
app.use(express.json());
app.use(utilsRouter);
