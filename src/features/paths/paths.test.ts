import { CALLER_LABEL, GROUPS, PATHS, SIGNED_LABEL } from "./paths";

const STS_OPS = [
  "AssumeRole",
  "AssumeRoleWithSAML",
  "AssumeRoleWithWebIdentity",
  "AssumeRoot",
  "GetSessionToken",
  "GetFederationToken",
  "GetWebIdentityToken",
];

describe("credential paths data", () => {
  it("has unique ids and covers every group", () => {
    const ids = PATHS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GROUPS) expect(PATHS.some((p) => p.group === g.id)).toBe(true);
  });

  it.each(PATHS.map((p) => [p.id, p] as const))("%s: lanes and steps line up", (_, p) => {
    const laneIds = p.lanes.map((l) => l.id);
    expect(new Set(laneIds).size).toBe(laneIds.length);
    expect(p.steps.length).toBeGreaterThanOrEqual(3);
    for (const s of p.steps) {
      expect(laneIds, `${s.from} in ${p.id}`).toContain(s.from);
      expect(laneIds, `${s.to} in ${p.id}`).toContain(s.to);
    }
    // Every path involves STS somewhere, or says plainly it is hidden.
    const touchesSts = p.lanes.some((l) => l.actor === "sts");
    expect(touchesSts || /Internal/.test(p.stsApi)).toBe(true);
  });

  it.each(PATHS.map((p) => [p.id, p] as const))(
    "%s: copy exists in en and ja",
    (_, p) => {
      const ls = [
        p.name,
        p.blurb,
        p.duration,
        p.delivery,
        p.refresh,
        ...p.lanes.map((l) => l.label),
      ];
      for (const s of p.steps) ls.push(s.label, s.detail);
      for (const l of ls) {
        expect(l.en.trim()).not.toBe("");
        expect(l.ja.trim()).not.toBe("");
      }
    },
  );

  it("names a real STS operation (or an honest 'internal') for every path", () => {
    for (const p of PATHS) {
      expect(p.stsApi.trim()).not.toBe("");
      const named = STS_OPS.some((op) => p.stsApi.includes(op));
      expect(named || /Internal/.test(p.stsApi), p.id).toBe(true);
    }
  });

  it("marks web identity and SAML as unsigned, as STS does", () => {
    for (const p of PATHS) {
      if (p.stsCaller === "you" && /WithWebIdentity|WithSAML/.test(p.stsApi))
        expect(p.signed, p.id).toBe("unsigned");
    }
  });

  it("keeps fake secrets fake", () => {
    const blob = JSON.stringify(PATHS);
    expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(blob).not.toContain("K7MDENG/bPxRfiCY");
    expect(blob).toContain("EXAMPLE");
  });

  it("has labels for every caller and signing kind", () => {
    for (const p of PATHS) {
      expect(CALLER_LABEL[p.stsCaller]).toBeDefined();
      expect(SIGNED_LABEL[p.signed]).toBeDefined();
    }
  });
});
