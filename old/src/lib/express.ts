import { Request, Response, RequestHandler, NextFunction } from "express";

export const wrapAsyncRoute =
  (
    route: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  ): RequestHandler =>
  (req, res, next) => {
    route(req, res, next).catch(next);
  };
