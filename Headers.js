export class ReadonlyHeaders {
  /** @type {ReadonlyMap<string, string | string[]>} */
  #map;

  /**
   * @param {Iterable<readonly [string, string | string[] | undefined]>} entries
   */
  constructor(entries) {
    /** @type {Map<string, string | string[]>} */
    const map = new Map();
    for (const [key, value] of entries) {
      if (value === undefined) {
        continue;
      }
      map.set(key.toLocaleLowerCase(), value);
    }

    this.#map = map;
  }

  /**
   * @param {string} key
   */
  get(key) {
    return this.#map.get(key.toLocaleLowerCase());
  }

  /**
   * @param {string} key
   */
  has(key) {
    return this.#map.has(key.toLocaleLowerCase());
  }

  toJSON() {
    return Object.fromEntries(this.#map.entries());
  }
}
