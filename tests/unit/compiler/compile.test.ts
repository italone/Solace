import { describe, expect, it } from "vitest";

import { compile } from "../../../src/compiler";

describe("compile", () => {
  it("compiles a counter SFC", () => {
    const source = `
<template>
  <button class="counter" onClick={increment}>
    count: {count.value}
  </button>
</template>

<script>
  import { ref } from "@italone/solace";
  const count = ref(0);
  const increment = () => count.value++;
</script>

<style>
  .counter { color: blue; }
</style>
`;

    const result = compile(source, { id: "counter.sfc" });
    expect(result.code).toContain('import * as _Solace from "@italone/solace"');
    expect(result.code).toContain('import { ref } from "@italone/solace"');
    expect(result.code).toContain("const count = ref(0);");
    expect(result.code).toContain("const increment = () => count.value++;");
    expect(result.code).toContain("return () => _Solace.h");
    expect(result.code).toContain("data-s-id");
  });

  it("compiles SFC without style block", () => {
    const source = `
<template>
  <div>hello</div>
</template>
`;

    const result = compile(source);
    expect(result.code).toContain('_Solace.h("div", null, "hello")');
    expect(result.code).not.toContain("data-s-id");
  });

  it("throws when template block is missing", () => {
    expect(() => compile("<script></script>")).toThrow("Missing <template> block");
  });
});
