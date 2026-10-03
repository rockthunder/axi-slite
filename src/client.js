import { apiError, missingApiKeyError, networkError } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.slite.com/v1";

/**
 * Build a thin REST client bound to a Slite API key. Accepts an injectable
 * `fetchImpl` so tests never perform real network calls.
 */
export function createClient({
  apiKey = process.env.SLITE_API_KEY,
  baseUrl = process.env.SLITE_API_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    throw missingApiKeyError();
  }

  async function request(path, { method = "GET", query, body } = {}) {
    const url = new URL(baseUrl.replace(/\/$/, "") + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          "x-slite-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw networkError(cause);
    }

    if (response.status === 204) {
      return undefined;
    }

    const text = await response.text();
    const data = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw apiError(response.status, data);
    }

    return data;
  }

  return {
    get: (path, options) => request(path, { ...options, method: "GET" }),
    post: (path, body, options) => request(path, { ...options, method: "POST", body }),
    put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
    delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
