import { describe, expect, it } from "vitest";

import {
  createRouterSnapshot,
  parseRouterSnapshot,
  RouterHydrationError,
  serializeRouterSnapshot,
  verifyRouterSnapshot,
} from "../../../src/router/snapshot";
import { h } from "../../../src";
import type { RouteLocationNormalized, RouteRecord } from "../../../src/router/types";

const rootRecord: RouteRecord = {
  path: "/",
  name: "root",
  component: () => h("span", null, "root"),
};
const detailRecord: RouteRecord = {
  path: "detail",
  name: "detail",
  component: () => h("span", null, "detail"),
};

function createRoute(): RouteLocationNormalized {
  return {
    path: "/users/7",
    fullPath: "/users/7?z=last&a=first&filter=closed&filter=open",
    query: {
      z: "last",
      a: "first",
      filter: ["closed", "open"],
    },
    params: { id: "7" },
    matched: [rootRecord, detailRecord],
    redirectedFrom: {
      path: "/legacy",
      fullPath: "/legacy?z=2&a=1",
      query: { z: "2", a: "1" },
      params: {},
      matched: [rootRecord],
    },
  };
}

function identifyRecord(record: RouteRecord): string {
  return record.name ?? record.path;
}

describe("router snapshot", () => {
  it("creates a deterministic canonical route snapshot", () => {
    const snapshot = createRouterSnapshot(createRoute(), identifyRecord);

    expect(snapshot).toEqual({
      version: 1,
      fullPath: "/users/7?a=first&filter=closed&filter=open&z=last",
      path: "/users/7",
      params: [["id", "7"]],
      query: [
        ["a", "first"],
        ["filter", ["closed", "open"]],
        ["z", "last"],
      ],
      matched: ["root", "detail"],
      redirectedFrom: "/legacy?a=1&z=2",
    });
  });

  it("rejects unstable or duplicate matched record identities", () => {
    expect(() => createRouterSnapshot(createRoute(), () => "")).toThrow(TypeError);
    expect(() => createRouterSnapshot(createRoute(), () => "same")).toThrow(TypeError);
    expect(() => createRouterSnapshot(createRoute(), () => 42 as never)).toThrow(TypeError);
  });

  it("escapes script-sensitive snapshot values during serialization", () => {
    const snapshot = createRouterSnapshot(
      {
        ...createRoute(),
        matched: [{ ...rootRecord, name: "<script>&\u2028\u2029" }],
      },
      identifyRecord,
    );

    const serialized = serializeRouterSnapshot(snapshot);

    expect(serialized).toContain("\\u003Cscript\\u003E\\u0026\\u2028\\u2029");
    expect(serialized).not.toContain("<script>");
  });

  it("parses a validated snapshot into copied transport values", () => {
    const source = createRouterSnapshot(createRoute(), identifyRecord);
    const parsed = parseRouterSnapshot(serializeRouterSnapshot(source));

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.params).not.toBe(source.params);
    expect(parsed.query).not.toBe(source.query);
  });

  it("rejects malformed, unsupported, unknown, duplicate, and prototype-bearing payloads", () => {
    const invalidPayloads = [
      "{",
      JSON.stringify({ version: 2 }),
      JSON.stringify({ version: 1, unknown: true }),
      JSON.stringify({ version: 1, fullPath: "/", path: "/" }),
      JSON.stringify({
        version: 1,
        fullPath: "/",
        path: "/",
        params: [
          ["id", "1"],
          ["id", "2"],
        ],
        query: [],
        matched: [],
      }),
      JSON.stringify({
        version: 1,
        fullPath: "/",
        path: "relative",
        params: [],
        query: [],
        matched: [],
      }),
      '{"version":1,"fullPath":"/","path":"/","params":[],"query":[],"matched":[],"__proto__":{"polluted":true}}',
    ];

    for (const payload of invalidPayloads) {
      expect(() => parseRouterSnapshot(payload)).toThrow(TypeError);
    }
  });

  it("reports the first mismatching snapshot field without live route data", () => {
    const server = createRouterSnapshot(createRoute(), identifyRecord);
    const client = { ...server, matched: ["root", "other"] };

    expect(() => verifyRouterSnapshot(server, client)).toThrowError(
      expect.objectContaining({
        name: "RouterHydrationError",
        field: "matched",
        serverSnapshot: server,
        clientSnapshot: client,
      }),
    );
    try {
      verifyRouterSnapshot(server, client);
    } catch (error) {
      expect(error).toBeInstanceOf(RouterHydrationError);
      expect(String(error)).not.toContain("component");
      expect(String(error)).not.toContain("meta");
    }
  });
});
