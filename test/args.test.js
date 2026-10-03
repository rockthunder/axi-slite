import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureNoUnknownFlags,
  parseIntFlag,
  requirePositional,
  takeAllFlag,
  takeBoolFlag,
  takeFlag,
} from "../src/args.js";

test("requirePositional returns the value when present", () => {
  assert.equal(requirePositional(["abc"], 0, "id"), "abc");
});

test("requirePositional throws a structured error when missing", () => {
  assert.throws(() => requirePositional([], 0, "id"), /id is required/);
});

test("requirePositional throws when the slot holds a flag instead", () => {
  assert.throws(() => requirePositional(["--full"], 0, "id"), /id is required/);
});

test("takeFlag reads --name value form and mutates the array", () => {
  const flags = ["--title", "Hello", "--full"];
  assert.equal(takeFlag(flags, "--title"), "Hello");
  assert.deepEqual(flags, ["--full"]);
});

test("takeFlag reads --name=value form", () => {
  const flags = ["--title=Hello"];
  assert.equal(takeFlag(flags, "--title"), "Hello");
  assert.deepEqual(flags, []);
});

test("takeFlag returns undefined when absent", () => {
  assert.equal(takeFlag([], "--title"), undefined);
});

test("takeFlag throws when the value looks like another flag", () => {
  assert.throws(() => takeFlag(["--title", "--full"], "--title"));
});

test("takeAllFlag collects every occurrence", () => {
  const flags = ["--tag", "a", "--tag", "b"];
  assert.deepEqual(takeAllFlag(flags, "--tag"), ["a", "b"]);
  assert.deepEqual(flags, []);
});

test("takeBoolFlag removes a bare flag and reports presence", () => {
  const flags = ["--force", "--other"];
  assert.equal(takeBoolFlag(flags, "--force"), true);
  assert.deepEqual(flags, ["--other"]);
  assert.equal(takeBoolFlag(flags, "--force"), false);
});

test("ensureNoUnknownFlags passes when nothing remains", () => {
  assert.doesNotThrow(() => ensureNoUnknownFlags([]));
});

test("ensureNoUnknownFlags throws on leftover flag-shaped tokens", () => {
  assert.throws(() => ensureNoUnknownFlags(["--bogus"]), /Unknown flag/);
});

test("parseIntFlag parses integers and rejects non-integers", () => {
  assert.equal(parseIntFlag("5", "--n"), 5);
  assert.equal(parseIntFlag(undefined, "--n"), undefined);
  assert.throws(() => parseIntFlag("abc", "--n"));
});
