import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupCommand,
  groupsCommand,
  meCommand,
  userCommand,
  usersCommand,
} from "../src/commands/identity.js";

function fakeClient(impl) {
  return { get: impl.get ?? (async () => { throw new Error("unexpected get"); }) };
}

test("meCommand returns a minimal projection of the authenticated user", async () => {
  const client = fakeClient({
    get: async (path) => {
      assert.equal(path, "/me");
      return { id: "u1", email: "a@b.com", name: "A", username: "a", secret: "drop" };
    },
  });
  const result = await meCommand([], client);
  assert.deepEqual(result, { id: "u1", email: "a@b.com", name: "A", username: "a" });
});

test("meCommand rejects unexpected flags", async () => {
  await assert.rejects(() => meCommand(["--bogus"], fakeClient({})), /Unknown flag/);
});

test("userCommand fetches by id", async () => {
  const client = fakeClient({
    get: async (path) => {
      assert.equal(path, "/users/u2");
      return { id: "u2", email: "x@y.com", name: "X" };
    },
  });
  const result = await userCommand(["u2"], client);
  assert.equal(result.id, "u2");
});

test("usersCommand supports a fuzzy query and an exact --email lookup", async () => {
  const client = fakeClient({
    get: async (_path, opts) => {
      if (opts.query.email) return { users: [{ id: "u3", email: opts.query.email }] };
      return { users: [{ id: "u4", name: opts.query.query }] };
    },
  });

  const byEmail = await usersCommand(["--email", "x@y.com"], client);
  assert.equal(byEmail.users[0].email, "x@y.com");

  const byQuery = await usersCommand(["jane"], client);
  assert.equal(byQuery.users[0].name, "jane");
});

test("groupCommand and groupsCommand project minimal fields", async () => {
  const client = fakeClient({
    get: async (path, opts) => {
      if (path === "/groups/g1") return { id: "g1", name: "Eng", secret: "drop" };
      if (path === "/groups") return { groups: [{ id: "g2", name: opts.query.query }] };
      throw new Error("unexpected " + path);
    },
  });
  assert.deepEqual(await groupCommand(["g1"], client), { id: "g1", name: "Eng" });
  const result = await groupsCommand(["engineering"], client);
  assert.deepEqual(result.groups, [{ id: "g2", name: "engineering" }]);
});
