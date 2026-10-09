import { CHAINS, provides, resolve, type Sources } from "./chain";

const none: Sources = {
  envKeys: false,
  webIdentity: false,
  profile: "none",
  container: false,
  imds: false,
};

describe("default credential provider chain", () => {
  it("returns null when nothing is configured", () => {
    for (const sdk of ["cli", "boto3", "java", "go"] as const)
      expect(resolve(sdk, none).winner).toBeNull();
  });

  it("lets env keys beat everything", () => {
    const all: Sources = {
      envKeys: true,
      webIdentity: true,
      profile: "sso",
      container: true,
      imds: true,
    };
    for (const sdk of ["cli", "boto3", "java", "go"] as const) {
      const r = resolve(sdk, all);
      expect(r.winner).toBe("env");
      expect(r.shadowed).toContain("imds");
    }
  });

  it("puts web identity before container before IMDS (IRSA leftovers beat Pod Identity)", () => {
    const s = { ...none, webIdentity: true, container: true, imds: true };
    for (const sdk of ["cli", "boto3", "java", "go"] as const) {
      const r = resolve(sdk, s);
      expect(r.winner).toBe("webIdentity");
      expect(r.shadowed).toEqual(["container", "imds"]);
    }
  });

  it("falls through to IMDS on a bare EC2 instance", () => {
    expect(resolve("go", { ...none, imds: true }).winner).toBe("imds");
  });

  it("CLI checks role_arn profiles before web identity; Java reads web identity first", () => {
    const s = { ...none, webIdentity: true, profile: "role" as const };
    expect(resolve("cli", s).winner).toBe("role");
    expect(resolve("boto3", s).winner).toBe("role");
    expect(resolve("java", s).winner).toBe("webIdentity");
    expect(resolve("go", s).winner).toBe("webIdentity");
  });

  it("boto3 asks SSO before the credentials file; the CLI does not", () => {
    expect(CHAINS.boto3.indexOf("sso")).toBeLessThan(CHAINS.boto3.indexOf("static"));
    expect(CHAINS.cli.indexOf("static")).toBeLessThan(CHAINS.cli.indexOf("sso"));
  });

  it("treats a Java/Go profile as one provider whatever it holds", () => {
    for (const kind of ["static", "role", "sso"] as const)
      expect(provides("profile", { ...none, profile: kind })).toBe(true);
    expect(provides("profile", none)).toBe(false);
    expect(resolve("java", { ...none, profile: "sso", imds: true }).winner).toBe(
      "profile",
    );
  });

  it("every chain ends with container then IMDS", () => {
    for (const order of Object.values(CHAINS))
      expect(order.slice(-2)).toEqual(["container", "imds"]);
  });
});
