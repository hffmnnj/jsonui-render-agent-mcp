import { describe, expect, it } from "bun:test";
import { main } from "../src/index";

describe("entry point stub", () => {
  it("main resolves without throwing", async () => {
    await expect(main()).resolves.toBeUndefined();
  });
});
