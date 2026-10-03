import { AxiError } from "axi-sdk-js";

export { AxiError };

export function missingApiKeyError() {
  return new AxiError(
    "SLITE_API_KEY is not set",
    "AUTH_ERROR",
    [
      "Generate a personal API key at https://slite.com -> Settings -> API",
      "Export it with: export SLITE_API_KEY=<key>",
    ],
  );
}

export function notFoundError(kind, id) {
  return new AxiError(`${kind} "${id}" not found`, "NOT_FOUND", [
    "Check the id and try again",
  ]);
}

/** Map a Slite API HTTP error response to a structured AxiError. */
export function apiError(status, body) {
  const message = (body && body.message) || `Slite API request failed with status ${status}`;
  if (status === 401 || status === 403) {
    return new AxiError(message, "AUTH_ERROR", [
      "Check that SLITE_API_KEY is valid and has not been revoked",
    ]);
  }
  if (status === 404) {
    return new AxiError(message, "NOT_FOUND", ["Check the id and try again"]);
  }
  if (status === 422) {
    const details = body && body.details ? JSON.stringify(body.details) : undefined;
    return new AxiError(
      details ? `${message}: ${details}` : message,
      "VALIDATION_ERROR",
    );
  }
  if (status === 429) {
    return new AxiError(message, "RATE_LIMIT", [
      "Wait and retry later",
    ]);
  }
  return new AxiError(message, "API_ERROR");
}

export function networkError(cause) {
  return new AxiError(
    `Could not reach the Slite API: ${cause.message}`,
    "NETWORK_ERROR",
    ["Check network connectivity and try again"],
  );
}
