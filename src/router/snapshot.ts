import { parseQuery, stringifyQuery, type Query } from "./query";
import type { RouteLocationNormalized, RouteRecord } from "./types";

export interface RouterSnapshot {
  readonly version: 1;
  readonly fullPath: string;
  readonly path: string;
  readonly params: readonly (readonly [string, string])[];
  readonly query: readonly (readonly [string, string | readonly string[]])[];
  readonly matched: readonly string[];
  readonly redirectedFrom?: string;
}

export type RouteRecordIdentity = (
  record: RouteRecord,
  index: number,
  route: RouteLocationNormalized,
) => string;

export type RouterHydrationErrorField =
  "version" | "fullPath" | "path" | "params" | "query" | "matched" | "redirectedFrom";

export class RouterHydrationError extends Error {
  constructor(
    readonly field: RouterHydrationErrorField,
    readonly serverSnapshot: RouterSnapshot,
    readonly clientSnapshot: RouterSnapshot,
  ) {
    super(`Router hydration snapshot mismatch: ${field}`);
    this.name = "RouterHydrationError";
  }
}

export function createRouterSnapshot(
  route: RouteLocationNormalized,
  identifyRecord: RouteRecordIdentity,
): RouterSnapshot {
  if (route === null || typeof route !== "object" || Array.isArray(route)) {
    throw new TypeError("Router snapshot route must be an object");
  }
  if (typeof identifyRecord !== "function") {
    throw new TypeError("Router snapshot record identity must be a function");
  }

  const params = createParams(route.params);
  const query = createQuery(route.query);
  const matched: string[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(route.matched)) {
    throw new TypeError("Router snapshot matched records must be an array");
  }

  route.matched.forEach((record, index) => {
    const identity = identifyRecord(record, index, route);
    assertRecordIdentity(identity);
    if (seen.has(identity)) {
      throw new TypeError(`Router snapshot matched record identity must be unique: ${identity}`);
    }
    seen.add(identity);
    matched.push(identity);
  });

  const snapshot = {
    version: 1 as const,
    path: assertSnapshotPath(route.path, "Router snapshot route path"),
    params,
    query,
    matched,
    fullPath: "",
  };
  snapshot.fullPath = buildFullPath(snapshot.path, query);

  if (route.redirectedFrom !== undefined) {
    return {
      ...snapshot,
      redirectedFrom: canonicalizeLocationPath(route.redirectedFrom),
    };
  }

  return snapshot;
}

export function serializeRouterSnapshot(snapshot: RouterSnapshot): string {
  assertSnapshot(snapshot);
  return JSON.stringify(snapshot)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function parseRouterSnapshot(serialized: string): RouterSnapshot {
  if (typeof serialized !== "string") {
    throw new TypeError("Router snapshot payload must be a string");
  }

  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new TypeError("Router snapshot payload must be valid JSON");
  }

  assertSnapshot(value);
  return cloneSnapshot(value);
}

export function verifyRouterSnapshot(server: RouterSnapshot, client: RouterSnapshot): void {
  if (server?.version !== client?.version) {
    throw new RouterHydrationError("version", server, client);
  }

  assertSnapshot(server);
  assertSnapshot(client);

  const fields: readonly RouterHydrationErrorField[] = [
    "fullPath",
    "path",
    "params",
    "query",
    "matched",
    "redirectedFrom",
  ];
  for (const field of fields) {
    if (!sameValue(server[field], client[field])) {
      throw new RouterHydrationError(field, server, client);
    }
  }
}

function createParams(params: RouteLocationNormalized["params"]): [string, string][] {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    throw new TypeError("Router snapshot route params must be an object");
  }

  return Object.entries(params)
    .map(([key, value]) => {
      if (typeof value !== "string") {
        throw new TypeError("Router snapshot route params must contain strings");
      }
      return [key, value] as [string, string];
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

function createQuery(query: Query): [string, string | string[]][] {
  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    throw new TypeError("Router snapshot route query must be an object");
  }

  return Object.entries(query)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value] as [string, string];
      }
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        return [key, [...value]] as [string, string[]];
      }
      throw new TypeError("Router snapshot route query must contain strings");
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

function buildFullPath(
  path: string,
  query: readonly (readonly [string, string | readonly string[]])[],
): string {
  const queryRecord: Record<string, string | string[]> = {};
  for (const [key, value] of query) {
    queryRecord[key] = typeof value === "string" ? value : [...value];
  }
  return `${path}${stringifyQuery(queryRecord)}`;
}

function canonicalizeLocationPath(route: RouteLocationNormalized): string {
  const path = assertSnapshotPath(route.path, "Router snapshot redirected path");
  return buildFullPath(path, createQuery(route.query));
}

function assertSnapshot(value: unknown): asserts value is RouterSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Router snapshot must be an object");
  }

  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  const allowed = new Set([
    "version",
    "fullPath",
    "path",
    "params",
    "query",
    "matched",
    "redirectedFrom",
  ]);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    throw new TypeError("Router snapshot contains an unknown field");
  }
  if (record.version !== 1) {
    throw new TypeError("Unsupported router snapshot version");
  }
  if (
    typeof record.path !== "string" ||
    assertSnapshotPath(record.path, "Router snapshot path") !== record.path
  ) {
    throw new TypeError("Router snapshot path must be normalized");
  }
  if (typeof record.fullPath !== "string") {
    throw new TypeError("Router snapshot fullPath must be a string");
  }
  if (
    !Array.isArray(record.params) ||
    !Array.isArray(record.query) ||
    !Array.isArray(record.matched)
  ) {
    throw new TypeError("Router snapshot tuple fields must be arrays");
  }

  assertTupleEntries(record.params, "params", false);
  assertTupleEntries(record.query, "query", true);
  assertMatchedEntries(record.matched);
  if (record.redirectedFrom !== undefined) {
    assertCanonicalFullPath(record.redirectedFrom, "Router snapshot redirectedFrom");
  }

  const expected = buildFullPath(
    record.path,
    record.query as readonly (readonly [string, string | readonly string[]])[],
  );
  if (record.fullPath !== expected) {
    throw new TypeError("Router snapshot fullPath is not canonical");
  }
}

function assertTupleEntries(value: unknown[], field: string, query: boolean): void {
  let previousKey: string | undefined;
  const seen = new Set<string>();
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") {
      throw new TypeError(`Router snapshot ${field} entries must be tuples`);
    }
    const [key, item] = entry;
    if (seen.has(key) || (previousKey !== undefined && previousKey.localeCompare(key) > 0)) {
      throw new TypeError(`Router snapshot ${field} entries must be sorted and unique`);
    }
    seen.add(key);
    previousKey = key;
    if (query) {
      if (
        typeof item !== "string" &&
        (!Array.isArray(item) ||
          item.length === 0 ||
          !item.every((value) => typeof value === "string"))
      ) {
        throw new TypeError("Router snapshot query values must be strings or string arrays");
      }
    } else if (typeof item !== "string") {
      throw new TypeError("Router snapshot params must contain strings");
    }
  }
}

function assertMatchedEntries(value: unknown[]): void {
  const seen = new Set<string>();
  for (const identity of value) {
    assertRecordIdentity(identity);
    if (seen.has(identity)) {
      throw new TypeError(`Router snapshot matched record identity must be unique: ${identity}`);
    }
    seen.add(identity);
  }
}

function assertRecordIdentity(identity: unknown): asserts identity is string {
  if (typeof identity !== "string" || identity.length === 0) {
    throw new TypeError("Router snapshot matched record identity must be a non-empty string");
  }
}

function assertSnapshotPath(path: string, label: string): string {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.includes("#") ||
    path.includes("?") ||
    (path.length > 1 && path.endsWith("/"))
  ) {
    throw new TypeError(`${label} must be normalized`);
  }
  return path;
}

function assertCanonicalFullPath(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string`);
  }
  const queryStart = value.indexOf("?");
  const path = queryStart === -1 ? value : value.slice(0, queryStart);
  const search = queryStart === -1 ? "" : value.slice(queryStart + 1);
  const query = createQuery(parseQuery(search));
  if (value !== buildFullPath(assertSnapshotPath(path, label), query)) {
    throw new TypeError(`${label} must be canonical`);
  }
}

function cloneSnapshot(snapshot: RouterSnapshot): RouterSnapshot {
  return {
    version: 1,
    fullPath: snapshot.fullPath,
    path: snapshot.path,
    params: snapshot.params.map(([key, value]) => [key, value]),
    query: snapshot.query.map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
    matched: [...snapshot.matched],
    ...(snapshot.redirectedFrom === undefined ? {} : { redirectedFrom: snapshot.redirectedFrom }),
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
