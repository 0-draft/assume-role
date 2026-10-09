import { DURATIONS, logPos, formatDuration, RULER_MAX, RULER_MIN } from "./duration";
import { FAMILIES, HOLDINGS, OPS, opById } from "./ops";
import type { L } from "@/i18n/lang";

const filled = (l: L) => l.en.trim().length > 0 && l.ja.trim().length > 0;

describe("ops data", () => {
  it("lists exactly the 11 operations in the STS API Reference", () => {
    expect(OPS.map((o) => o.id).sort()).toEqual(
      [
        "AssumeRole",
        "AssumeRoleWithSAML",
        "AssumeRoleWithWebIdentity",
        "AssumeRoot",
        "DecodeAuthorizationMessage",
        "GetAccessKeyInfo",
        "GetCallerIdentity",
        "GetDelegatedAccessToken",
        "GetFederationToken",
        "GetSessionToken",
        "GetWebIdentityToken",
      ].sort(),
    );
  });

  it("has English and Japanese copy for every field", () => {
    for (const o of OPS) {
      for (const l of [
        o.purpose,
        o.caller,
        o.duration,
        o.mfa,
        o.sessionPolicy,
        o.tags,
        o.matrix.caller,
        o.matrix.temp,
        o.matrix.duration,
        ...(o.restrictions ? [o.restrictions] : []),
        ...(o.responseNote ? [o.responseNote] : []),
      ])
        expect(filled(l), `${o.id}: ${l.en}`).toBe(true);
    }
    for (const f of FAMILIES) expect(filled(f.label) && filled(f.blurb)).toBe(true);
    for (const h of HOLDINGS) expect(filled(h.label) && filled(h.why)).toBe(true);
  });

  it("only the two federation calls are unsigned", () => {
    expect(OPS.filter((o) => o.auth === "unsigned").map((o) => o.id)).toEqual([
      "AssumeRoleWithSAML",
      "AssumeRoleWithWebIdentity",
    ]);
  });

  it("AssumeRoot and GetWebIdentityToken are Regional-only", () => {
    expect(OPS.filter((o) => o.regionalOnly).map((o) => o.id)).toEqual([
      "AssumeRoot",
      "GetWebIdentityToken",
    ]);
  });

  it("every family and holding points at real operations", () => {
    for (const o of OPS) expect(FAMILIES.some((f) => f.id === o.family)).toBe(true);
    for (const h of HOLDINGS) for (const id of h.ops) expect(opById(id).id).toBe(id);
    expect(() => opById("Nope" as never)).toThrow();
  });

  it("every sample response is valid JSON with fake keys", () => {
    for (const o of OPS) {
      expect(() => JSON.parse(o.response) as unknown, o.id).not.toThrow();
      const keys = o.response.match(/"AccessKeyId": "([^"]+)"/g) ?? [];
      for (const k of keys) expect(k, o.id).toMatch(/EXAMPLE/);
    }
  });
});

describe("durations", () => {
  it("keep min <= default <= max", () => {
    for (const r of DURATIONS) {
      expect(r.min).toBeLessThanOrEqual(r.max);
      if (r.def !== undefined) {
        expect(r.min).toBeLessThanOrEqual(r.def);
        expect(r.def).toBeLessThanOrEqual(r.max);
      }
    }
  });

  it("match the documented limits", () => {
    const find = (op: string, variant?: string) =>
      DURATIONS.find((d) => d.op === op && d.variant?.en === variant)!;
    expect(find("AssumeRole")).toMatchObject({ min: 900, def: 3600, max: 43200 });
    expect(find("AssumeRole", "role chaining").max).toBe(3600);
    expect(find("AssumeRoot")).toMatchObject({ def: 900, max: 900 });
    expect(find("GetSessionToken", "IAM user")).toMatchObject({
      min: 900,
      def: 43200,
      max: 129600,
    });
    expect(find("GetSessionToken", "root")).toMatchObject({ def: 3600, max: 3600 });
    expect(find("GetWebIdentityToken", "JWT lifetime")).toMatchObject({
      min: 60,
      def: 300,
      max: 3600,
    });
    expect(find("GetDelegatedAccessToken")).toMatchObject({ min: 300, max: 43200 });
    expect(find("GetDelegatedAccessToken").def).toBeUndefined();
  });

  it("only point at operations that issue something", () => {
    const issuing = new Set(DURATIONS.map((d) => d.op));
    for (const o of OPS) expect(issuing.has(o.id), o.id).toBe(o.family !== "intro");
  });
});

describe("logPos", () => {
  it("maps the domain ends to 0 and 1", () => {
    expect(logPos(RULER_MIN)).toBe(0);
    expect(logPos(RULER_MAX)).toBe(1);
  });

  it("clamps out-of-range values, including AssumeRoot's documented 0 s", () => {
    expect(logPos(0)).toBe(0);
    expect(logPos(-5)).toBe(0);
    expect(logPos(1e9)).toBe(1);
    expect(logPos(Number.NaN)).toBe(0);
  });

  it("is monotonic and logarithmic", () => {
    const a = logPos(600);
    const b = logPos(6000);
    expect(a).toBeLessThan(b);
    // Equal ratios give equal distances on a log axis.
    expect(logPos(120) - logPos(60)).toBeCloseTo(logPos(7200) - logPos(3600), 10);
  });
});

describe("formatDuration", () => {
  it("picks the largest whole unit", () => {
    expect(formatDuration(900, "en")).toBe("15 min");
    expect(formatDuration(43200, "en")).toBe("12 h");
    expect(formatDuration(129600, "en")).toBe("36 h");
    expect(formatDuration(90, "en")).toBe("90 s");
    expect(formatDuration(0, "en")).toBe("0 s");
  });

  it("speaks Japanese", () => {
    expect(formatDuration(3600, "ja")).toBe("1 時間");
    expect(formatDuration(300, "ja")).toBe("5 分");
    expect(formatDuration(45, "ja")).toBe("45 秒");
  });
});
