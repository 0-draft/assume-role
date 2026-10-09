import { NAV } from "@/data/nav";
import { TERMS, searchTerms } from "./terms";

describe("glossary", () => {
  it("has about forty unique terms", () => {
    expect(TERMS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(TERMS.map((t) => t.term)).size).toBe(TERMS.length);
  });

  it("every term has both languages and links to a real chapter", () => {
    const ids = new Set(NAV.map((n) => n.id));
    for (const t of TERMS) {
      expect(t.def.en.length, t.term).toBeGreaterThan(0);
      expect(t.def.ja.length, t.term).toBeGreaterThan(0);
      expect(ids.has(t.chapter), t.term).toBe(true);
    }
  });

  it("searches term, aliases and both languages", () => {
    expect(searchTerms("").length).toBe(TERMS.length);
    expect(searchTerms("irsa").map((t) => t.term)).toContain("IRSA");
    expect(searchTerms("ロールチェーン").map((t) => t.term)).toContain("Role chaining");
    expect(searchTerms("v2token").map((t) => t.term)).toContain("v1 / v2 session token");
    expect(searchTerms("zzzz")).toEqual([]);
  });
});
