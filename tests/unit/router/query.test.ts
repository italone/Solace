import { describe, expect, it } from "vitest";

import { parseQuery, stringifyQuery } from "../../../src/router/query";

describe("router query helpers", () => {
  it("parses empty and single-value queries", () => {
    expect(parseQuery("")).toEqual({});
    expect(parseQuery("?tab=profile")).toEqual({ tab: "profile" });
  });

  it("parses repeated keys and empty values", () => {
    expect(parseQuery("?tag=a&tag=b&empty=")).toEqual({ tag: ["a", "b"], empty: "" });
  });

  it("decodes keys and values", () => {
    expect(parseQuery("?redirect=%2Fusers%2F1&space=a%20b")).toEqual({
      redirect: "/users/1",
      space: "a b",
    });
  });

  it("stringifies primitive values and skips nullish values", () => {
    expect(
      stringifyQuery({
        tab: "profile",
        page: 2,
        active: true,
        empty: "",
        skip: null,
        omit: undefined,
      }),
    ).toBe("?tab=profile&page=2&active=true&empty=");
  });

  it("stringifies repeated array keys", () => {
    expect(stringifyQuery({ tag: ["a", "b"] })).toBe("?tag=a&tag=b");
  });
});
