import type { L } from "@/i18n/lang";
import { isOnlyWildcards, stringLike } from "./glob";

export const ISSUER = "https://token.actions.githubusercontent.com";
export const PROVIDER_KEY = "token.actions.githubusercontent.com";
/** Client ID (audience) registered on the IAM OIDC provider. */
export const PROVIDER_AUDIENCES = ["sts.amazonaws.com"];

export interface Claims {
  iss: string;
  aud: string;
  sub: string;
  repository: string;
  repository_owner: string;
  ref: string;
  ref_type: string;
  event_name: string;
  environment?: string;
  workflow_ref: string;
}

export interface TokenScenario {
  id: string;
  label: L;
  /** Who would hold this token in the story. */
  mine: boolean;
  claims: Claims;
}

const wf = (repo: string, ref: string) => `${repo}/.github/workflows/deploy.yml@${ref}`;

function token(
  repo: string,
  sub: string,
  ref: string,
  event: string,
  extra: Partial<Claims> = {},
): Claims {
  return {
    iss: ISSUER,
    aud: "sts.amazonaws.com",
    sub,
    repository: repo,
    repository_owner: repo.split("/")[0],
    ref,
    ref_type: ref.startsWith("refs/tags/") ? "tag" : "branch",
    event_name: event,
    workflow_ref: wf(repo, ref),
    ...extra,
  };
}

/** Sample GitHub Actions OIDC tokens (claims only; formats from GitHub's OIDC reference). */
export const TOKENS: TokenScenario[] = [
  {
    id: "main",
    label: { en: "Push to main", ja: "main への push" },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org/infra:ref:refs/heads/main",
      "refs/heads/main",
      "push",
    ),
  },
  {
    id: "branch",
    label: { en: "Push to a feature branch", ja: "feature ブランチへの push" },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org/infra:ref:refs/heads/try-something",
      "refs/heads/try-something",
      "push",
    ),
  },
  {
    id: "pr",
    label: { en: "pull_request workflow", ja: "pull_request ワークフロー" },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org/infra:pull_request",
      "refs/pull/42/merge",
      "pull_request",
    ),
  },
  {
    id: "env",
    label: {
      en: "Job in environment production",
      ja: "environment: production のジョブ",
    },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org/infra:environment:production",
      "refs/heads/main",
      "push",
      { environment: "production" },
    ),
  },
  {
    id: "tag",
    label: { en: "Release tag v1.4.0", ja: "リリースタグ v1.4.0" },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org/infra:ref:refs/tags/v1.4.0",
      "refs/tags/v1.4.0",
      "push",
    ),
  },
  {
    id: "sibling",
    label: { en: "Another repo in your org", ja: "同じ org の別リポジトリ" },
    mine: false,
    claims: token(
      "example-org/sandbox",
      "repo:example-org/sandbox:ref:refs/heads/main",
      "refs/heads/main",
      "push",
    ),
  },
  {
    id: "stranger",
    label: { en: "A stranger's repo", ja: "赤の他人のリポジトリ" },
    mine: false,
    claims: token(
      "someone-else/infra",
      "repo:someone-else/infra:ref:refs/heads/main",
      "refs/heads/main",
      "push",
    ),
  },
  {
    id: "immutable",
    label: {
      en: "New repo, immutable subject (after 2026-07-15)",
      ja: "新しいリポジトリ (2026-07-15 以降の immutable subject)",
    },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org@1234567/infra@7654321:ref:refs/heads/main",
      "refs/heads/main",
      "push",
    ),
  },
  {
    id: "aud",
    label: {
      en: "Token with GitHub's default audience",
      ja: "aud が GitHub 既定値のトークン",
    },
    mine: true,
    claims: token(
      "example-org/infra",
      "repo:example-org/infra:ref:refs/heads/main",
      "refs/heads/main",
      "push",
      { aud: "https://github.com/example-org" },
    ),
  },
];

export type Operator = "StringEquals" | "StringLike";

export interface TrustCondition {
  /** Check `token.actions.githubusercontent.com:aud` = sts.amazonaws.com. */
  audCheck: boolean;
  /** `null` = no `:sub` condition at all. */
  sub: { op: Operator; value: string } | null;
}

export interface PolicyPreset {
  id: string;
  label: L;
  cond: TrustCondition;
}

export const PRESETS: PolicyPreset[] = [
  {
    id: "exact",
    label: { en: "One repo, main only", ja: "1 リポジトリの main だけ" },
    cond: {
      audCheck: true,
      sub: { op: "StringEquals", value: "repo:example-org/infra:ref:refs/heads/main" },
    },
  },
  {
    id: "env",
    label: {
      en: "One repo, production environment",
      ja: "1 リポジトリの production 環境",
    },
    cond: {
      audCheck: true,
      sub: { op: "StringEquals", value: "repo:example-org/infra:environment:production" },
    },
  },
  {
    id: "repo",
    label: { en: "One repo, anything", ja: "1 リポジトリなら何でも" },
    cond: {
      audCheck: true,
      sub: { op: "StringLike", value: "repo:example-org/infra:*" },
    },
  },
  {
    id: "org",
    label: { en: "Whole org", ja: "org 全体" },
    cond: { audCheck: true, sub: { op: "StringLike", value: "repo:example-org/*" } },
  },
  {
    id: "anyone",
    label: { en: "repo:*", ja: "repo:*" },
    cond: { audCheck: true, sub: { op: "StringLike", value: "repo:*" } },
  },
  {
    id: "nosub",
    label: { en: "No sub condition", ja: "sub 条件なし" },
    cond: { audCheck: true, sub: null },
  },
];

export type Verdict =
  /** IAM refuses to save the trust policy at all. */
  | "rejected-save"
  /** STS rejects the token before the trust policy is evaluated. */
  | "bad-token"
  | "allowed"
  | "denied";

export interface OidcResult {
  verdict: Verdict;
  audOk: boolean;
  subOk: boolean | null;
  /** The condition also admits a repository outside example-org. */
  worldOpen: boolean;
  why: L;
}

/** Canary tokens used to judge how wide a sub condition really is. */
const FOREIGN_SUBS = [
  "repo:someone-else/infra:ref:refs/heads/main",
  "repo:attacker/anything:pull_request",
  "repo:example-org-evil/infra:ref:refs/heads/main",
];

export function subMatches(cond: TrustCondition["sub"], sub: string): boolean {
  if (!cond) return true;
  return cond.op === "StringEquals" ? cond.value === sub : stringLike(cond.value, sub);
}

export function evaluateOidc(cond: TrustCondition, claims: Claims): OidcResult {
  const worldOpen = FOREIGN_SUBS.some((s) => subMatches(cond.sub, s));

  if (!cond.sub || isOnlyWildcards(cond.sub.value)) {
    return {
      verdict: "rejected-save",
      audOk: true,
      subOk: null,
      worldOpen: true,
      why: {
        en: "IAM refuses to save this trust policy. When the principal is GitHub's OIDC provider, IAM checks on create and update that `token.actions.githubusercontent.com:sub` is present and is not only a wildcard or empty, because otherwise any GitHub workflow anywhere could assume the role.",
        ja: "IAM がこの信頼ポリシーの保存を拒否します。プリンシパルが GitHub の OIDC プロバイダーの場合、IAM は作成・更新時に `token.actions.githubusercontent.com:sub` が存在し、ワイルドカードだけ・空ではないことを検査します。これがないと世界中の GitHub ワークフローがロールを引き受けられてしまうからです。",
      },
    };
  }

  const audOk = PROVIDER_AUDIENCES.includes(claims.aud);
  if (!audOk) {
    return {
      verdict: "bad-token",
      audOk,
      subOk: null,
      worldOpen,
      why: {
        en: "STS rejects the token (`InvalidIdentityToken`, incorrect token audience): its `aud` is not in the IAM OIDC provider's client ID list. Set the audience to `sts.amazonaws.com` (aws-actions/configure-aws-credentials does this by default).",
        ja: "STS がトークンを拒否します (`InvalidIdentityToken`、audience 不一致)。`aud` が IAM OIDC プロバイダーのクライアント ID リストにありません。audience を `sts.amazonaws.com` にしてください (aws-actions/configure-aws-credentials は既定でそうします)。",
      },
    };
  }

  const subOk = subMatches(cond.sub, claims.sub);
  if (!subOk) {
    const immutable = claims.sub.includes("@");
    return {
      verdict: "denied",
      audOk,
      subOk,
      worldOpen,
      why: immutable
        ? {
            en: "Denied: `Not authorized to perform sts:AssumeRoleWithWebIdentity`. Repositories created, renamed or transferred after 2026-07-15 send `repo:OWNER@OWNER_ID/REPO@REPO_ID:...`, so a name-only sub pattern stops matching. Add the ID form to the condition.",
            ja: "拒否: `Not authorized to perform sts:AssumeRoleWithWebIdentity`。2026-07-15 以降に作成・リネーム・移管されたリポジトリは `repo:OWNER@OWNER_ID/REPO@REPO_ID:...` を送るため、名前だけの sub パターンには一致しなくなります。ID 付きの形を条件に追加してください。",
          }
        : {
            en: "Denied: the token's `sub` does not satisfy the trust policy condition, so STS returns AccessDenied (`Not authorized to perform sts:AssumeRoleWithWebIdentity`).",
            ja: "拒否: トークンの `sub` が信頼ポリシーの条件を満たさないので、STS は AccessDenied (`Not authorized to perform sts:AssumeRoleWithWebIdentity`) を返します。",
          },
    };
  }

  return {
    verdict: "allowed",
    audOk,
    subOk,
    worldOpen,
    why: worldOpen
      ? {
          en: "Allowed, but this condition also matches repositories outside your organization. IAM accepted it because the value is not only a wildcard, yet any GitHub user can create a repo whose `sub` matches it.",
          ja: "許可。ただしこの条件は自分の org 以外のリポジトリにも一致します。値がワイルドカードだけではないので IAM は保存を受け付けますが、どの GitHub ユーザーでも一致する `sub` のリポジトリを作れてしまいます。",
        }
      : {
          en: "Allowed: `aud` is on the provider's list and `sub` matches the condition. STS returns credentials for the role.",
          ja: "許可: `aud` がプロバイダーのリストにあり、`sub` も条件に一致。STS はロールの認証情報を返します。",
        },
  };
}

/** Trust policy JSON for the current condition, as IAM would store it. */
export function policyJson(cond: TrustCondition): string {
  const condition: Record<string, Record<string, string>> = {};
  if (cond.audCheck)
    condition.StringEquals = { [`${PROVIDER_KEY}:aud`]: "sts.amazonaws.com" };
  if (cond.sub) {
    condition[cond.sub.op] = {
      ...(condition[cond.sub.op] ?? {}),
      [`${PROVIDER_KEY}:sub`]: cond.sub.value,
    };
  }
  const stmt: Record<string, unknown> = {
    Effect: "Allow",
    Principal: {
      Federated: `arn:aws:iam::111122223333:oidc-provider/${PROVIDER_KEY}`,
    },
    Action: "sts:AssumeRoleWithWebIdentity",
  };
  if (Object.keys(condition).length) stmt.Condition = condition;
  return JSON.stringify({ Version: "2012-10-17", Statement: [stmt] }, null, 2);
}
