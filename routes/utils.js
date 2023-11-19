import { MyResponse } from "../lib/response.js";
import { Router } from "../lib/router.js";
import { randomUUID } from "crypto";

export const router = new Router();

router.get("/uuid", async () => {
  return new MyResponse(200)
    .header("Content-Type", "text/plain; charset=utf-8")
    .body(randomUUID());
});
