import { describe, expect, test } from "bun:test";

import { normalizeInstructionsToSteps } from "./steps";

describe("normalizeInstructionsToSteps", () => {
  test("handles array of strings", () => {
    expect(normalizeInstructionsToSteps(["A", "B"]).map((s) => s.description)).toEqual(["A", "B"]);
  });

  test("handles newline-separated strings", () => {
    expect(normalizeInstructionsToSteps("A\nB").map((s) => s.description)).toEqual(["A", "B"]);
  });

  test("handles HowToStep objects", () => {
    const instructions = [
      { "@type": "HowToStep", text: "Cuire 10 min." },
      { "@type": "HowToStep", text: "Laisser reposer 1 h 30." }
    ];

    expect(normalizeInstructionsToSteps(instructions)).toEqual([
      { description: "Cuire 10 min.", minutes: 10 },
      { description: "Laisser reposer 1 h 30.", minutes: 90 }
    ]);
  });

  test("handles itemListElement containers", () => {
    const instructions = {
      itemListElement: [{ text: "A" }, { text: "B" }]
    };

    expect(normalizeInstructionsToSteps(instructions).map((s) => s.description)).toEqual(["A", "B"]);
  });

  test("handles steps containers", () => {
    const instructions = {
      steps: ["A", "B"]
    };

    expect(normalizeInstructionsToSteps(instructions).map((s) => s.description)).toEqual(["A", "B"]);
  });

  test("uses name when HowToStep has no text", () => {
    const instructions = [{ "@type": ["HowToStep"], name: "FromName" }];
    expect(normalizeInstructionsToSteps(instructions)).toEqual([{ description: "FromName" }]);
  });

  test("strips leading numbering", () => {
    expect(normalizeInstructionsToSteps("1. A\n2. B").map((s) => s.description)).toEqual(["A", "B"]);
  });

  test("extracts hours-only durations", () => {
    expect(normalizeInstructionsToSteps(["Laisser reposer 1 h.", "OK"]).at(0)).toEqual({
      description: "Laisser reposer 1 h.",
      minutes: 60
    });
  });

  test("splits single-line instructions into sentences", () => {
    expect(normalizeInstructionsToSteps("A. B.").map((s) => s.description)).toEqual(["A", "B"]);
  });

  test("returns empty array for unknown instruction objects", () => {
    expect(normalizeInstructionsToSteps({ foo: "bar" })).toEqual([]);
  });

  test("handles unexpected @type shapes", () => {
    expect(normalizeInstructionsToSteps([{ "@type": 123, name: "X" }])).toEqual([]);
  });
});
