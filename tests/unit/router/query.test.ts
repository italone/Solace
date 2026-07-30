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

  it("parses bare keys and keeps plus signs literal", () => {
    expect(parseQuery("?flag&plus=a+b")).toEqual({ flag: "", plus: "a+b" });
  });

  it("preserves equals signs after the first query separator", () => {
    expect(parseQuery("?q=a=b")).toEqual({ q: "a=b" });
  });

  it("preserves equals signs for repeated query keys", () => {
    expect(parseQuery("?q=a=b&q=c=d")).toEqual({ q: ["a=b", "c=d"] });
  });

  it("parses empty query keys explicitly", () => {
    expect(parseQuery("?=value")).toEqual({ "": "value" });
  });

  it("decodes encoded equals signs inside values", () => {
    expect(parseQuery("?redirect=%2Fusers%2F1%3Ftab%3Da")).toEqual({
      redirect: "/users/1?tab=a",
    });
  });

  it("throws a stable TypeError for malformed percent encoding", () => {
    expect(() => parseQuery("?broken=%E0%A4%A")).toThrow(TypeError);
    expect(() => parseQuery("?broken=%E0%A4%A")).toThrow(
      /Router query contains malformed percent encoding/,
    );
  });

  it("stringifies encoded keys and skips nullish array entries", () => {
    expect(
      stringifyQuery({
        "redirect to": "/users/1",
        tag: ["a", null, "b", undefined],
      }),
    ).toBe("?redirect%20to=%2Fusers%2F1&tag=a&tag=b");
  });
});
