import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/client.js";

function fakeFetch(handler) {
  return async (url, init) => handler(url, init);
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  };
}

test("createClient throws a structured error without an API key", () => {
  const saved = process.env.SLITE_API_KEY;
  delete process.env.SLITE_API_KEY;
  try {
    assert.throws(() => createClient({ fetchImpl: fakeFetch(() => jsonResponse(200, {})) }), /AUTH_ERROR|SLITE_API_KEY/);
  } finally {
    if (saved !== undefined) process.env.SLITE_API_KEY = saved;
  }
});

test("get() sends the api key header and builds the query string", async () => {
  let seenUrl, seenInit;
  const client = createClient({
    apiKey: "key-123",
    fetchImpl: fakeFetch((url, init) => {
      seenUrl = url;
      seenInit = init;
      return jsonResponse(200, { ok: true });
    }),
  });

  const result = await client.get("/search-notes", { query: { query: "hi", page: 0, empty: "", skip: undefined } });

  assert.deepEqual(result, { ok: true });
  assert.equal(seenUrl.pathname, "/v1/search-notes");
  assert.equal(seenUrl.searchParams.get("query"), "hi");
  assert.equal(seenUrl.searchParams.get("page"), "0");
  assert.equal(seenUrl.searchParams.has("empty"), false);
  assert.equal(seenUrl.searchParams.has("skip"), false);
  assert.equal(seenInit.method, "GET");
  assert.equal(seenInit.headers["x-slite-api-key"], "key-123");
});

test("post() serializes the body as JSON", async () => {
  let seenInit;
  const client = createClient({
    apiKey: "key-123",
    fetchImpl: fakeFetch((_url, init) => {
      seenInit = init;
      return jsonResponse(200, { id: "n1" });
    }),
  });

  await client.post("/notes", { title: "Hello" });
  assert.equal(seenInit.method, "POST");
  assert.equal(seenInit.body, JSON.stringify({ title: "Hello" }));
});

test("a 204 response resolves to undefined", async () => {
  const client = createClient({
    apiKey: "key-123",
    fetchImpl: fakeFetch(() => ({ status: 204, ok: true, text: async () => "" })),
  });
  assert.equal(await client.delete("/notes/n1"), undefined);
});

test("a non-2xx response throws a structured AxiError", async () => {
  const client = createClient({
    apiKey: "key-123",
    fetchImpl: fakeFetch(() => jsonResponse(404, { message: "not found", id: "note/not-found" })),
  });

  await assert.rejects(
    () => client.get("/notes/missing"),
    (err) => {
      assert.equal(err.code, "NOT_FOUND");
      assert.match(err.message, /not found/);
      return true;
    },
  );
});

test("a 401 response maps to AUTH_ERROR", async () => {
  const client = createClient({
    apiKey: "bad-key",
    fetchImpl: fakeFetch(() => jsonResponse(401, { message: "Invalid apiKey" })),
  });

  await assert.rejects(() => client.get("/me"), (err) => {
    assert.equal(err.code, "AUTH_ERROR");
    return true;
  });
});

test("a rejected fetch promise maps to NETWORK_ERROR", async () => {
  const client = createClient({
    apiKey: "key-123",
    fetchImpl: async () => {
      throw new Error("ECONNRESET");
    },
  });

  await assert.rejects(() => client.get("/me"), (err) => {
    assert.equal(err.code, "NETWORK_ERROR");
    return true;
  });
});
