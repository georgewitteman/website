import {
  secondsToMinsSecs,
  valueOrDefault,
} from "./microwave-time-calculator.js";

describe("secondsToMinsSecs", () => {
  [
    [100, { minutes: 1, seconds: 40 }],
    [60, { minutes: 1, seconds: 0 }],
    [0, { minutes: 0, seconds: 0 }],
    [1, { minutes: 0, seconds: 1 }],
    [120, { minutes: 2, seconds: 0 }],
  ].forEach(([input, expected]) => {
    it(`should convert ${input} to ${expected.minutes}m, ${expected.seconds}s`, () => {
      expect(secondsToMinsSecs(input)).toEqual(expected);
    });
  });
});

describe("valueOrDefault", () => {
  [0, 999, Number.MAX_SAFE_INTEGER].forEach((input) => {
    it(`should use the value for ${input}`, () => {
      expect(valueOrDefault(input, 1234)).toEqual(input);
    });
  });

  ["abc", "", "0", "a.1", true, false, NaN, null].forEach((input) => {
    it(`should use defaults for ${String(input)}`, () => {
      expect(valueOrDefault(input, 1234)).toEqual(1234);
    });
  });
});
