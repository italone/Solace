import type { RouteLocationNormalized, RouteRecord } from "./types";

interface CompiledRoute {
  record: RouteRecord;
  regex: RegExp;
  keys: string[];
  score: number;
}

export interface Matcher {
  resolve(path: string): Pick<RouteLocationNormalized, "path" | "params" | "matched">;
}

export function createMatcher(routes: RouteRecord[]): Matcher {
  const compiled = routes.map(compileRoute).sort((a, b) => b.score - a.score);

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
          params[route.keys[index]] = decodeURIComponent(match[index + 1] ?? "");
        }

        return { path: normalized, params, matched: route.record };
      }

      return { path: normalized, params: {}, matched: null };
    },
  };
}

function compileRoute(record: RouteRecord): CompiledRoute {
  const normalized = normalizePath(record.path);

  if (normalized === "/:pathMatch(.*)*") {
    return {
      record,
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
        keys.push(segment.slice(1));
        score += 1;
        return "([^/]+)";
      }

      score += 10;
      return escapeRegExp(segment);
    })
    .join("/");

  return {
    record,
    regex: new RegExp(`^/${pattern}$`),
    keys,
    score,
  };
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
