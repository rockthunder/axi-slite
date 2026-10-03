import { test } from "node:test";
import assert from "node:assert/strict";
import { pick, withTruncation } from "../src/format.js";

test("withTruncation passes short content through untouched", () => {
  const result = withTruncation("short text", { limit: 100 });
  assert.deepEqual(result, { content: "short text", truncated: false });
});

test("withTruncation truncates long content with a hint", () => {
  const long = "x".repeat(50);
  const result = withTruncation(long, { limit: 10 });
  assert.equal(result.truncated, true);
  assert.equal(result.content.length, 10);
  assert.equal(result.fullLength, 50);
  assert.match(result.hint, /--full/);
});

test("withTruncation skips truncation when full=true", () => {
  const long = "x".repeat(50);
  const result = withTruncation(long, { limit: 10, full: true });
  assert.equal(result.truncated, false);
  assert.equal(result.content.length, 50);
});

test("withTruncation leaves non-string content untouched", () => {
  assert.deepEqual(withTruncation(undefined), { content: undefined, truncated: false });
});

test("pick projects only the requested, present fields", () => {
  const obj = { a: 1, b: 2, c: undefined };
  assert.deepEqual(pick(obj, ["a", "c", "missing"]), { a: 1 });
});
