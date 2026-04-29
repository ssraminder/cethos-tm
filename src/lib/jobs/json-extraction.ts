/**
 * JSON round-trip extraction + export.
 *
 * Walks a JSON tree, collects every string-valued leaf as a segment.
 * Each segment carries its path (array of keys / array indices) so the
 * export can splice the translation back into the right spot.
 *
 * Numbers, booleans, null, empty strings, and arrays/objects themselves
 * stay untouched. ICU-style placeholders inside strings ("Hello, {name}")
 * are preserved as literal text — the translator translates around them.
 *
 * Common case: i18n string files (en.json -> fr.json).
 */

export type JsonPath = Array<string | number>;

export interface JsonStringSegment {
  plain_text: string;
  /** Path to this string in the original JSON. */
  location: { kind: "json"; path: JsonPath };
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function isPlainObject(v: unknown): v is { [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(value: JsonValue, path: JsonPath, out: JsonStringSegment[]): void {
  if (typeof value === "string") {
    if (value.length === 0) return; // skip empty strings
    out.push({ plain_text: value, location: { kind: "json", path: [...path] } });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, [...path, i], out));
    return;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) walk(v, [...path, k], out);
  }
  // numbers, booleans, null — skip
}

export function extractJsonBuffer(buffer: Buffer): JsonStringSegment[] {
  const data = JSON.parse(buffer.toString("utf8")) as JsonValue;
  const out: JsonStringSegment[] = [];
  walk(data, [], out);
  return out;
}

/**
 * Mutate a JSON tree along a path: assign `value` at the specified location.
 * Returns the original tree.
 */
function setAtPath(root: JsonValue, path: JsonPath, value: string): void {
  let node: JsonValue = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (Array.isArray(node) && typeof key === "number") {
      node = node[key];
    } else if (isPlainObject(node) && typeof key === "string") {
      node = node[key];
    } else {
      return; // path doesn't exist anymore — silently bail
    }
  }
  const last = path[path.length - 1];
  if (Array.isArray(node) && typeof last === "number") {
    node[last] = value;
  } else if (isPlainObject(node) && typeof last === "string") {
    node[last] = value;
  }
}

export function exportJsonBuffer(
  sourceBuffer: Buffer,
  translatedSegments: Array<{
    target_text: string;
    source_text: string;
    location: { kind: "json"; path: JsonPath };
  }>,
): Buffer {
  const data = JSON.parse(sourceBuffer.toString("utf8")) as JsonValue;
  for (const seg of translatedSegments) {
    const text = seg.target_text.trim().length > 0 ? seg.target_text : seg.source_text;
    setAtPath(data, seg.location.path, text);
  }
  // Pretty-print with 2-space indent — matches typical i18n file conventions.
  return Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8");
}
