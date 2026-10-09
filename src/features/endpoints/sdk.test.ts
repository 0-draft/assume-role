import { resolveSdk, toolById, TOOLS } from "./sdk";

const host = (
  id: string,
  setting: "unset" | "legacy" | "regional",
  region: string | null,
) => resolveSdk(toolById(id), setting, region).host;

describe("resolveSdk", () => {
  it("reflects the 2025-07-31 default flip for Boto3 and CLI v1", () => {
    expect(host("boto3-old", "unset", "eu-west-1")).toBe("sts.amazonaws.com");
    expect(host("boto3-new", "unset", "eu-west-1")).toBe("sts.eu-west-1.amazonaws.com");
    expect(host("cli-v1-old", "unset", "eu-west-1")).toBe("sts.amazonaws.com");
    expect(host("cli-v1-new", "unset", "eu-west-1")).toBe("sts.eu-west-1.amazonaws.com");
  });

  it("lets `legacy` bring the global endpoint back", () => {
    expect(host("boto3-new", "legacy", "eu-west-1")).toBe("sts.amazonaws.com");
  });

  it("sends Seoul and Osaka Regional even in legacy mode", () => {
    expect(host("boto3-old", "unset", "ap-northeast-2")).toBe(
      "sts.ap-northeast-2.amazonaws.com",
    );
    expect(host("java-1", "legacy", "ap-northeast-3")).toBe(
      "sts.ap-northeast-3.amazonaws.com",
    );
    expect(host("java-1", "legacy", "ap-east-1")).toBe("sts.ap-east-1.amazonaws.com");
  });

  it("ignores the setting in SDKs that don't read it", () => {
    const r = resolveSdk(toolById("go-v2"), "legacy", "eu-west-1");
    expect(r.host).toBe("sts.eu-west-1.amazonaws.com");
    expect(r.ignoredSetting).toBe(true);
  });

  it("follows each SDK's no-Region fallback", () => {
    expect(host("cli-v2", "unset", null)).toBe("sts.amazonaws.com");
    expect(host("js-v3", "unset", null)).toBe("sts.us-east-1.amazonaws.com");
    expect(host("go-v2", "unset", null)).toBeNull();
  });

  it("honours the aws-global pseudo-Region", () => {
    expect(host("go-v2", "unset", "aws-global")).toBe("sts.amazonaws.com");
  });

  it("has unique ids and bilingual notes", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    for (const t of TOOLS) if (t.note) expect(t.note.ja).not.toBe("");
  });
});
