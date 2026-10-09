import { evaluateGates, type GateInput } from "./gates";

const base: GateInput = {
  account: "same",
  naming: "direct",
  identityAllows: false,
  trustAllows: true,
};

describe("evaluateGates", () => {
  it("same account, principal named directly: no identity grant needed", () => {
    const r = evaluateGates(base);
    expect(r.allowed).toBe(true);
    expect(r.identity).toBe("skip");
  });

  it("same account via :root needs the identity grant", () => {
    expect(evaluateGates({ ...base, naming: "root" }).allowed).toBe(false);
    expect(evaluateGates({ ...base, naming: "root", identityAllows: true }).allowed).toBe(
      true,
    );
  });

  it("cross account always needs both sides", () => {
    for (const naming of ["direct", "root"] as const) {
      expect(evaluateGates({ ...base, account: "cross", naming }).allowed).toBe(false);
      const ok = evaluateGates({
        ...base,
        account: "cross",
        naming,
        identityAllows: true,
      });
      expect(ok.allowed).toBe(true);
      expect(ok.identity).toBe("pass");
      expect(ok.trust).toBe("pass");
    }
  });

  it("no trust grant means denied, whatever the identity policy says", () => {
    for (const account of ["same", "cross"] as const)
      for (const naming of ["direct", "root", "self"] as const)
        for (const identityAllows of [true, false]) {
          const r = evaluateGates({
            account,
            naming,
            identityAllows,
            trustAllows: false,
          });
          expect(r.allowed).toBe(false);
          expect(r.trust).toBe("fail");
        }
  });

  it("self-assume needs the role named in its own trust policy (2022-09-21)", () => {
    const r = evaluateGates({
      ...base,
      naming: "self",
      identityAllows: true,
      trustAllows: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.why.en).toContain("2022-09-21");
    expect(evaluateGates({ ...base, naming: "self" }).allowed).toBe(true);
  });

  it("self naming is meaningless across accounts and is treated as direct", () => {
    const r = evaluateGates({
      ...base,
      account: "cross",
      naming: "self",
      identityAllows: true,
    });
    expect(r.allowed).toBe(true);
    expect(r.why.en).not.toContain("itself");
  });

  it("explains every outcome in both languages", () => {
    for (const account of ["same", "cross"] as const)
      for (const naming of ["direct", "root", "self"] as const)
        for (const identityAllows of [true, false])
          for (const trustAllows of [true, false]) {
            const { why } = evaluateGates({
              account,
              naming,
              identityAllows,
              trustAllows,
            });
            expect(why.en.length).toBeGreaterThan(10);
            expect(why.ja.length).toBeGreaterThan(10);
          }
  });
});
