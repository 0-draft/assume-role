import { decodeId, PREFIXES } from "./prefix";

describe("decodeId", () => {
  it("knows all twelve documented prefixes", () => {
    expect(PREFIXES).toHaveLength(12);
    expect(new Set(PREFIXES.map((p) => p.prefix)).size).toBe(12);
    for (const p of PREFIXES) expect(p.label.en && p.label.ja).toBeTruthy();
  });

  it("tells long-term keys from temporary ones", () => {
    const akia = decodeId("AKIAI44QH8DHBEXAMPLE");
    const asia = decodeId("  ASIAIOSFODNN7EXAMPLE ");
    expect(akia.status === "match" && akia.entry.kind).toBe("long-term-key");
    expect(asia.status === "match" && asia.entry.kind).toBe("temp-key");
  });

  it("reads a role session aws:userid", () => {
    const d = decodeId("AROA123EXAMPLE123:alice-cli");
    expect(d).toMatchObject({ status: "match", session: "alice-cli" });
    expect(d.status === "match" && d.entry.prefix).toBe("AROA");
  });

  it("keeps colons inside session names", () => {
    expect(decodeId("AROAX:a:b")).toMatchObject({ session: "a:b" });
  });

  it("is case-insensitive on the prefix", () => {
    expect(decodeId("asiaxyz")).toMatchObject({ status: "match" });
  });

  it("reads account IDs and federated user ids", () => {
    expect(decodeId("123456789012")).toEqual({
      status: "account",
      account: "123456789012",
    });
    expect(decodeId("123456789012:Bob")).toEqual({
      status: "account",
      account: "123456789012",
      name: "Bob",
    });
  });

  it("handles empty, short and unknown input", () => {
    expect(decodeId("   ")).toEqual({ status: "empty" });
    expect(decodeId("AK")).toEqual({ status: "short" });
    expect(decodeId("ZZZZ1234")).toEqual({ status: "unknown", prefix: "ZZZZ" });
  });
});
