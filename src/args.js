import { AxiError } from "./errors.js";

/** Read positional argument `index`, or throw a structured error. */
export function requirePositional(args, index, label) {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new AxiError(`${label} is required`, "VALIDATION_ERROR");
  }
  return value;
}

/** Remove and return the first occurrence of `--name <value>` or `--name=value`. Mutates `flags`. */
export function takeFlag(flags, name) {
  for (let i = 0; i < flags.length; i++) {
    const arg = flags[i];
    if (arg === name) {
      const value = flags[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new AxiError(`${name} requires a value`, "VALIDATION_ERROR");
      }
      flags.splice(i, 2);
      return value;
    }
    if (arg.startsWith(`${name}=`)) {
      flags.splice(i, 1);
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

/** Remove and return every occurrence of a repeatable flag. Mutates `flags`. */
export function takeAllFlag(flags, name) {
  const values = [];
  let value = takeFlag(flags, name);
  while (value !== undefined) {
    values.push(value);
    value = takeFlag(flags, name);
  }
  return values;
}

/** Remove and return whether a boolean flag (no value) is present. Mutates `flags`. */
export function takeBoolFlag(flags, name) {
  const index = flags.indexOf(name);
  if (index === -1) return false;
  flags.splice(index, 1);
  return true;
}

/** Throw if any `--flag`-shaped token remains unconsumed. */
export function ensureNoUnknownFlags(flags) {
  const unknown = flags.find((arg) => arg.startsWith("-"));
  if (unknown) {
    throw new AxiError(`Unknown flag: ${unknown}`, "VALIDATION_ERROR", [
      "Run with --help to see supported flags",
    ]);
  }
}

export function parseIntFlag(value, name) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new AxiError(`${name} must be an integer`, "VALIDATION_ERROR");
  }
  return n;
}
