import { describe, expect, it } from "vitest";

import {
  createRouterSnapshot,
  parseRouterSnapshot,
  RouterHydrationError,
  serializeRouterSnapshot,
  verifyRouterSnapshot,
} from "../../../src";
import type { RouteLocationNormalized, RouteRecord, RouterSnapshot } from "../../../src";

const route = {} as RouteLocationNormalized;
const record = {} as RouteRecord;
const identify = (value: RouteRecord): string => value.name ?? value.path;
const createSnapshot: typeof createRouterSnapshot = createRouterSnapshot;
const parseSnapshot: (serialized: string) => RouterSnapshot = parseRouterSnapshot;
const serializeSnapshot: (snapshot: RouterSnapshot) => string = serializeRouterSnapshot;
const verifySnapshot: typeof verifyRouterSnapshot = verifyRouterSnapshot;
void route;
void record;
void identify;
void createSnapshot;
void parseSnapshot;
void serializeSnapshot;
void verifySnapshot;
const errorConstructor: typeof RouterHydrationError = RouterHydrationError;
void errorConstructor;

describe("router snapshot public contract types", () => {
  it("keeps the snapshot API typed", () => {
    expect(true).toBe(true);
  });
});
