export function scopeStyle(css: string, scopeId: string): string {
  const prefix = `[data-s-id="${scopeId}"]`;
  return css
    .split("}")
    .map((rule) => {
      const trimmed = rule.trim();
      if (trimmed.length === 0) {
        return "";
      }

      const openIndex = trimmed.indexOf("{");
      if (openIndex === -1) {
        return trimmed;
      }

      const selector = trimmed.slice(0, openIndex).trim();
      const body = trimmed.slice(openIndex + 1).trim();
      const scopedSelector = selector
        .split(",")
        .map((part) => `${prefix} ${part.trim()}`)
        .join(", ");
      return `${scopedSelector} { ${body} }`;
    })
    .filter(Boolean)
    .join("\n");
}
