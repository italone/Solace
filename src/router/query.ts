export type QueryValue = string | string[];
export type Query = Record<string, QueryValue>;
export type QueryInputValue = string | number | boolean | null | undefined;
export type QueryInput = Record<string, QueryInputValue | QueryInputValue[]>;

export function parseQuery(search: string): Query {
  const query: Query = {};
  const normalized = search.startsWith("?") ? search.slice(1) : search;

  if (normalized === "") {
    return query;
  }

  for (const part of normalized.split("&")) {
    if (part === "") {
      continue;
    }

    const [rawKey, rawValue] = splitQueryPart(part);
    const key = decodeQueryComponent(rawKey);
    const value = decodeQueryComponent(rawValue);
    const existing = query[key];

    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  return query;
}

export function stringifyQuery(query: QueryInput = {}): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        pushQueryPart(parts, key, item);
      }
    } else {
      pushQueryPart(parts, key, value);
    }
  }

  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

function pushQueryPart(parts: string[], key: string, value: QueryInputValue): void {
  if (value === null || value === undefined) {
    return;
  }

  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}

function splitQueryPart(part: string): [string, string] {
  const separatorIndex = part.indexOf("=");

  if (separatorIndex === -1) {
    return [part, ""];
  }

  return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      throw new TypeError("Router query contains malformed percent encoding");
    }

    throw error;
  }
}
