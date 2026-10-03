import { test } from "node:test";
import assert from "node:assert/strict";
import { homeCommand } from "../src/commands/home.js";

test("homeCommand shows the authenticated identity and next-step hints", async () => {
  const client = {
    get: async (path) => {
      assert.equal(path, "/me");
      return { id: "u1", email: "a@b.com", name: "A" };
    },
  };
  const result = await homeCommand([], client);
  assert.deepEqual(result.authenticatedAs, { id: "u1", email: "a@b.com", name: "A" });
  assert.ok(result.help.length > 0);
});
