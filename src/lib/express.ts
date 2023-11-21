import { Request, Response, RequestHandler } from "express";

export const wrapAsyncRoute =
  (route: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    route(req, res).catch(next);
  };
