import { describe, it, expect } from "vitest";
import { sanitizeJsonString, parseJsonResponse } from "@/lib/agents/json-helpers";

// ─── sanitizeJsonString — the four edge cases ─────────────────────────────────

describe("sanitizeJsonString — Case 1: newlines between tokens vs inside strings", () => {
  it("passes through newlines that appear between JSON tokens (legal whitespace)", () => {
    // These \n are OUTSIDE strings — legal JSON whitespace, must not be touched
    const input = '{\n  "title": "Hello",\n  "content": "world"\n}';
    const result = sanitizeJsonString(input);
    // Structure newlines survive unchanged
    expect(result).toContain('{\n  "title"');
    expect(result).toContain('"content": "world"\n}');
    // Still valid JSON after sanitization
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("escapes bare newlines INSIDE string values", () => {
    const input = '{\n  "content": "Para one.\nPara two."\n}';
    const result = sanitizeJsonString(input);
    // The newline inside the string must be escaped
    expect(result).toContain('"Para one.\\nPara two."');
    // The structural newlines around the keys must survive
    expect(result).toContain('{\n  "content"');
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).content).toBe("Para one.\nPara two.");
  });

  it("handles multiple paragraphs with multiple bare newlines inside a string", () => {
    const input = `{"content": "Para one.\n\nPara two.\n\nPara three."}`;
    const result = sanitizeJsonString(input);
    const parsed = JSON.parse(result);
    expect(parsed.content).toBe("Para one.\n\nPara two.\n\nPara three.");
  });
});

describe("sanitizeJsonString — Case 2: escaped quotes inside strings", () => {
  it("does not misclassify \\\" as end-of-string, handles newline after escaped quote", () => {
    // The \" inside the string must not flip inString=false
    const input = '{"content": "She said \\"hello\\"\nand walked away."}';
    const result = sanitizeJsonString(input);
    expect(result).toContain('"She said \\"hello\\"\\nand walked away."');
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.content).toBe('She said "hello"\nand walked away.');
  });

  it("handles multiple escaped quotes followed by a newline", () => {
    const input = '{"q": "\\"A\\" or \\"B\\"?\nAnswer here."}';
    const result = sanitizeJsonString(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).q).toBe('"A" or "B"?\nAnswer here.');
  });

  it("handles escaped backslash before a quote (\\\\\" pattern)", () => {
    // "\\\"\n" in source = literal backslash + escaped-quote + newline in JSON string
    // After sanitization the \n should become \\n
    const input = '{"path": "C:\\\\file\\"\nmore"}';
    const result = sanitizeJsonString(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe("sanitizeJsonString — Case 3: all control chars 0x00–0x1F", () => {
  it("escapes \\n (0x0A) as \\\\n", () => {
    const input = '{"a": "line1\nline2"}';
    expect(JSON.parse(sanitizeJsonString(input)).a).toBe("line1\nline2");
  });

  it("escapes \\r (0x0D) as \\\\r", () => {
    const input = '{"a": "line1\rline2"}';
    expect(JSON.parse(sanitizeJsonString(input)).a).toBe("line1\rline2");
  });

  it("escapes \\t (0x09) as \\\\t", () => {
    const input = '{"a": "col1\tcol2"}';
    expect(JSON.parse(sanitizeJsonString(input)).a).toBe("col1\tcol2");
  });

  it("escapes control char 0x01 inside a string as \\u0001", () => {
    const input = `{"a": "before\x01after"}`;
    const result = sanitizeJsonString(input);
    expect(result).toContain("\\u0001");
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).a).toBe("before\x01after");
  });

  it("escapes control char 0x0B (vertical tab) inside a string as \\u000b", () => {
    const input = `{"a": "before\x0Bafter"}`;
    const result = sanitizeJsonString(input);
    expect(result).toContain("\\u000b");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("does NOT escape control chars that appear outside strings (leave structural chars alone)", () => {
    // A tab between tokens is legal JSON whitespace — sanitizer must not touch it
    const input = '{\t"key":\t"value"\t}';
    const result = sanitizeJsonString(input);
    // Tabs outside strings are preserved
    expect(result).toBe('{\t"key":\t"value"\t}');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe("sanitizeJsonString — Case 4: already-correctly-escaped sequences", () => {
  it("does NOT double-escape an already-escaped \\n", () => {
    // Model correctly wrote \\n (two chars: backslash + n).
    // After sanitization it must still be \\n, not \\\\n.
    const input = '{"content": "Para one.\\nPara two."}';
    const result = sanitizeJsonString(input);
    // Must remain identical — no transformation needed
    expect(result).toBe(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).content).toBe("Para one.\nPara two.");
  });

  it("does NOT double-escape already-escaped \\t", () => {
    const input = '{"tsv": "col1\\tcol2"}';
    const result = sanitizeJsonString(input);
    expect(result).toBe(input);
    expect(JSON.parse(result).tsv).toBe("col1\tcol2");
  });

  it("does NOT double-escape already-escaped \\\" (escaped quote)", () => {
    const input = '{"q": "She said \\"hi\\""}';
    const result = sanitizeJsonString(input);
    expect(result).toBe(input);
  });

  it("leaves a string with no control chars completely unchanged", () => {
    const input = '{"title": "Normal text without any issues", "n": 42}';
    expect(sanitizeJsonString(input)).toBe(input);
  });
});

// ─── parseJsonResponse — end-to-end recovery scenarios ───────────────────────

describe("parseJsonResponse — full recovery pipeline", () => {
  it("parses a clean JSON string directly", () => {
    const r = parseJsonResponse('{"title":"T","pitch":"P","content":"C"}');
    expect(r.title).toBe("T");
  });

  it("extracts JSON wrapped in prose", () => {
    const r = parseJsonResponse('Here is my idea:\n{"title":"T","content":"C that is long enough to meet the minimum"}\nHope that helps.');
    expect(r.title).toBe("T");
  });

  it("extracts JSON from a markdown code fence", () => {
    const r = parseJsonResponse('```json\n{"title":"T","content":"C"}\n```');
    expect(r.title).toBe("T");
  });

  it("recovers from bare newlines inside string values (the GPT-OSS bug)", () => {
    const malformed = '{"title":"T","content":"Para one.\n\nPara two.\n\nPara three."}';
    const r = parseJsonResponse(malformed);
    expect(r.title).toBe("T");
    expect(r.content).toBe("Para one.\n\nPara two.\n\nPara three.");
  });

  it("recovers from JSON inside a thinking block + bare newlines", () => {
    const malformed = '<think>draft</think>\n{"title":"T","content":"A.\nB."}';
    const r = parseJsonResponse(malformed);
    expect(r.title).toBe("T");
  });

  it("throws when no JSON is present at all", () => {
    expect(() => parseJsonResponse("This is just plain text with no JSON."))
      .toThrow("No valid JSON found in response");
  });
});
