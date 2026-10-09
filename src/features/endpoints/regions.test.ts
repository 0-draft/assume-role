import { canDeactivate, filterRegions, LEGACY_GLOBAL_REGIONS, REGIONS } from "./regions";

describe("regions", () => {
  it("has 34 commercial Regions: 17 default-enabled and 17 opt-in", () => {
    expect(REGIONS).toHaveLength(34);
    expect(REGIONS.filter((r) => r.optIn)).toHaveLength(17);
    expect(new Set(REGIONS.map((r) => r.code)).size).toBe(34);
  });

  it("names every Region in both languages", () => {
    for (const r of REGIONS) {
      expect(r.name.en).not.toBe("");
      expect(r.name.ja).not.toBe("");
    }
  });

  it("only lets default-enabled Regions other than us-east-1 be deactivated", () => {
    const off = REGIONS.filter(canDeactivate).map((r) => r.code);
    expect(off).toHaveLength(16);
    expect(off).not.toContain("us-east-1");
    expect(off).not.toContain("ap-east-1");
  });

  it("keeps Seoul and Osaka off the 15-Region legacy list", () => {
    expect(LEGACY_GLOBAL_REGIONS).toHaveLength(15);
    expect(LEGACY_GLOBAL_REGIONS).not.toContain("ap-northeast-2");
    expect(LEGACY_GLOBAL_REGIONS).not.toContain("ap-northeast-3");
    const defaults = REGIONS.filter((r) => !r.optIn).map((r) => r.code);
    for (const r of LEGACY_GLOBAL_REGIONS) expect(defaults).toContain(r);
  });
});

describe("filterRegions", () => {
  it("filters by type", () => {
    expect(filterRegions("", "optin")).toHaveLength(17);
    expect(filterRegions("", "default")).toHaveLength(17);
    expect(filterRegions("", "fips")).toHaveLength(6);
  });

  it("searches code and names in both languages", () => {
    expect(filterRegions("tokyo", "all").map((r) => r.code)).toEqual(["ap-northeast-1"]);
    expect(filterRegions("東京", "all").map((r) => r.code)).toEqual(["ap-northeast-1"]);
    expect(filterRegions("  EU-  ", "all").every((r) => r.code.startsWith("eu-"))).toBe(
      true,
    );
    expect(filterRegions("zzz", "all")).toEqual([]);
  });
});
