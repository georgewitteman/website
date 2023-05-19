export class Response {
  /** @type {import("node:http").ServerResponse} */
  _UNSAFE_serverResponse;

  /** @type {boolean} */
  #headWritten;

  /** @type {boolean} */
  #endCalled;

  /**
   * @param {import("node:http").ServerResponse} res
   */
  constructor(res) {
    this._UNSAFE_serverResponse = res;
    this.#headWritten = false;
    this.#endCalled = false;
  }

  /**
   *
   * @param {number} statusCode
   * @param {import("node:http").OutgoingHttpHeaders} [headers]
   */
  writeHead(statusCode, headers) {
    if (this.#headWritten) {
      throw new Error("Already called writeHead")
    }
    this.#headWritten = true;
    this._UNSAFE_serverResponse.writeHead(statusCode, headers);
  }

  /**
   * https://nodejs.org/docs/latest-v18.x/api/http.html#class-httpserverresponse
   * https://nodejs.org/docs/latest-v18.x/api/http.html#outgoingmessagewritechunk-encoding-callback
   * https://nodejs.org/docs/latest-v18.x/api/stream.html#writablewritechunk-encoding-callback
   * @param {Buffer | string} data
   * @returns {Promise<void>}
  */
 writeToKernelBuffer(data) {
   return new Promise((resolve) => {
      // https://nodejs.org/docs/latest-v18.x/api/stream.html#writablewritechunk-encoding-callback
      if (!this._UNSAFE_serverResponse.write(data)) {
        this._UNSAFE_serverResponse.once('drain', resolve);
      } else {
        resolve()
      }
    })
  }

  end() {
    if (this.#endCalled) {
      throw new Error("Already called end")
    }
    this.#endCalled = true;
    this._UNSAFE_serverResponse.end();
  }

  get headersSent() {
    return this.#headWritten;
  }

  get statusCode() {
    if (!this.#headWritten) {
      return undefined;
    }
    return this._UNSAFE_serverResponse.statusCode;
  }

  get statusMessage() {
    if (!this.#headWritten) {
      return undefined;
    }
    return this._UNSAFE_serverResponse.statusMessage;
  }
}
