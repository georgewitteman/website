import packageJson from "../../package.json";
import { randomUUID } from "crypto";
import { Router } from "express";

export const router = Router();

router.get("/uuid", (_, res) => {
  res.status(200).type("text").send(randomUUID());
});

router.get("/version", (_, res) => {
  res.status(200).type("text").send(packageJson.version);
});
