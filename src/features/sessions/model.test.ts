import {
  ACTIONS,
  DEFAULT_PERMS,
  LIMITS,
  estimateToken,
  evaluate,
  evaluateAction,
  evaluateChain,
  isoAt,
  revokePolicy,
  sessionState,
  toggleAction,
  togglePresent,
  type Hop,
  type PermConfig,
} from "./model";

const allowAll = (): PermConfig => ({
  deny: { present: true, actions: new Set() },
  rcp: { present: false, actions: new Set() },
  scp: { present: false, actions: new Set() },
  identity: { present: true, actions: new Set(ACTIONS) },
  boundary: { present: false, actions: new Set() },
  session: { present: false, actions: new Set() },
});

describe("effective permissions", () => {
  it("allows everything the identity policy allows when nothing else is in play", () => {
    expect(evaluate(allowAll()).every((r) => r.allowed)).toBe(true);
  });

  it("treats a missing session policy as the default allow-all", () => {
    const r = evaluateAction(allowAll(), "kms:Decrypt");
    expect(r.verdicts.session).toBe("absent");
    expect(r.allowed).toBe(true);
  });

  it("an explicit deny wins before anything else is looked at", () => {
    const cfg = toggleAction(allowAll(), "deny", "s3:GetObject");
    const r = evaluateAction(cfg, "s3:GetObject");
    expect(r.allowed).toBe(false);
    expect(r.stoppedAt).toBe("deny");
    expect(r.verdicts.identity).toBe("skipped");
  });

  it("a passed session policy can only narrow", () => {
    let cfg = togglePresent(allowAll(), "session");
    cfg = toggleAction(cfg, "session", "s3:GetObject");
    const allowed = evaluate(cfg)
      .filter((r) => r.allowed)
      .map((r) => r.action);
    expect(allowed).toEqual(["s3:GetObject"]);
  });

  it("the session policy cannot grant what the identity policy lacks", () => {
    let cfg = toggleAction(allowAll(), "identity", "iam:CreateUser"); // remove
    cfg = togglePresent(cfg, "session");
    cfg = toggleAction(cfg, "session", "iam:CreateUser");
    const r = evaluateAction(cfg, "iam:CreateUser");
    expect(r.allowed).toBe(false);
    expect(r.stoppedAt).toBe("identity");
  });

  it("the default lab leaves exactly the session-policy actions", () => {
    const allowed = evaluate(DEFAULT_PERMS)
      .filter((r) => r.allowed)
      .map((r) => r.action);
    expect(allowed).toEqual(["s3:GetObject", "s3:PutObject"]);
    expect(evaluateAction(DEFAULT_PERMS, "s3:DeleteBucket").stoppedAt).toBe("deny");
    expect(evaluateAction(DEFAULT_PERMS, "iam:CreateUser").stoppedAt).toBe("scp");
    expect(evaluateAction(DEFAULT_PERMS, "ec2:RunInstances").stoppedAt).toBe("session");
  });

  it("identity and explicit deny cannot be switched off", () => {
    expect(togglePresent(DEFAULT_PERMS, "identity")).toBe(DEFAULT_PERMS);
    expect(togglePresent(DEFAULT_PERMS, "deny")).toBe(DEFAULT_PERMS);
  });
});

const hop = (over: Partial<Hop> = {}): Hop => ({
  role: "RoleB",
  maxSessionDuration: 43200,
  requested: 3600,
  sessionTags: [],
  roleTags: [],
  ...over,
});

describe("role chaining", () => {
  it("an IAM user's first hop can use the role's full max", () => {
    const [r] = evaluateChain("iam-user", [hop({ requested: 43200 })]);
    expect(r.chained).toBe(false);
    expect(r.maxAllowed).toBe(43200);
    expect(r.error).toBeNull();
  });

  it("federation is not chaining, but the hop after it is", () => {
    const [a, b] = evaluateChain("federation", [
      hop({ requested: 7200 }),
      hop({ role: "RoleC", requested: 7200 }),
    ]);
    expect(a.operation).toBe("AssumeRoleWithSAML / WithWebIdentity");
    expect(a.error).toBeNull();
    expect(b.chained).toBe(true);
    expect(b.error).toBe("duration-over-chain-cap");
  });

  it("a role session asking for more than 1 hour fails even if the role allows 12", () => {
    const [r] = evaluateChain("role-session", [hop({ requested: 3601 })]);
    expect(r.error).toBe("duration-over-chain-cap");
  });

  it("rejects durations below 900 seconds and above the role max", () => {
    expect(evaluateChain("iam-user", [hop({ requested: 899 })])[0].error).toBe(
      "duration-below-min",
    );
    expect(
      evaluateChain("iam-user", [hop({ maxSessionDuration: 3600, requested: 7200 })])[0]
        .error,
    ).toBe("duration-over-role-max");
  });

  it("blocks every hop after a failure", () => {
    const rs = evaluateChain("iam-user", [
      hop({ requested: 600 }),
      hop({ role: "RoleC" }),
    ]);
    expect(rs[1].blocked).toBe(true);
  });

  it("only transitive session tags flow on; role tags never do", () => {
    const [a, b] = evaluateChain("iam-user", [
      hop({
        sessionTags: [
          { key: "Project", value: "apollo", transitive: true },
          { key: "CostCenter", value: "42", transitive: false },
        ],
        roleTags: [{ key: "Team", value: "platform" }],
      }),
      hop({ role: "RoleC", roleTags: [{ key: "Env", value: "prod" }] }),
    ]);
    expect(a.principalTags).toEqual({
      Team: "platform",
      Project: "apollo",
      CostCenter: "42",
    });
    expect(b.principalTags).toEqual({ Env: "prod", Project: "apollo" });
    expect(b.transitiveKeys).toEqual(["Project"]);
  });

  it("an inherited transitive tag overrides a role tag with the same key", () => {
    const [, b] = evaluateChain("iam-user", [
      hop({ sessionTags: [{ key: "Star", value: "1", transitive: true }] }),
      hop({ role: "RoleC", roleTags: [{ key: "star", value: "3" }] }),
    ]);
    expect(Object.values(b.principalTags)).toEqual(["1"]);
  });

  it("re-passing an inherited transitive key fails (case-insensitive)", () => {
    const [, b] = evaluateChain("iam-user", [
      hop({ sessionTags: [{ key: "Project", value: "apollo", transitive: true }] }),
      hop({
        role: "RoleC",
        sessionTags: [{ key: "project", value: "x", transitive: false }],
      }),
    ]);
    expect(b.error).toBe("transitive-tag-override");
  });

  it("source identity is set once and cannot change", () => {
    const rs = evaluateChain("iam-user", [
      hop({ sourceIdentity: "alice@example.com" }),
      hop({ role: "RoleC" }),
      hop({ role: "RoleD", sourceIdentity: "alice@example.com" }),
      hop({ role: "RoleE", sourceIdentity: "bob@example.com" }),
    ]);
    expect(rs[1].sourceIdentity).toBe("alice@example.com");
    expect(rs[2].error).toBeNull();
    expect(rs[3].error).toBe("source-identity-change");
  });
});

describe("session token size", () => {
  const base = {
    tagCount: 0,
    tagChars: 20,
    inlinePolicyChars: 0,
    managedArns: 0,
    minimumSize: 0,
  };

  it("checks the documented 2048-character policy plaintext limit exactly", () => {
    expect(estimateToken({ ...base, inlinePolicyChars: 2048 }).policyPlaintextOk).toBe(
      true,
    );
    expect(estimateToken({ ...base, inlinePolicyChars: 2049 }).policyPlaintextOk).toBe(
      false,
    );
  });

  it("pads up to MinimumSessionTokenSize and reports utilization against 4096 bytes", () => {
    const e = estimateToken({ ...base, minimumSize: 2048 });
    expect(e.bytes).toBe(2048);
    expect(e.utilization).toBe(50);
    expect(e.segments.padding).toBeGreaterThan(0);
  });

  it("can exceed the token budget while every individual limit is met", () => {
    const e = estimateToken({
      tagCount: LIMITS.tags,
      tagChars: 128 + 256,
      inlinePolicyChars: 1500,
      managedArns: 10,
      minimumSize: 0,
    });
    expect(e.tagsOk && e.arnsOk).toBe(true);
    expect(e.tooLarge).toBe(true);
  });
});

describe("revoking sessions", () => {
  const s = { id: "a", issuedAt: -30, duration: 60 };

  it("revokes sessions issued before the cut-off and keeps newer ones", () => {
    expect(sessionState(s, 0, null)).toBe("active");
    expect(sessionState(s, 0, 0.5)).toBe("revoked");
    expect(sessionState({ ...s, issuedAt: 1 }, 2, 0.5)).toBe("active");
  });

  it("expired sessions stay expired", () => {
    expect(sessionState({ ...s, issuedAt: -70 }, 0, 0.5)).toBe("expired");
  });

  it("writes the AWSRevokeOlderSessions deny with aws:TokenIssueTime", () => {
    expect(isoAt(0.5)).toBe("2026-10-10T09:00:30Z");
    const p = JSON.parse(revokePolicy(0.5)) as {
      Statement: { Effect: string; Condition: { DateLessThan: Record<string, string> } };
    };
    expect(p.Statement.Effect).toBe("Deny");
    expect(p.Statement.Condition.DateLessThan["aws:TokenIssueTime"]).toBe(
      "2026-10-10T09:00:30Z",
    );
  });
});
