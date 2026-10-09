/**
 * STS request quota model (docs/06, IAM and STS quotas page):
 * - 600 requests per second, per account, per Region, shared by AssumeRole,
 *   DecodeAuthorizationMessage, GetAccessKeyInfo, GetCallerIdentity,
 *   GetFederationToken and GetSessionToken.
 * - Calls made by AWS service principals don't count.
 * - Cross-account AssumeRole counts against the caller's account only.
 * - The global endpoint has its own budget, separate per originating Region.
 * - Other operations (the web identity / SAML calls, AssumeRoot…) are not on
 *   the documented list; their limits are not published.
 */
export const STS_RPS = 600;

export const SHARED_OPS = [
  "AssumeRole",
  "DecodeAuthorizationMessage",
  "GetAccessKeyInfo",
  "GetCallerIdentity",
  "GetFederationToken",
  "GetSessionToken",
] as const;

export type SourceId = "app" | "health" | "lambda" | "partner" | "global" | "oidc";

export interface Source {
  id: SourceId;
  op: string;
  /** Whose account pays, or null if the call does not count against any documented quota. */
  account: "you" | "partner" | null;
  endpoint: "regional" | "global" | null;
  region: string | null;
}

export const SOURCES: Source[] = [
  {
    id: "app",
    op: "AssumeRole",
    account: "you",
    endpoint: "regional",
    region: "ap-northeast-1",
  },
  {
    id: "health",
    op: "GetCallerIdentity",
    account: "you",
    endpoint: "regional",
    region: "ap-northeast-1",
  },
  { id: "lambda", op: "AssumeRole", account: null, endpoint: null, region: null },
  {
    id: "partner",
    op: "AssumeRole",
    account: "partner",
    endpoint: "regional",
    region: "ap-northeast-1",
  },
  {
    id: "global",
    op: "AssumeRole",
    account: "you",
    endpoint: "global",
    region: "eu-north-1",
  },
  {
    id: "oidc",
    op: "AssumeRoleWithWebIdentity",
    account: null,
    endpoint: null,
    region: null,
  },
];

export interface Bucket {
  key: string;
  account: "you" | "partner";
  endpoint: "regional" | "global";
  region: string;
  rps: number;
  throttled: boolean;
}

/** Sum requests per second into quota buckets. Sources that don't count are skipped. */
export function buckets(rates: Partial<Record<SourceId, number>>): Bucket[] {
  const out = new Map<string, Bucket>();
  for (const s of SOURCES) {
    const rps = Math.max(0, rates[s.id] ?? 0);
    if (!s.account || !s.endpoint || !s.region) continue;
    const key = `${s.account}|${s.endpoint}|${s.region}`;
    const b = out.get(key) ?? {
      key,
      account: s.account,
      endpoint: s.endpoint,
      region: s.region,
      rps: 0,
      throttled: false,
    };
    b.rps += rps;
    b.throttled = b.rps > STS_RPS;
    out.set(key, b);
  }
  return [...out.values()];
}

export const counts = (id: SourceId) => {
  const s = SOURCES.find((x) => x.id === id);
  return !!s?.account;
};
