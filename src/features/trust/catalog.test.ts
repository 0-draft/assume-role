import { EXAMPLES } from "./policies";
import { CATALOG, filterCatalog } from "./catalog";
import { DEPUTY_LANES, DEPUTY_STEPS } from "./deputy";

describe("condition key catalog", () => {
  it("has unique keys with copy in both languages", () => {
    expect(new Set(CATALOG.map((k) => k.key)).size).toBe(CATALOG.length);
    for (const k of CATALOG) {
      for (const l of [k.when, k.meaning]) {
        expect(l.en.trim(), k.key).not.toBe("");
        expect(l.ja.trim(), k.key).not.toBe("");
      }
    }
  });

  it("covers every sts: key from the Service Authorization Reference", () => {
    const keys = CATALOG.map((k) => k.key);
    for (const k of [
      "sts:ExternalId",
      "sts:RoleSessionName",
      "sts:SourceIdentity",
      "sts:TransitiveTagKeys",
      "sts:RequestContext/${ContextKey}",
      "sts:RequestContextProviders",
      "sts:RoleAuthorizedByIdp",
      "sts:TaskPolicyArn",
      "sts:AWSServiceName",
      "sts:DurationSeconds",
      "sts:IdentityTokenAudience",
      "sts:SigningAlgorithm",
    ])
      expect(keys).toContain(k);
  });

  it("filters by family and by text in either language", () => {
    expect(filterCatalog("", "sts").every((k) => k.family === "sts")).toBe(true);
    expect(filterCatalog("externalid", "all").map((k) => k.key)).toContain(
      "sts:ExternalId",
    );
    expect(filterCatalog("外部 ID", "all").map((k) => k.key)).toContain("sts:ExternalId");
    expect(filterCatalog("zzzz-nothing", "all")).toEqual([]);
  });
});

describe("example trust policies", () => {
  it("are valid JSON with copy in both languages", () => {
    for (const e of EXAMPLES) {
      const doc = JSON.parse(e.json) as { Version: string; Statement: unknown[] };
      expect(doc.Version).toBe("2012-10-17");
      expect(doc.Statement.length).toBeGreaterThan(0);
      expect(e.label.ja && e.note.ja && e.label.en && e.note.en).toBeTruthy();
    }
  });
});

describe("confused deputy sequence", () => {
  it("only references declared lanes", () => {
    const ids = new Set(DEPUTY_LANES.map((l) => l.id));
    for (const s of DEPUTY_STEPS) {
      expect(ids.has(s.from)).toBe(true);
      expect(ids.has(s.to)).toBe(true);
    }
  });
});
