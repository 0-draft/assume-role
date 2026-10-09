import { evaluateOidc, policyJson, PRESETS, TOKENS, type TrustCondition } from "./oidc";

const preset = (id: string): TrustCondition => PRESETS.find((p) => p.id === id)!.cond;
const claims = (id: string) => TOKENS.find((t) => t.id === id)!.claims;
const allowedSet = (cond: TrustCondition) =>
  TOKENS.filter((t) => evaluateOidc(cond, t.claims).verdict === "allowed").map(
    (t) => t.id,
  );

describe("evaluateOidc", () => {
  it("exact main-branch policy admits only push to main", () => {
    expect(allowedSet(preset("exact"))).toEqual(["main"]);
  });

  it("environment policy admits only the production environment job", () => {
    expect(allowedSet(preset("env"))).toEqual(["env"]);
  });

  it("repo-wide policy admits every event of that repo, including pull_request", () => {
    expect(allowedSet(preset("repo"))).toEqual(["main", "branch", "pr", "env", "tag"]);
  });

  it("org-wide policy also admits sibling repos, but not strangers", () => {
    const s = allowedSet(preset("org"));
    expect(s).toContain("sibling");
    expect(s).not.toContain("stranger");
    expect(evaluateOidc(preset("org"), claims("main")).worldOpen).toBe(false);
  });

  it("repo:* is accepted by IAM but open to the world", () => {
    const r = evaluateOidc(preset("anyone"), claims("stranger"));
    expect(r.verdict).toBe("allowed");
    expect(r.worldOpen).toBe(true);
  });

  it("no sub condition, or a wildcard-only sub, cannot be saved", () => {
    expect(evaluateOidc(preset("nosub"), claims("main")).verdict).toBe("rejected-save");
    const star: TrustCondition = {
      audCheck: true,
      sub: { op: "StringLike", value: "*" },
    };
    expect(evaluateOidc(star, claims("main")).verdict).toBe("rejected-save");
  });

  it("name-only policies stop matching immutable (ID-qualified) subjects", () => {
    for (const id of ["exact", "repo", "org"]) {
      const r = evaluateOidc(preset(id), claims("immutable"));
      expect(r.verdict).toBe("denied");
      expect(r.why.en).toContain("2026-07-15");
    }
  });

  it("a token whose aud is not on the provider's list is rejected before the policy", () => {
    const r = evaluateOidc(preset("anyone"), claims("aud"));
    expect(r.verdict).toBe("bad-token");
  });

  it("StringEquals does not expand wildcards", () => {
    const c: TrustCondition = {
      audCheck: true,
      sub: { op: "StringEquals", value: "repo:example-org/infra:*" },
    };
    expect(evaluateOidc(c, claims("main")).verdict).toBe("denied");
  });

  it("detects the missing-slash prefix trap as world-open", () => {
    const c: TrustCondition = {
      audCheck: true,
      sub: { op: "StringLike", value: "repo:example-org*" },
    };
    expect(evaluateOidc(c, claims("main")).worldOpen).toBe(true);
  });
});

describe("policyJson", () => {
  it("renders aud and sub under their operators", () => {
    const doc = JSON.parse(policyJson(preset("repo"))) as {
      Statement: { Condition: Record<string, Record<string, string>> }[];
    };
    const cond = doc.Statement[0].Condition;
    expect(cond.StringEquals["token.actions.githubusercontent.com:aud"]).toBe(
      "sts.amazonaws.com",
    );
    expect(cond.StringLike["token.actions.githubusercontent.com:sub"]).toBe(
      "repo:example-org/infra:*",
    );
  });

  it("merges sub into StringEquals alongside aud", () => {
    const doc = JSON.parse(policyJson(preset("exact"))) as {
      Statement: { Condition: Record<string, Record<string, string>> }[];
    };
    expect(Object.keys(doc.Statement[0].Condition.StringEquals)).toHaveLength(2);
  });

  it("omits Condition entirely when nothing is checked", () => {
    const doc = JSON.parse(policyJson({ audCheck: false, sub: null })) as {
      Statement: Record<string, unknown>[];
    };
    expect(doc.Statement[0].Condition).toBeUndefined();
  });
});

describe("token samples", () => {
  it("follow GitHub's documented sub formats", () => {
    for (const t of TOKENS) {
      expect(t.claims.iss).toBe("https://token.actions.githubusercontent.com");
      expect(t.claims.sub).toMatch(
        /^repo:[^:]+:(ref:refs\/(heads|tags)\/.+|environment:.+|pull_request)$/,
      );
    }
  });
});
