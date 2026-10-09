import { isOnlyWildcards, stringLike } from "./glob";

describe("stringLike (IAM StringLike semantics)", () => {
  it.each([
    ["repo:org/repo:*", "repo:org/repo:ref:refs/heads/main", true],
    ["repo:org/*", "repo:org/repo:pull_request", true],
    ["repo:org/*", "repo:org-evil/repo:pull_request", false],
    ["repo:org*", "repo:org-evil/repo:pull_request", true],
    ["*", "", true],
    ["*", "anything", true],
    ["", "", true],
    ["", "x", false],
    ["a?c", "abc", true],
    ["a?c", "ac", false],
    ["a?c", "abbc", false],
    ["a*c", "ac", true],
    ["a*c", "abbbc", true],
    ["a*c", "abbbd", false],
    ["*main", "refs/heads/main", true],
    ["*main", "refs/heads/main2", false],
    ["a*b*c", "axxbyyc", true],
    ["a*b*c", "axxcyyb", false],
    ["**", "x", true],
    ["?*", "", false],
  ])("%s ~ %s = %s", (p, v, want) => {
    expect(stringLike(p, v)).toBe(want);
  });

  it("is case-sensitive", () => {
    expect(stringLike("repo:Org/*", "repo:org/x")).toBe(false);
  });

  it("matches the whole value, not a substring", () => {
    expect(stringLike("org/repo", "repo:org/repo:ref")).toBe(false);
  });

  it("treats regex metacharacters literally", () => {
    expect(stringLike("a.b", "axb")).toBe(false);
    expect(stringLike("a.b", "a.b")).toBe(true);
    expect(stringLike("(x)+", "(x)+")).toBe(true);
  });

  it("stays fast on pathological patterns", () => {
    const t0 = performance.now();
    expect(stringLike("*a*a*a*a*a*a*b", "a".repeat(2000))).toBe(false);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it("flags wildcard-only values", () => {
    expect(isOnlyWildcards("*")).toBe(true);
    expect(isOnlyWildcards("?*")).toBe(true);
    expect(isOnlyWildcards("")).toBe(true);
    expect(isOnlyWildcards("repo:*")).toBe(false);
  });
});
