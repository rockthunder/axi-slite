const DEFAULT_CONTENT_LIMIT = 4000;

/** Apply AXI's "truncate with escape hatch" principle to long text fields. */
export function withTruncation(content, { full = false, limit = DEFAULT_CONTENT_LIMIT } = {}) {
  if (typeof content !== "string" || full || content.length <= limit) {
    return { content, truncated: false };
  }
  return {
    content: content.slice(0, limit),
    truncated: true,
    fullLength: content.length,
    hint: "pass --full for the complete content",
  };
}

/** Project an object down to a minimal default field set. */
export function pick(obj, fields) {
  const out = {};
  for (const field of fields) {
    if (obj[field] !== undefined) out[field] = obj[field];
  }
  return out;
}
