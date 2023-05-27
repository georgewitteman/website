export class SafeHTML {
  /** @readonly */
  value;

  /**
   * @param {string} value
   */
  constructor(value) {
    this.value = value;
  }
}

/**
 * Allows passing unsafe HTML as a value.
 *
 * ```js
 * const safeQueryResult = "<script>alert('hi')</script>";
 * console.log(html`this is safe: ${unescaped(safeQueryResult)}`)
 * ```
 *
 * @param {string} value
 * @returns {SafeHTML}
 */
export function unescaped(value) {
  return new SafeHTML(value);
}

/**
 * https://github.com/zspecza/common-tags/blob/master/src/safeHtml/safeHtml.js
 * @param {string | SafeHTML} unsafe
 */
function escapeHtml(unsafe) {
  if (unsafe instanceof SafeHTML) {
    return unsafe;
  }
  return new SafeHTML(
    unsafe
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")
      .replaceAll("`", "&#x60;")
  );
}

/**
 * @param {unknown} value
 * @returns {SafeHTML}
 */
function getEscapedValue(value) {
  if (value instanceof SafeHTML) {
    return value;
  }
  if (typeof value === "string") {
    return escapeHtml(value);
  }
  if (value === null || value === undefined) {
    return escapeHtml("");
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !isNaN(value) &&
    value <= Number.MAX_SAFE_INTEGER &&
    value >= Number.MIN_SAFE_INTEGER
  ) {
    return escapeHtml(value.toString());
  }
  if (Array.isArray(value)) {
    return /** @type {typeof value.reduce<SafeHTML>} */ (value.reduce)(
      (result, value) => {
        const safeValue = getEscapedValue(value);
        return new SafeHTML("".concat(result.value, safeValue.value));
      },
      new SafeHTML("")
    );
  }
  throw new Error(
    `Unable to safely convert ${value} (${typeof value}) to a string`
  );
}

/**
 * @typedef {string | number | SafeHTML | null | undefined} AllowedValues
 */

/**
 * https://github.com/zspecza/common-tags
 * @param {TemplateStringsArray} strings
 * @param {(AllowedValues | AllowedValues[])[]} values
 */
export function html(strings, ...values) {
  return new SafeHTML(
    strings.reduce((previousValue, currentValue, currentIndex) => {
      return "".concat(
        previousValue,
        getEscapedValue(values[currentIndex - 1]).value,
        currentValue
      );
    })
  );
}
