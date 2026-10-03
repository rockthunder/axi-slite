import { test } from "node:test";
import assert from "node:assert/strict";
import { main } from "../src/cli.js";

function captureStdout() {
  const chunks = [];
  return {
    write: (chunk) => chunks.push(chunk),
    text: () => chunks.join(""),
  };
}

test("bare --help prints the top-level usage without hitting the network", async () => {
  const stdout = captureStdout();
  await main({ argv: ["--help"], stdout });
  assert.match(stdout.text(), /usage: slite-axi/);
});

test("an unset SLITE_API_KEY surfaces a structured AUTH_ERROR instead of throwing raw", async () => {
  const savedKey = process.env.SLITE_API_KEY;
  const savedExitCode = process.exitCode;
  delete process.env.SLITE_API_KEY;
  const stdout = captureStdout();
  try {
    await main({ argv: ["me"], stdout });
    assert.notEqual(process.exitCode, 0);
  } finally {
    if (savedKey !== undefined) process.env.SLITE_API_KEY = savedKey;
    process.exitCode = savedExitCode;
  }
  assert.match(stdout.text(), /AUTH_ERROR|SLITE_API_KEY/);
});

test("`me` renders the authenticated user via a mocked fetch", async () => {
  process.env.SLITE_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url.pathname, "/v1/me");
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ id: "u1", email: "a@b.com", name: "A" }),
    };
  };
  const stdout = captureStdout();
  try {
    await main({ argv: ["me"], stdout });
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.SLITE_API_KEY;
  }
  const output = stdout.text();
  assert.match(output, /u1/);
  assert.match(output, /a@b\.com/);
});
