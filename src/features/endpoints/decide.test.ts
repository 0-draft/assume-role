import { decide, type Answers } from "./decide";

const base: Answers = {
  commercial: true,
  fips: false,
  fipsRegion: false,
  privateNoEgress: false,
  ipv6: false,
};

describe("decide", () => {
  it("defaults to the workload's Regional endpoint", () => {
    expect(decide(base).host).toBe("sts.<region>.amazonaws.com");
  });
  it("stops at the partition question for non-commercial partitions", () => {
    const d = decide({ ...base, commercial: false });
    expect(d.asked).toEqual(["commercial"]);
  });
  it("routes FIPS to sts-fips only in FIPS Regions", () => {
    expect(decide({ ...base, fips: true, fipsRegion: true }).host).toBe(
      "sts-fips.<region>.amazonaws.com",
    );
    expect(decide({ ...base, fips: true, fipsRegion: true, ipv6: true }).host).toBe(
      "sts-fips.<region>.api.aws",
    );
    expect(decide({ ...base, fips: true }).host).toBeNull();
  });
  it("sends private subnets to the VPC endpoint", () => {
    expect(decide({ ...base, privateNoEgress: true }).why.en).toContain(
      "com.amazonaws.<region>.sts",
    );
  });
  it("sends IPv6 clients to dual-stack", () => {
    expect(decide({ ...base, ipv6: true }).host).toBe("sts.<region>.api.aws");
  });
});
