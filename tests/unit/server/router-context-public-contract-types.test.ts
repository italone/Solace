import { describe, expect, it } from "vitest";

import {
  createRouterServerContext,
  createRouterSnapshot,
  parseRouterSnapshot,
  serializeRouterSnapshot,
  verifyRouterSnapshot,
} from "../../../src/server";
import type {
  RouteRecordIdentity,
  RouterServerContext,
  RouterServerContextOptions,
  RouterSnapshot,
} from "../../../src/server";
import type { RouteLocationNormalized, RouteRecord } from "../../../src";

const identifyRecord: RouteRecordIdentity = (record) => record.name ?? record.path;
const options: RouterServerContextOptions = {
  url: "/",
  routes: [] as RouteRecord[],
  identifyRecord,
  provides: new Map<string | symbol, unknown>(),
};
const createContext: typeof createRouterServerContext = createRouterServerContext;
const createSnapshot: typeof createRouterSnapshot = createRouterSnapshot;
const parseSnapshot: typeof parseRouterSnapshot = parseRouterSnapshot;
const serializeSnapshot: typeof serializeRouterSnapshot = serializeRouterSnapshot;
const verifySnapshot: typeof verifyRouterSnapshot = verifyRouterSnapshot;
const contextPromise = null as unknown as Promise<RouterServerContext>;
const route = null as unknown as RouteLocationNormalized;
const snapshot = null as unknown as RouterSnapshot;
const serialized = null as unknown as string;
const parsed = null as unknown as RouterSnapshot;
void options;
void createContext;
void createSnapshot;
void parseSnapshot;
void serializeSnapshot;
void verifySnapshot;
void contextPromise;
void route;
void snapshot;
void serialized;
void parsed;

describe("router server context public contract types", () => {
  it("keeps the server adapter and snapshot re-exports typed", () => {
    expect(true).toBe(true);
  });
});
