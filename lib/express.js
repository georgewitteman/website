/**
 * @param {(req: import("express").Request, res: import("express").Response) => Promise<void>} route
 * @returns {import("express").RequestHandler}
 */
export const wrapAsyncRoute = (route) => (req, res, next) => {
  route(req, res).catch(next);
};
