import { describe, expect, test } from "bun:test";

import { parseIso8601DurationToMinutes } from "./duration";

describe("parseIso8601DurationToMinutes", () => {
  test("parses minutes", () => {
    expect(parseIso8601DurationToMinutes("PT20M")).toBe(20);
  });

  test("parses hours", () => {
    expect(parseIso8601DurationToMinutes("PT1H")).toBe(60);
  });

  test("parses hours + minutes", () => {
    expect(parseIso8601DurationToMinutes("PT1H30M")).toBe(90);
  });

  test("parses days + time", () => {
    expect(parseIso8601DurationToMinutes("P1DT2H5M")).toBe(1565);
  });

  test("rounds seconds up to the next minute", () => {
    expect(parseIso8601DurationToMinutes("PT30S")).toBe(1);
    expect(parseIso8601DurationToMinutes("PT61S")).toBe(2);
  });

  test("returns null for invalid or empty", () => {
    expect(parseIso8601DurationToMinutes("")).toBeNull();
    expect(parseIso8601DurationToMinutes("nope")).toBeNull();
    expect(parseIso8601DurationToMinutes("P")).toBeNull();
  });
});
