/**
 * Image input normalizer for the MCP server.
 *
 * Agents pass images in many forms — base64, file paths, URLs, data URIs.
 * The API expects pure base64 (no data: prefix). This function handles all cases.
 *
 * Why this matters: this is the difference between an agent that "just works"
 * and one that burns 20 turns on base64 encoding.
 */

import { readFile } from "node:fs/promises";

const DATA_URL_RE = /^data:image\/[a-z+.-]+;base64,/i;
// Looks like base64 if: only [A-Za-z0-9+/=], length > 200, no spaces/newlines.
const BASE64_RE = /^[A-Za-z0-9+/=]+$/;
const URL_RE = /^https?:\/\//i;

export async function normalizeImage(input: string): Promise<string> {
  if (!input || typeof input !== "string") {
    throw new Error("image must be a non-empty string");
  }

  // 1. data: URI → strip prefix
  if (DATA_URL_RE.test(input)) {
    const idx = input.indexOf(",");
    return idx === -1 ? input : input.slice(idx + 1);
  }

  // 2. http(s) URL → fetch and base64-encode
  if (URL_RE.test(input)) {
    const res = await fetch(input);
    if (!res.ok) {
      throw new Error(`Failed to fetch image from URL: ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  }

  // 3. Already base64 (long, all valid chars, single line)
  // Heuristic: if it's longer than 200 chars and has no newlines/spaces and matches base64 charset, trust it.
  if (
    input.length > 200 &&
    !input.includes("\n") &&
    !input.includes(" ") &&
    BASE64_RE.test(input)
  ) {
    return input;
  }

  // 4. Otherwise, treat as filesystem path
  try {
    const buf = await readFile(input);
    return buf.toString("base64");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `image input is not a data URI, URL, valid base64, or readable file path. Path resolution error: ${msg}`,
    );
  }
}
