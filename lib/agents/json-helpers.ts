import { stripThinkingTags } from "./response-cleaner";

/**
 * Sanitize bare control characters inside JSON string values.
 *
 * LLMs frequently produce JSON where multi-paragraph content fields contain
 * literal 0x0A newlines (and occasionally other control chars) instead of
 * the \n escape sequences required by RFC 8259 § 7.
 *
 * The state machine correctly handles:
 *   - Newlines / tabs / CRs BETWEEN tokens (legal whitespace) — passed through
 *   - Newlines / tabs / CRs INSIDE strings (illegal) — escaped
 *   - Escaped quotes \" inside strings — backslash-escape flag prevents
 *     misclassifying \" as end-of-string
 *   - Already-correctly-escaped \\n sequences — not double-escaped because
 *     the backslash sets escape=true and the next 'n' (0x6E) hits the escape
 *     branch, never reaching the control-char check
 *   - ALL other control chars 0x00–0x1F inside strings — escaped as \uXXXX
 */
export function sanitizeJsonString(text: string): string {
  let result   = "";
  let inString = false;
  let escape   = false;

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i];
    const code = ch.charCodeAt(0);

    // Backslash-escape state: next char is part of an escape sequence, emit raw
    if (escape) { result += ch; escape = false; continue; }

    // Backslash inside a string starts an escape sequence
    if (ch === "\\") { result += ch; if (inString) escape = true; continue; }

    // Toggle in/out of string on unescaped double-quote
    if (ch === '"') { inString = !inString; result += ch; continue; }

    if (inString && code < 0x20) {
      // Named escapes for the three most common offenders
      if (ch === "\n") { result += "\\n";  continue; }
      if (ch === "\r") { result += "\\r";  continue; }
      if (ch === "\t") { result += "\\t";  continue; }
      // All other control characters (0x00–0x08, 0x0B–0x0C, 0x0E–0x1F)
      result += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }

    result += ch;
  }
  return result;
}

/** String-aware extraction of the first balanced `{...}` object from text. */
export function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let i = start, depth = 0, inStr = false, esc = false;
  while (i < text.length) {
    const ch = text[i];
    if (esc)           { esc = false; i++; continue; }
    if (inStr)         { if (ch === "\\") esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"')   inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
    i++;
  }
  return null;
}

/**
 * Extract and parse the first JSON object from a model response.
 *
 * Models frequently wrap JSON in prose, markdown code fences, preambles,
 * or produce multi-paragraph content fields with bare newlines (illegal in
 * JSON strings per RFC 8259). This function tries progressively more
 * aggressive recovery strategies before giving up.
 */
export function parseJsonResponse(text: string): Record<string, unknown> {
  // Generate candidate strings: raw, think-stripped, code-fence-stripped,
  // and the combination of both. Sanitized versions tried per-candidate below.
  const base = [
    text,
    stripThinkingTags(text),
    text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim(),
    stripThinkingTags(text).replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim(),
  ];

  for (const candidate of base) {
    const s = candidate.trim();
    if (!s) continue;

    // Pass 1: direct parse (clean responses, correctly escaped by model)
    if (tryParse(s)) return tryParse(s)!;

    // Pass 2: extract balanced {...} with string-aware bracket matching
    const extracted = extractFirstJsonObject(s);
    if (extracted) {
      if (tryParse(extracted)) return tryParse(extracted)!;
      // Pass 3: sanitize control chars, then re-parse the extracted block
      const sanitized = sanitizeJsonString(extracted);
      if (tryParse(sanitized)) return tryParse(sanitized)!;
    }

    // Pass 4: {start} to last } — handles trailing prose with no `}` in it
    const start     = s.indexOf("{");
    const lastClose = s.lastIndexOf("}");
    if (start !== -1 && lastClose > start) {
      const sliced = s.slice(start, lastClose + 1);
      if (tryParse(sliced)) return tryParse(sliced)!;
      const sanitized = sanitizeJsonString(sliced);
      if (tryParse(sanitized)) return tryParse(sanitized)!;
    }
  }

  throw new Error(`No valid JSON found in response: ${text.slice(0, 120)}`);
}

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const r = JSON.parse(s);
    if (r && typeof r === "object" && !Array.isArray(r)) return r as Record<string, unknown>;
  } catch { /* fall through */ }
  return null;
}
