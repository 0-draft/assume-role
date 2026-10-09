import { exposureHours, LIFETIMES } from "./exposure";
import { CALLERS, formatDuration, formatLeft } from "../hero/callers";

describe("exposureHours", () => {
  it("long-term keys stay usable until revoked", () => {
    expect(exposureHours(null, 500)).toBe(500);
  });
  it("temporary keys stop at expiry or revocation, whichever is first", () => {
    expect(exposureHours(1, 72)).toBe(1);
    expect(exposureHours(36, 2)).toBe(2);
  });
  it("lifetimes match documented maxima", () => {
    const byId = Object.fromEntries(LIFETIMES.map((l) => [l.id, l.hours]));
    expect(byId.gst).toBe(36); // GetSessionToken 129600 s
    expect(byId.role12).toBe(12); // MaxSessionDuration 43200 s
    expect(byId.root).toBe(0.25); // AssumeRoot 900 s
  });
});

describe("hero callers", () => {
  it("every caller has bilingual copy and an ASIA key", () => {
    for (const c of CALLERS) {
      expect(c.who.en && c.who.ja && c.holds.en && c.holds.ja).toBeTruthy();
      expect(c.accessKeyId).toMatch(/^ASIA[A-Z0-9]{16}$/);
    }
  });
  it("durations stay inside documented API ranges", () => {
    const max: Record<string, number> = {
      AssumeRole: 43200,
      AssumeRoleWithWebIdentity: 43200,
      AssumeRoleWithSAML: 43200,
      GetSessionToken: 129600,
      AssumeRoot: 900,
    };
    for (const c of CALLERS) {
      if (c.seconds === null) continue;
      expect(c.seconds).toBeGreaterThanOrEqual(900);
      expect(c.seconds).toBeLessThanOrEqual(max[c.api]);
    }
  });
  it("formats countdowns and durations", () => {
    expect(formatLeft(3599)).toBe("59:59");
    expect(formatLeft(43200)).toBe("12:00:00");
    expect(formatLeft(-5)).toBe("00:00");
    expect(formatDuration(900)).toBe("15 min");
    expect(formatDuration(43200)).toBe("12 h");
  });
});
