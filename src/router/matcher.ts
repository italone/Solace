import type {
  RouteLocationNormalized,
  RouteParamInputValue,
  RouteParamsInput,
  RouteRecord,
  RouteRecordName,
} from "./types";

interface CompiledRoute {
  record: RouteRecord;
  chain: RouteRecord[];
  regex: RegExp;
  keys: string[];
  score: number;
  fullPath: string;
  name?: RouteRecordName;
  matchable: boolean;
}

export interface Matcher {
  resolve(path: string): Pick<RouteLocationNormalized, "path" | "params" | "matched" | "name">;
  resolveByName(
    name: RouteRecordName,
    params?: RouteParamsInput,
  ): Pick<RouteLocationNormalized, "path" | "params" | "matched" | "name">;
}

export function createMatcher(routes: RouteRecord[]): Matcher {
  const flattened = flattenRoutes(routes);
  const compiledRoutes = flattened.map(compileRoute);
  const pathRoutes = compiledRoutes
    .filter((route) => route.matchable)
    .sort((a, b) => b.score - a.score || b.chain.length - a.chain.length);
  const namedRoutes = new Map<RouteRecordName, CompiledRoute>();

  for (const route of compiledRoutes) {
    if (route.name === undefined) {
      continue;
    }

    if (namedRoutes.has(route.name)) {
      throw new TypeError(`Router route record names must be unique: ${route.name}`);
    }

    namedRoutes.set(route.name, route);
  }

  return {
    resolve(path: string) {
      const normalized = normalizePath(path);

      for (const route of pathRoutes) {
        const match = route.regex.exec(normalized);
        if (match === null) {
          continue;
        }

        const params: Record<string, string> = {};
        for (let index = 0; index < route.keys.length; index += 1) {
          params[route.keys[index]] = decodePathParam(match[index + 1] ?? "");
        }

        return {
          path: normalized,
          params,
          matched: route.chain,
          name: route.name,
        };
      }

      return { path: normalized, params: {}, matched: [], name: undefined };
    },
    resolveByName(name: RouteRecordName, params?: RouteParamsInput) {
      const route = namedRoutes.get(name);
      if (route === undefined) {
        throw new TypeError(`Router named route was not found: ${name}`);
      }

      const normalizedParams = params ?? {};
      const path = buildPathFromTemplate(route.fullPath, normalizedParams);

      return {
        path,
        params: extractPathParams(route.fullPath, normalizedParams),
        matched: route.chain,
        name: route.name,
      };
    },
  };
}

interface NormalizedRouteRecord {
  record: RouteRecord;
  fullPath: string;
  chain: RouteRecord[];
  name?: RouteRecordName;
  matchable: boolean;
}

function flattenRoutes(
  routes: RouteRecord[],
  parentPath = "",
  parentChain: RouteRecord[] = [],
): NormalizedRouteRecord[] {
  const records: NormalizedRouteRecord[] = [];

  for (const route of routes) {
    assertBetaRoutePathSyntax(route.path);
    const fullPath = joinRoutePaths(parentPath, route.path);
    const chain = [...parentChain, route];
    const children = route.children ?? [];
    const name = route.name;
    const matchable =
      route.component != null || route.redirect !== undefined || children.length === 0;

    if (matchable || name !== undefined) {
      records.push({ record: route, fullPath, chain, name, matchable });
    }

    records.push(...flattenRoutes(children, fullPath, chain));
  }

  return records;
}

function joinRoutePaths(parentPath: string, childPath: string): string {
  if (childPath.startsWith("/")) {
    return normalizePath(childPath);
  }

  const parent = normalizePath(parentPath || "/");

  if (childPath === "") {
    return parent;
  }

  if (parent === "/") {
    return normalizePath(`/${childPath}`);
  }

  return normalizePath(`${parent}/${childPath}`);
}

function compileRoute(route: NormalizedRouteRecord): CompiledRoute {
  assertBetaRoutePathSyntax(route.fullPath);
  const normalized = normalizePath(route.fullPath);

  if (normalized === "/:pathMatch(.*)*") {
    return {
      record: route.record,
      chain: route.chain,
      regex: /^\/(.*)$/,
      keys: ["pathMatch"],
      score: 0,
      fullPath: normalized,
      name: route.name,
      matchable: route.matchable,
    };
  }

  const keys: string[] = [];
  const segments = normalized.split("/").filter(Boolean);
  let score = normalized === "/" ? 100 : 0;
  const pattern = segments
    .map((segment) => {
      if (segment.startsWith(":")) {
        const key = segment.slice(1);
        assertBetaParamSyntax(key);
        keys.push(key);
        score += 1;
        return "([^/]+)";
      }

      score += 10;
      return escapeRegExp(segment);
    })
    .join("/");

  return {
    record: route.record,
    chain: route.chain,
    regex: new RegExp(`^/${pattern}$`),
    keys,
    score,
    fullPath: normalized,
    name: route.name,
    matchable: route.matchable,
  };
}

function assertBetaRoutePathSyntax(path: string): void {
  if (path === "/:pathMatch(.*)*") {
    return;
  }

  const segments = path.split("/").filter(Boolean);
  for (const segment of segments) {
    if (segment.startsWith(":")) {
      assertBetaParamSyntax(segment.slice(1));
    }
  }

  if (path.includes("?") || path.includes("#")) {
    throw new TypeError("Router route record path must not include query or hash");
  }

  if (path.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) {
    throw new TypeError("Router route record path must be a relative path");
  }
}

export function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const trimmed =
    withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;

  return trimmed === "" ? "/" : trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertBetaParamSyntax(key: string): void {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return;
  }

  throw new TypeError(`Deferred router path syntax is not part of the beta contract: :${key}`);
}

function decodePathParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      throw new TypeError("Router path contains malformed percent encoding");
    }

    throw error;
  }
}

function buildPathFromTemplate(fullPath: string, params: RouteParamsInput): string {
  const segments = normalizePath(fullPath).split("/").filter(Boolean);
  const keys = new Set<string>();
  const parts = segments.map((segment) => {
    if (!segment.startsWith(":")) {
      return segment;
    }

    const key = segment.slice(1);
    keys.add(key);
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new TypeError(`Router named route is missing required param: ${key}`);
    }

    const value = params[key];

    return encodeURIComponent(serializePathParam(value));
  });

  for (const key of Object.keys(params)) {
    if (!keys.has(key)) {
      throw new TypeError(`Router named route received unknown param: ${key}`);
    }
  }

  return `/${parts.join("/")}` || "/";
}

function extractPathParams(fullPath: string, params: RouteParamsInput): Record<string, string> {
  const extracted: Record<string, string> = {};
  const segments = normalizePath(fullPath).split("/").filter(Boolean);

  for (const segment of segments) {
    if (!segment.startsWith(":")) {
      continue;
    }

    const key = segment.slice(1);
    extracted[key] = String(params[key]);
  }

  return extracted;
}

function serializePathParam(value: RouteParamInputValue): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  throw new TypeError("Router named route params must be strings or numbers");
}
