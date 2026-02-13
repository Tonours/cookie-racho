import { describe, expect, test } from "bun:test";

import { inferBatchFriendly } from "./batch";

describe("inferBatchFriendly", () => {
  test("detects batch-friendly hints", () => {
    expect(
      inferBatchFriendly({
        name: "X",
        description: "Se cong\u00e8le tr\u00e8s bien.",
        steps: []
      })
    ).toBe(true);

    expect(
      inferBatchFriendly({
        name: "X",
        description: "",
        steps: [{ description: "Vous pouvez congeler le plat." }]
      })
    ).toBe(true);
  });

  test("returns false when no hint matches", () => {
    expect(
      inferBatchFriendly({
        name: "Salade",
        description: "",
        steps: [{ description: "M\u00e9langer." }]
      })
    ).toBe(false);
  });
});
