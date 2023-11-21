import { randomUUID } from "crypto";
import { Router } from "express";

export const router = Router();

router.get("/uuid", (_, res) => {
  res.status(200).type("text").send(randomUUID());
});
