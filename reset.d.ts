// Do not add any other lines of code to this file!
import "@total-typescript/ts-reset";
import { z } from "zod";
import { SessionSchema } from "./lib/session.js";

declare module "fastify" {
  interface Session {
    user_id?: string | undefined;
    expires_at?: Date | undefined;
    cookie: z.infer<typeof SessionSchema>["cookie"];
  }
}
