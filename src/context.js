import { createClient } from "./client.js";

/** Build the shared Slite API client used as command context. */
export function resolveSliteContext() {
  return createClient();
}
