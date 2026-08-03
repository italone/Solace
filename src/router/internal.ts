import type { RouteLocationRaw } from "./types";

export const historyHrefFormatterKey = Symbol("Solace.router.historyHrefFormatter");
export const routerHrefFormatterKey = Symbol("Solace.router.hrefFormatter");

export interface HistoryHrefFormatter {
  [historyHrefFormatterKey](path: string): string;
}

export interface RouterHrefFormatter {
  [routerHrefFormatterKey](to: RouteLocationRaw): string;
}

export function hasHistoryHrefFormatter(history: unknown): history is HistoryHrefFormatter {
  return (
    typeof history === "object" &&
    history !== null &&
    typeof (history as Partial<HistoryHrefFormatter>)[historyHrefFormatterKey] === "function"
  );
}
