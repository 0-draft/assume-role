import { route, type RouteInput } from "./model";

const base: RouteInput = {
  caller: "vpc-default",
  endpoint: "global",
  resolver: "amazon",
  stsActive: true,
  tokenVersion: "v1",
  era: "after",
};

describe("route: global endpoint", () => {
  it("is served locally since April 2025 for default Regions via Amazon DNS", () => {
    const r = route(base);
    expect(r.servingRegion).toBe("eu-north-1");
    expect(r.servedLocally).toBe(true);
    expect(r.cloudTrailRegion).toBe("us-east-1");
    expect(r.requestedRegion).toBe("us-east-1");
    expect(r.requestDetails).toEqual({
      endpointType: "global",
      awsServingRegion: "eu-north-1",
    });
  });

  it("always went to us-east-1 before April 2025, with no RequestDetails fields", () => {
    const r = route({ ...base, era: "before" });
    expect(r.servingRegion).toBe("us-east-1");
    expect(r.servedLocally).toBe(false);
    expect(r.requestDetails).toBeNull();
    expect(r.cloudTrailRegion).toBe("us-east-1");
  });

  it("still goes to us-east-1 with a non-Amazon resolver", () => {
    expect(route({ ...base, resolver: "other" }).servingRegion).toBe("us-east-1");
  });

  it("still goes to us-east-1 from opt-in Regions", () => {
    const r = route({ ...base, caller: "vpc-optin" });
    expect(r.servingRegion).toBe("us-east-1");
    expect(r.requestDetails?.awsServingRegion).toBe("us-east-1");
  });

  it("still goes to us-east-1 from outside AWS, whatever resolver is chosen", () => {
    const r = route({ ...base, caller: "off-aws", resolver: "amazon" });
    expect(r.resolver).toBe("other");
    expect(r.servingRegion).toBe("us-east-1");
  });

  it("warns that v1 tokens fail in the opt-in Region the caller lives in", () => {
    const v1 = route({ ...base, caller: "vpc-optin" });
    expect(v1.tokenWorksInOptIn).toBe(false);
    expect(v1.warnings.some((w) => w.en.includes("InvalidClientTokenId"))).toBe(true);
    const v2 = route({ ...base, caller: "vpc-optin", tokenVersion: "v2" });
    expect(v2.tokenWorksInOptIn).toBe(true);
    expect(v2.warnings.some((w) => w.en.includes("InvalidClientTokenId"))).toBe(false);
  });

  it("never fails with RegionDisabledException (the global endpoint cannot be deactivated)", () => {
    expect(route({ ...base, stsActive: false }).error).toBeNull();
  });

  it("warns that VPC callers bypass the STS VPC endpoint", () => {
    expect(route(base).warnings.some((w) => w.en.includes("VPC endpoint"))).toBe(true);
    expect(
      route({ ...base, caller: "off-aws" }).warnings.some((w) =>
        w.en.includes("VPC endpoint"),
      ),
    ).toBe(false);
  });
});

describe("route: Regional endpoint", () => {
  const reg = { ...base, endpoint: "regional" as const };

  it("is served and logged in the caller's Region", () => {
    const r = route(reg);
    expect(r.hostname).toBe("sts.eu-north-1.amazonaws.com");
    expect(r.servingRegion).toBe("eu-north-1");
    expect(r.cloudTrailRegion).toBe("eu-north-1");
    expect(r.requestedRegion).toBe("eu-north-1");
    expect(r.tokenWorksInOptIn).toBe(true);
    expect(r.requestDetails).toEqual({
      endpointType: "regional",
      awsServingRegion: "eu-north-1",
    });
  });

  it("fails with RegionDisabledException (403) when STS is deactivated", () => {
    const r = route({ ...reg, stsActive: false });
    expect(r.error?.code).toBe("RegionDisabledException");
    expect(r.error?.http).toBe(403);
    expect(r.cloudTrailRegion).toBeNull();
  });

  it("ignores the switch in opt-in Regions, where STS is always on", () => {
    expect(route({ ...reg, caller: "vpc-optin", stsActive: false }).error).toBeNull();
  });

  it("uses the nearest Region for an off-AWS caller", () => {
    expect(route({ ...reg, caller: "off-aws" }).hostname).toBe(
      "sts.ap-northeast-1.amazonaws.com",
    );
  });
});
