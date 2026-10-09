import { buckets, counts, SHARED_OPS, STS_RPS } from "./quota";
import { FIELDS, SCENARIOS } from "./trail";

describe("STS quota model", () => {
  it("uses the documented 600 RPS shared by six operations", () => {
    expect(STS_RPS).toBe(600);
    expect(SHARED_OPS).toHaveLength(6);
    expect(SHARED_OPS).toContain("GetCallerIdentity");
  });

  it("puts AssumeRole and GetCallerIdentity in the same regional bucket", () => {
    const b = buckets({ app: 400, health: 250 });
    const mine = b.find((x) => x.key === "you|regional|ap-northeast-1");
    expect(mine?.rps).toBe(650);
    expect(mine?.throttled).toBe(true);
  });

  it("does not count AWS service principals or unlisted operations", () => {
    expect(counts("lambda")).toBe(false);
    expect(counts("oidc")).toBe(false);
    const b = buckets({ lambda: 5000, oidc: 5000 });
    expect(b.every((x) => x.rps === 0)).toBe(true);
  });

  it("bills cross-account callers, not the role owner", () => {
    const b = buckets({ partner: 700 });
    expect(b.find((x) => x.account === "partner")?.throttled).toBe(true);
    expect(b.find((x) => x.key === "you|regional|ap-northeast-1")?.rps).toBe(0);
  });

  it("gives the global endpoint its own budget", () => {
    const b = buckets({ app: 500, global: 500 });
    expect(b.filter((x) => x.throttled)).toEqual([]);
    expect(b.find((x) => x.endpoint === "global")?.region).toBe("eu-north-1");
  });

  it("is not throttled at exactly the limit and ignores negatives", () => {
    expect(buckets({ app: 600 })[0].throttled).toBe(false);
    expect(buckets({ app: -10 })[0].rps).toBe(0);
  });
});

describe("CloudTrail scenarios", () => {
  it("each scenario has bilingual copy and at least one record", () => {
    for (const s of SCENARIOS) {
      expect(s.label.ja.length).toBeGreaterThan(0);
      expect(s.summary.en.length).toBeGreaterThan(0);
      expect(s.records.length).toBeGreaterThan(0);
    }
  });

  it("cross-account records share one sharedEventID", () => {
    const cross = SCENARIOS.find((s) => s.id === "cross")!;
    const ids = cross.records.map((r) => r.body.sharedEventID);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("the global-endpoint record lands in us-east-1 but was served elsewhere", () => {
    const g = SCENARIOS.find((s) => s.id === "global")!.records[0];
    expect(g.body.awsRegion).toBe("us-east-1");
    expect(JSON.stringify(g.body)).toContain('"awsServingRegion":"eu-north-1"');
  });

  it("the denied call is logged only on the caller side", () => {
    const d = SCENARIOS.find((s) => s.id === "denied")!;
    expect(d.records.map((r) => r.account)).toEqual(["caller"]);
  });

  it("every annotated field has both languages", () => {
    for (const [k, l] of Object.entries(FIELDS)) {
      expect(l.en.length, k).toBeGreaterThan(0);
      expect(l.ja.length, k).toBeGreaterThan(0);
    }
  });
});
