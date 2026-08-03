import type { RouteLocationNormalized, RouteRecord } from "./types";

interface CompiledRoute {
  record: RouteRecord;
  chain: RouteRecord[];
  regex: RegExp;
  keys: string[];
  score: number;
}

export interface Matcher {
  resolve(path: string): Pick<RouteLocationNormalized, "path" | "params" | "matched">;
}

export function createMatcher(routes: RouteRecord[]): Matcher {
  const compiled = flattenRoutes(routes)
    .map(compileRoute)
    .sort((a, b) => b.score - a.score || b.chain.length - a.chain.length);

  return {
    resolve(path: string) {
      const normalized = normalizePath(path);

      for (const route of compiled) {
        const match = route.regex.exec(normalized);
        if (match === null) {
          continue;
        }

        const params: Record<string, string> = {};
        for (let index = 0; index < route.keys.length; index += 1) {
          params[route.keys[index]] = decodePathParam(match[index + 1] ?? "");
        }

        return { path: normalized, params, matched: route.chain };
      }

      return { path: normalized, params: {}, matched: [] };
    },
  };
}

interface NormalizedRouteRecord {
  record: RouteRecord;
  fullPath: string;
  chain: RouteRecord[];
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

    if (route.component !== undefined || route.redirect !== undefined || children.length === 0) {
      records.push({ record: route, fullPath, chain });
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
