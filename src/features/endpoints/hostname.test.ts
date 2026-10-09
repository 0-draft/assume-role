import { buildHostname, FAMILIES } from "./hostname";
import { PARTITIONS, REGIONS } from "./regions";

const host = (...a: Parameters<typeof buildHostname>) => {
  const r = buildHostname(...a);
  return r.kind === "ok" ? r.host : r.kind;
};

describe("buildHostname", () => {
  it("builds the commercial families", () => {
    expect(host("aws", "eu-west-1", "global")).toBe("sts.amazonaws.com");
    expect(host("aws", "eu-west-1", "regional")).toBe("sts.eu-west-1.amazonaws.com");
    expect(host("aws", "eu-west-1", "dualstack")).toBe("sts.eu-west-1.api.aws");
    expect(host("aws", "us-west-2", "fips")).toBe("sts-fips.us-west-2.amazonaws.com");
    expect(host("aws", "ca-west-1", "fips-dualstack")).toBe("sts-fips.ca-west-1.api.aws");
    expect(host("aws", "ap-northeast-1", "vpce")).toBe(
      "sts.ap-northeast-1.amazonaws.com",
    );
  });

  it("has FIPS in exactly the six US and Canada Regions", () => {
    const fips = REGIONS.filter(
      (r) => buildHostname("aws", r.code, "fips").kind === "ok",
    );
    expect(fips.map((r) => r.code).sort()).toEqual(
      [
        "ca-central-1",
        "ca-west-1",
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2",
      ].sort(),
    );
  });

  it("refuses FIPS elsewhere but shows what the SDK would still build", () => {
    const r = buildHostname("aws", "eu-west-1", "fips");
    expect(r.kind).toBe("none");
    if (r.kind !== "ok") expect(r.sdkWouldBuild).toBe("sts-fips.eu-west-1.amazonaws.com");
  });

  it("has no global endpoint outside the commercial partition", () => {
    expect(host("aws-cn", "cn-north-1", "global")).toBe("none");
    expect(host("aws-us-gov", "us-gov-west-1", "global")).toBe("none");
    expect(host("aws-eusc", "eusc-de-east-1", "global")).toBe("none");
  });

  it("builds China, GovCloud and ESC Regional names from their suffixes", () => {
    expect(host("aws-cn", "cn-north-1", "regional")).toBe(
      "sts.cn-north-1.amazonaws.com.cn",
    );
    expect(host("aws-cn", "cn-northwest-1", "dualstack")).toBe(
      "sts.cn-northwest-1.api.amazonwebservices.com.cn",
    );
    expect(host("aws-us-gov", "us-gov-east-1", "dualstack")).toBe(
      "sts.us-gov-east-1.api.aws",
    );
    expect(host("aws-eusc", "eusc-de-east-1", "regional")).toBe(
      "sts.eusc-de-east-1.amazonaws.eu",
    );
  });

  it("treats GovCloud's standard endpoint as its FIPS endpoint", () => {
    expect(host("aws-us-gov", "us-gov-west-1", "fips")).toBe(
      "sts.us-gov-west-1.amazonaws.com",
    );
    expect(host("aws-us-gov", "us-gov-west-1", "fips-dualstack")).toBe("undocumented");
    expect(host("aws-cn", "cn-north-1", "fips")).toBe("none");
    expect(host("aws-eusc", "eusc-de-east-1", "fips")).toBe("undocumented");
  });

  it("marks ESC hostnames as derived", () => {
    const r = buildHostname("aws-eusc", "eusc-de-east-1", "regional");
    expect(r.kind === "ok" && r.notes.some((n) => n.en.includes("Derived"))).toBe(true);
  });

  it("flags VPC endpoint Regions missing from the IAM list", () => {
    const r = buildHostname("aws", "mx-central-1", "vpce");
    expect(r.kind === "ok" && r.notes.some((n) => n.en.includes("unverified"))).toBe(
      true,
    );
  });

  it("rejects a Region from another partition", () => {
    expect(host("aws", "cn-north-1", "regional")).toBe("none");
  });

  it("returns a verdict for every partition, Region and family", () => {
    for (const p of PARTITIONS)
      for (const region of p.regions)
        for (const f of FAMILIES) {
          const r = buildHostname(p.id, region, f);
          if (r.kind === "ok") {
            expect(r.host).toBe(r.segments.map((s) => s.text).join("."));
            expect(r.host).toMatch(/^sts(-fips)?\./);
          } else {
            expect(r.reason.en.length).toBeGreaterThan(10);
            expect(r.reason.ja.length).toBeGreaterThan(5);
          }
        }
  });
});
