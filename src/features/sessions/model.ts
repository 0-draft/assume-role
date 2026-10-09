/**
 * Pure models behind the sessions chapter. Every rule here is taken from the
 * IAM User Guide and the STS API Reference (see docs/04-sessions-and-policies.md);
 * the components only draw what these functions return.
 */

/* ------------------------------------------------------------------ */
/* Effective permissions                                               */
/* ------------------------------------------------------------------ */

export const ACTIONS = [
  "s3:GetObject",
  "s3:PutObject",
  "s3:DeleteBucket",
  "ec2:RunInstances",
  "kms:Decrypt",
  "iam:CreateUser",
] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * Gates in the order the AWS enforcement code evaluates them for a role
 * session in a single account (policy evaluation logic, IAM User Guide).
 */
export const LAYERS = ["deny", "rcp", "scp", "identity", "boundary", "session"] as const;
export type LayerId = (typeof LAYERS)[number];

export interface LayerState {
  /**
   * Whether this policy type is in play. When it is not:
   * - rcp / scp: nothing restricts (RCPFullAWSAccess / FullAWSAccess, or no Organizations)
   * - boundary: no permissions boundary on the role
   * - session: no session policy passed, so STS applies a default allow-all one
   * `identity` and `deny` are always present.
   */
  present: boolean;
  /** For `deny`: actions explicitly denied. For every other layer: actions allowed. */
  actions: ReadonlySet<Action>;
}

export type PermConfig = Record<LayerId, LayerState>;

/** A layer that is always evaluated and cannot be switched off. */
export const ALWAYS_PRESENT: ReadonlySet<LayerId> = new Set<LayerId>([
  "deny",
  "identity",
]);

export type Verdict = "pass" | "absent" | "blocked" | "skipped";

export interface ActionResult {
  action: Action;
  allowed: boolean;
  /** First gate that stopped the action, or null when it is allowed. */
  stoppedAt: LayerId | null;
  /** One verdict per layer, in LAYERS order. */
  verdicts: Record<LayerId, Verdict>;
}

export function evaluateAction(cfg: PermConfig, action: Action): ActionResult {
  let stoppedAt: LayerId | null = null;
  const verdicts = {} as Record<LayerId, Verdict>;
  for (const id of LAYERS) {
    if (stoppedAt) {
      verdicts[id] = "skipped";
      continue;
    }
    const layer = cfg[id];
    const present = ALWAYS_PRESENT.has(id) || layer.present;
    if (id === "deny") {
      const denied = layer.actions.has(action);
      verdicts[id] = denied ? "blocked" : "pass";
      if (denied) stoppedAt = id;
      continue;
    }
    if (!present) {
      verdicts[id] = "absent";
      continue;
    }
    if (layer.actions.has(action)) verdicts[id] = "pass";
    else {
      verdicts[id] = "blocked";
      stoppedAt = id;
    }
  }
  return { action, allowed: stoppedAt === null, stoppedAt, verdicts };
}

export function evaluate(cfg: PermConfig): ActionResult[] {
  return ACTIONS.map((a) => evaluateAction(cfg, a));
}

const set = (...a: Action[]) => new Set<Action>(a);

/** Starting point: a broad role narrowed by a boundary and a per-job session policy. */
export const DEFAULT_PERMS: PermConfig = {
  deny: { present: true, actions: set("s3:DeleteBucket") },
  rcp: { present: false, actions: set(...ACTIONS) },
  scp: { present: true, actions: set(...ACTIONS.filter((a) => a !== "iam:CreateUser")) },
  identity: { present: true, actions: set(...ACTIONS) },
  boundary: {
    present: true,
    actions: set(
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteBucket",
      "kms:Decrypt",
      "ec2:RunInstances",
    ),
  },
  session: { present: true, actions: set("s3:GetObject", "s3:PutObject") },
};

export function toggleAction(
  cfg: PermConfig,
  layer: LayerId,
  action: Action,
): PermConfig {
  const next = new Set(cfg[layer].actions);
  if (next.has(action)) next.delete(action);
  else next.add(action);
  return { ...cfg, [layer]: { ...cfg[layer], actions: next } };
}

export function togglePresent(cfg: PermConfig, layer: LayerId): PermConfig {
  if (ALWAYS_PRESENT.has(layer)) return cfg;
  return { ...cfg, [layer]: { ...cfg[layer], present: !cfg[layer].present } };
}

/* ------------------------------------------------------------------ */
/* Role chaining                                                       */
/* ------------------------------------------------------------------ */

/** Who holds the credentials before the first AssumeRole* call. */
export type Origin = "iam-user" | "federation" | "service-role" | "role-session";

export interface Tag {
  key: string;
  value: string;
  transitive: boolean;
}

export interface Hop {
  role: string;
  /** The role's MaxSessionDuration: 3600 to 43200 seconds. */
  maxSessionDuration: number;
  /** DurationSeconds sent on this call. */
  requested: number;
  /** Session tags passed on this call (Tags + TransitiveTagKeys, or IdP claims). */
  sessionTags: Tag[];
  /** IAM tags attached to the role itself. Never transitive. */
  roleTags: { key: string; value: string }[];
  /** SourceIdentity sent on this call, if any. */
  sourceIdentity?: string;
}

export type HopError =
  | "duration-below-min"
  | "duration-over-role-max"
  | "duration-over-chain-cap"
  | "transitive-tag-override"
  | "source-identity-change";

export interface HopResult {
  role: string;
  /** Which STS operation this hop is. */
  operation: "AssumeRole" | "AssumeRoleWithSAML / WithWebIdentity";
  chained: boolean;
  maxAllowed: number;
  requested: number;
  error: HopError | null;
  /** Set when an earlier hop failed, so this one never ran. */
  blocked: boolean;
  /** aws:PrincipalTag/* visible in requests made with this session. */
  principalTags: Record<string, string>;
  /** Keys that will flow into the next hop. */
  transitiveKeys: string[];
  sourceIdentity: string | null;
}

export const MIN_DURATION = 900;
export const CHAIN_CAP = 3600;
export const MAX_ROLE_SESSION = 43200;

/** Does the first hop already count as role chaining? */
export function firstHopChained(origin: Origin): boolean {
  // A role session (including the credentials an AWS service hands your code)
  // assuming another role is chaining by the IAM definition. IAM user keys and
  // SAML/OIDC tokens are not.
  return origin === "role-session" || origin === "service-role";
}

const lower = (s: string) => s.toLowerCase();

export function evaluateChain(origin: Origin, hops: Hop[]): HopResult[] {
  const out: HopResult[] = [];
  let inherited: Record<string, string> = {}; // transitive tags, lower-cased key -> value
  let inheritedNames: Record<string, string> = {}; // lower-cased key -> original case
  let sourceIdentity: string | null = null;
  let failed = false;

  hops.forEach((hop, i) => {
    const chained = i > 0 || firstHopChained(origin);
    const operation =
      i === 0 && origin === "federation"
        ? "AssumeRoleWithSAML / WithWebIdentity"
        : "AssumeRole";
    const maxAllowed = chained ? CHAIN_CAP : hop.maxSessionDuration;
    const base: HopResult = {
      role: hop.role,
      operation,
      chained,
      maxAllowed,
      requested: hop.requested,
      error: null,
      blocked: failed,
      principalTags: {},
      transitiveKeys: [],
      sourceIdentity,
    };
    if (failed) {
      out.push(base);
      return;
    }

    let error: HopError | null = null;
    if (hop.requested < MIN_DURATION) error = "duration-below-min";
    else if (chained && hop.requested > CHAIN_CAP) error = "duration-over-chain-cap";
    else if (hop.requested > hop.maxSessionDuration) error = "duration-over-role-max";
    else if (hop.sessionTags.some((t) => lower(t.key) in inherited))
      error = "transitive-tag-override";
    else if (
      sourceIdentity !== null &&
      hop.sourceIdentity !== undefined &&
      hop.sourceIdentity !== sourceIdentity
    )
      error = "source-identity-change";

    if (error) {
      failed = true;
      out.push({ ...base, error });
      return;
    }

    // Principal tags: role tags, overridden by session tags and inherited
    // transitive tags with the same (case-insensitive) key.
    const tags: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const t of hop.roleTags) {
      tags[lower(t.key)] = t.value;
      names[lower(t.key)] = t.key;
    }
    for (const [k, v] of Object.entries(inherited)) {
      tags[k] = v;
      names[k] = inheritedNames[k];
    }
    for (const t of hop.sessionTags) {
      tags[lower(t.key)] = t.value;
      names[lower(t.key)] = t.key;
    }

    const nextInherited = { ...inherited };
    const nextNames = { ...inheritedNames };
    for (const t of hop.sessionTags) {
      if (t.transitive) {
        nextInherited[lower(t.key)] = t.value;
        nextNames[lower(t.key)] = t.key;
      }
    }
    inherited = nextInherited;
    inheritedNames = nextNames;
    if (sourceIdentity === null && hop.sourceIdentity)
      sourceIdentity = hop.sourceIdentity;

    out.push({
      ...base,
      principalTags: Object.fromEntries(
        Object.entries(tags).map(([k, v]) => [names[k], v]),
      ),
      transitiveKeys: Object.keys(inherited).map((k) => inheritedNames[k]),
      sourceIdentity,
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Session token size                                                  */
/* ------------------------------------------------------------------ */

/** Documented hard limits (IAM quotas, STS API Reference, 2026-09-15 change). */
export const LIMITS = {
  tags: 50,
  tagKey: 128,
  tagValue: 256,
  policyPlaintext: 2048,
  managedArns: 10,
  tokenBytes: 4096,
  minimumSessionTokenSize: 4096,
} as const;

export interface TokenInput {
  tagCount: number;
  /** Average characters per tag (key + value). */
  tagChars: number;
  inlinePolicyChars: number;
  managedArns: number;
  /** MinimumSessionTokenSize request parameter, 0 to 4096. */
  minimumSize: number;
}

/** A typical managed policy ARN: arn:aws:iam::111122223333:policy/ReadOnlyS3Artifacts */
export const SAMPLE_ARN_CHARS = "arn:aws:iam::111122223333:policy/ReadOnlyS3Artifacts"
  .length;

/**
 * Illustrative only. AWS does not publish how it packs policies and tags into
 * the token, so these weights exist to show the shape of the problem (tags and
 * policies both eat into one byte budget), not to predict a real token.
 */
export const ILLUSTRATIVE = {
  baseBytes: 360,
  bytesPerTagOverhead: 6,
  bytesPerTagChar: 0.75,
  bytesPerPolicyChar: 0.45,
  bytesPerArn: 28,
} as const;

export interface TokenEstimate {
  /** Exact, documented: inline policy + ARN characters against 2048. */
  policyPlaintext: number;
  policyPlaintextOk: boolean;
  tagsOk: boolean;
  arnsOk: boolean;
  segments: { base: number; tags: number; policy: number; padding: number };
  /** Illustrative token size in bytes after MinimumSessionTokenSize padding. */
  bytes: number;
  /** bytes / 4096 as a whole percentage, as SessionTokenUtilization reports it. */
  utilization: number;
  tooLarge: boolean;
}

export function estimateToken(input: TokenInput): TokenEstimate {
  const I = ILLUSTRATIVE;
  const policyPlaintext = input.inlinePolicyChars + input.managedArns * SAMPLE_ARN_CHARS;
  const base = I.baseBytes;
  const tags = Math.round(
    input.tagCount * (I.bytesPerTagOverhead + input.tagChars * I.bytesPerTagChar),
  );
  const policy = Math.round(
    input.inlinePolicyChars * I.bytesPerPolicyChar + input.managedArns * I.bytesPerArn,
  );
  const content = base + tags + policy;
  const minimum = Math.max(
    0,
    Math.min(LIMITS.minimumSessionTokenSize, input.minimumSize),
  );
  const padding = Math.max(0, minimum - content);
  const bytes = content + padding;
  return {
    policyPlaintext,
    policyPlaintextOk: policyPlaintext <= LIMITS.policyPlaintext,
    tagsOk: input.tagCount <= LIMITS.tags,
    arnsOk: input.managedArns <= LIMITS.managedArns,
    segments: { base, tags, policy, padding },
    bytes,
    utilization: Math.round((bytes / LIMITS.tokenBytes) * 100),
    tooLarge: bytes > LIMITS.tokenBytes,
  };
}

/* ------------------------------------------------------------------ */
/* Revoking sessions                                                   */
/* ------------------------------------------------------------------ */

export interface SessionStub {
  id: string;
  /** Minutes relative to "now" (negative = in the past). */
  issuedAt: number;
  /** Lifetime in minutes. */
  duration: number;
}

export type SessionState = "active" | "expired" | "revoked";

/** The console stamps the deny about 30 seconds into the future. */
export const REVOKE_LEAD_MINUTES = 0.5;

export function sessionState(
  s: SessionStub,
  now: number,
  revokeBefore: number | null,
): SessionState {
  if (s.issuedAt + s.duration <= now) return "expired";
  if (revokeBefore !== null && s.issuedAt < revokeBefore) return "revoked";
  return "active";
}

/** Base wall-clock time for minute 0 in the timeline. */
export const TIMELINE_EPOCH = Date.UTC(2026, 9, 10, 9, 0, 0);

export function isoAt(minutes: number): string {
  return new Date(TIMELINE_EPOCH + minutes * 60_000).toISOString().replace(".000Z", "Z");
}

export function revokePolicy(revokeBefore: number): string {
  return JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: {
        Effect: "Deny",
        Action: "*",
        Resource: "*",
        Condition: { DateLessThan: { "aws:TokenIssueTime": isoAt(revokeBefore) } },
      },
    },
    null,
    2,
  );
}
