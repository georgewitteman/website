import { createServer } from "node:http";
import { MyRequest } from "./Request.js";
import { MyResponse } from "./Response.js";
import { logger } from "./logger.js";

export class App {
  constructor() {
    /** @type {((req: MyRequest, next: () => Promise<MyResponse>) => Promise<MyResponse>)[]} */
    this.middleware = [];
  }

  /**
   * @param {(req: MyRequest, next: () => Promise<MyResponse>) => Promise<MyResponse>} middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * @param {MyRequest} req
   * @returns {Promise<MyResponse>}
   */
  async handleRequest(req) {
    let index = -1;
    /**
     * https://github.com/koajs/compose/blob/master/index.js
     * @param {number} i
     * @returns {Promise<MyResponse>}
     */
    const dispatch = async (i) => {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      if (i >= this.middleware.length) {
        return new MyResponse(500, {}, "");
      }
      const fn = this.middleware[i];
      if (!fn) {
        throw new Error("middleware was not a function");
      }
      return await fn(req, dispatch.bind(null, i + 1));
    };
    return await dispatch(0);
  }

  createServer() {
    return createServer((nodeRequest, nodeResponse) => {
      if (typeof nodeRequest.headers.host !== "string") {
        // RFC 7230: "A server MUST respond with a 400 (Bad Request) status code to
        // any HTTP/1.1 request message that lacks a Host header field and to any
        // request message that contains more than one Host header field or a Host
        // header field with an invalid field-value."
        //
        // https://github.com/nodejs/node/issues/3094#issue-108564685
        nodeResponse.writeHead(400);
        nodeResponse.end("Missing Host header");
        return;
      }
      if (
        !nodeRequest.method ||
        !["GET", "POST"].includes(nodeRequest.method)
      ) {
        // When a request method is received that is unrecognized or not implemented
        // by an origin server, the origin server SHOULD respond with the 501 (Not
        // Implemented) status code.  When a request method is received that is
        // known by an origin server but not allowed for the target resource, the
        // origin server SHOULD respond with the 405 (Method Not Allowed) status
        // code.
        nodeResponse.writeHead(501);
        nodeResponse.end(`Unsupported method: ${nodeRequest.method}`);
        return;
      }
      const req = new MyRequest(nodeRequest.method, nodeRequest);
      this.handleRequest(req)
        .then((res) => {
          nodeResponse.writeHead(res.statusCode, res.headers).end(res.body);
        })
        .catch((e) => {
          logger.error("Request error", nodeRequest.url, e);
          nodeResponse.writeHead(500).end("Internal Server Error");
        });
    });
  }
}
