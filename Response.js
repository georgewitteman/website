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
   * @param {Buffer | string} data
   */
  end(data) {
    if (this.#endCalled) {
      throw new Error("Already called end")
    }
    this.#endCalled = true;
    this._UNSAFE_serverResponse.end(data);
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
