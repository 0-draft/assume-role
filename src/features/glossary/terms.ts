import type { L } from "@/i18n/lang";

export type ChapterId =
  "why" | "endpoints" | "api" | "paths" | "sessions" | "trust" | "ops" | "errors";

export interface Term {
  term: string;
  /** Extra strings the search box should match (Japanese reading, aliases). */
  aka?: string[];
  def: L;
  chapter: ChapterId;
}

/** Definitions follow docs/02 to docs/06. */
export const TERMS: Term[] = [
  {
    term: "STS (Security Token Service)",
    def: {
      en: "The AWS service that issues temporary credentials. Free to call; you pay only for what you do with the credentials.",
      ja: "一時認証情報を発行する AWS のサービス。呼び出しは無料で、課金されるのは認証情報を使った先のサービスだけ。",
    },
    chapter: "why",
  },
  {
    term: "Temporary security credentials",
    aka: ["一時認証情報"],
    def: {
      en: "An access key ID (`ASIA…`), a secret access key and a session token, valid until an expiration time. All three are needed to sign a request.",
      ja: "アクセスキー ID (`ASIA…`)・シークレットアクセスキー・セッショントークンの 3 点セット。期限まで有効で、署名には 3 つとも必要。",
    },
    chapter: "why",
  },
  {
    term: "AKIA / ASIA",
    aka: ["access key id", "アクセスキー"],
    def: {
      en: "Access key ID prefixes: `AKIA` is a long-term IAM user or root key, `ASIA` is a temporary key issued by STS.",
      ja: "アクセスキー ID の接頭辞。`AKIA` は IAM ユーザーやルートの長期キー、`ASIA` は STS が発行した一時キー。",
    },
    chapter: "api",
  },
  {
    term: "AROA",
    aka: ["unique id", "一意 ID"],
    def: {
      en: "Prefix of a role's unique ID. In `aws:userid` a role session appears as `AROA…:session-name`.",
      ja: "ロールの一意 ID の接頭辞。ロールセッションは `aws:userid` で `AROA…:セッション名` として現れる。",
    },
    chapter: "sessions",
  },
  {
    term: "Session token",
    aka: ["セッショントークン", "X-Amz-Security-Token"],
    def: {
      en: "The opaque third part of temporary credentials, sent as `X-Amz-Security-Token`. Since September 2026 it is at most 4,096 bytes.",
      ja: "一時認証情報の 3 つ目の不透明な値。`X-Amz-Security-Token` として送る。2026 年 9 月以降は最大 4,096 バイト。",
    },
    chapter: "why",
  },
  {
    term: "Role session",
    aka: ["assumed-role", "ロールセッション"],
    def: {
      en: "What you get when a principal assumes a role: credentials whose identity is `arn:aws:sts::ACCT:assumed-role/ROLE/SESSION`.",
      ja: "プリンシパルがロールを引き受けて得るもの。ID は `arn:aws:sts::ACCT:assumed-role/ROLE/SESSION`。",
    },
    chapter: "sessions",
  },
  {
    term: "RoleSessionName",
    def: {
      en: "The name you give a role session, 2 to 64 characters. It appears in the session ARN and in CloudTrail, and can be required with `sts:RoleSessionName`.",
      ja: "ロールセッションに付ける名前 (2〜64 文字)。セッション ARN と CloudTrail に出る。`sts:RoleSessionName` で必須化できる。",
    },
    chapter: "api",
  },
  {
    term: "Role chaining",
    aka: ["ロールチェーン"],
    def: {
      en: "Using a role session to assume another role. Chained sessions are capped at 1 hour, and asking for longer fails.",
      ja: "ロールセッションから別のロールを引き受けること。チェーンしたセッションは最大 1 時間で、それ以上を要求すると失敗する。",
    },
    chapter: "sessions",
  },
  {
    term: "MaxSessionDuration",
    def: {
      en: "Per-role setting from 1 to 12 hours that caps `DurationSeconds` on AssumeRole, AssumeRoleWithSAML and AssumeRoleWithWebIdentity.",
      ja: "ロールごとの設定 (1〜12 時間)。AssumeRole・AssumeRoleWithSAML・AssumeRoleWithWebIdentity の `DurationSeconds` の上限になる。",
    },
    chapter: "sessions",
  },
  {
    term: "Trust policy",
    aka: ["信頼ポリシー", "AssumeRolePolicyDocument"],
    def: {
      en: "The resource policy on a role that says who may assume it, with which `sts:` action and under which conditions.",
      ja: "ロールに付くリソースポリシー。誰が、どの `sts:` アクションで、どんな条件で引き受けられるかを書く。",
    },
    chapter: "trust",
  },
  {
    term: "Session policy",
    aka: ["セッションポリシー"],
    def: {
      en: "A policy passed at assume time (one inline plus up to 10 managed ARNs, 2,048 characters combined) that can only narrow the session's permissions.",
      ja: "引き受け時に渡すポリシー (インライン 1 つ + マネージド ARN 最大 10 個、合計 2,048 文字)。セッションの権限を絞ることしかできない。",
    },
    chapter: "sessions",
  },
  {
    term: "Permissions boundary",
    aka: ["アクセス許可の境界"],
    def: {
      en: "A managed policy attached to a user or role that sets the maximum permissions its identity policies can grant.",
      ja: "ユーザーやロールに付けるマネージドポリシー。ID ポリシーで与えられる権限の上限を決める。",
    },
    chapter: "sessions",
  },
  {
    term: "SCP (service control policy)",
    def: {
      en: "An Organizations policy that limits what principals in member accounts may do, including `sts:AssumeRole`. It cannot block `GetCallerIdentity`.",
      ja: "メンバーアカウントのプリンシパルができることを制限する Organizations のポリシー。`sts:AssumeRole` も対象。`GetCallerIdentity` は止められない。",
    },
    chapter: "ops",
  },
  {
    term: "RCP (resource control policy)",
    def: {
      en: "An Organizations policy on resources in member accounts. Since November 2024 it covers STS, so one RCP can stop roles being assumed from outside your org.",
      ja: "メンバーアカウントのリソースにかける Organizations のポリシー。2024 年 11 月から STS に対応し、組織外からのロール引き受けを 1 つの RCP で止められる。",
    },
    chapter: "ops",
  },
  {
    term: "Session tags",
    aka: ["セッションタグ", "sts:TagSession", "aws:PrincipalTag"],
    def: {
      en: "Key-value tags attached to a session (up to 50) that become `aws:PrincipalTag` for ABAC. Passing them needs `sts:TagSession`.",
      ja: "セッションに付けるキーと値 (最大 50 個)。ABAC 用の `aws:PrincipalTag` になる。渡すには `sts:TagSession` が必要。",
    },
    chapter: "sessions",
  },
  {
    term: "Transitive tags",
    aka: ["推移タグ", "TransitiveTagKeys"],
    def: {
      en: "Session tags marked to survive role chaining: they flow into every later session in the chain.",
      ja: "ロールチェーンを越えて引き継がれるよう指定したセッションタグ。チェーンの後続セッションすべてに伝わる。",
    },
    chapter: "sessions",
  },
  {
    term: "Source identity",
    aka: ["ソースアイデンティティ", "sts:SetSourceIdentity"],
    def: {
      en: "An immutable value (typically the human's username) set once at the start of a chain and logged in CloudTrail on every later call.",
      ja: "チェーンの最初に一度だけ設定する不変の値 (たいていは人のユーザー名)。以降の呼び出しすべてで CloudTrail に残る。",
    },
    chapter: "sessions",
  },
  {
    term: "ExternalId",
    aka: ["外部 ID", "sts:ExternalId"],
    def: {
      en: "A value a third party must pass when assuming your role, checked with `sts:ExternalId`. Not a secret; it stops the confused deputy problem.",
      ja: "第三者があなたのロールを引き受ける際に渡す値で、`sts:ExternalId` で検証する。秘密ではなく、混乱した代理問題を防ぐためのもの。",
    },
    chapter: "trust",
  },
  {
    term: "Confused deputy",
    aka: ["混乱した代理"],
    def: {
      en: "A trusted service being tricked into using its access on someone else's behalf. Prevented with `sts:ExternalId`, or `aws:SourceArn` and `aws:SourceAccount` for AWS services.",
      ja: "信頼されたサービスがだまされて、他人のために自分の権限を使ってしまう問題。`sts:ExternalId`、AWS サービスなら `aws:SourceArn` と `aws:SourceAccount` で防ぐ。",
    },
    chapter: "trust",
  },
  {
    term: "IMDSv2",
    aka: ["instance metadata", "インスタンスメタデータ"],
    def: {
      en: "EC2's instance metadata service with a session token (`PUT /latest/api/token`). It is where instance-profile credentials are picked up.",
      ja: "セッショントークン (`PUT /latest/api/token`) を使う EC2 のインスタンスメタデータサービス。インスタンスプロファイルの認証情報はここから取る。",
    },
    chapter: "paths",
  },
  {
    term: "IRSA",
    aka: ["IAM roles for service accounts"],
    def: {
      en: "EKS IAM roles for service accounts: the pod's SDK calls `AssumeRoleWithWebIdentity` with a projected Kubernetes token.",
      ja: "EKS のサービスアカウント用 IAM ロール。Pod の SDK が投影された Kubernetes トークンで `AssumeRoleWithWebIdentity` を呼ぶ。",
    },
    chapter: "paths",
  },
  {
    term: "EKS Pod Identity",
    def: {
      en: "An EKS agent that fetches pod credentials from `eks-auth`; EKS calls STS for you and adds session tags. The pod never calls STS itself.",
      ja: "`eks-auth` から Pod の認証情報を取ってくる EKS のエージェント。STS を呼ぶのは EKS で、セッションタグも付く。Pod 自身は STS を呼ばない。",
    },
    chapter: "paths",
  },
  {
    term: "IAM Roles Anywhere",
    def: {
      en: "Lets workloads outside AWS trade an X.509 certificate for role credentials through `rolesanywhere` CreateSession.",
      ja: "AWS 外のワークロードが X.509 証明書を `rolesanywhere` の CreateSession でロールの認証情報に交換する仕組み。",
    },
    chapter: "paths",
  },
  {
    term: "IAM Identity Center",
    aka: ["AWS SSO", "aws sso login"],
    def: {
      en: "AWS's workforce sign-in. Console access uses `AssumeRoleWithSAML` under the hood on `AWSReservedSSO_*` roles; the CLI uses `sso:GetRoleCredentials`.",
      ja: "AWS の社員向けサインイン。コンソールは裏で `AWSReservedSSO_*` ロールに `AssumeRoleWithSAML` を使い、CLI は `sso:GetRoleCredentials` を使う。",
    },
    chapter: "paths",
  },
  {
    term: "SAML assertion",
    aka: ["SAML アサーション"],
    def: {
      en: "A signed XML document from your IdP saying who the user is and which roles they may use. Passed unsigned to `AssumeRoleWithSAML`.",
      ja: "IdP が署名した XML 文書。ユーザーが誰で、どのロールを使えるかが書いてある。`AssumeRoleWithSAML` に署名なしで渡す。",
    },
    chapter: "paths",
  },
  {
    term: "OIDC provider (IAM)",
    aka: ["OIDC プロバイダ", "OpenID Connect"],
    def: {
      en: "An IAM object naming an issuer URL and allowed audiences. STS checks web identity tokens against it; thumbprints are only needed for uncommon CAs.",
      ja: "発行者 URL と許可する audience を登録する IAM のオブジェクト。STS は Web ID トークンをこれで検証する。サムプリントが必要なのは珍しい CA のときだけ。",
    },
    chapter: "trust",
  },
  {
    term: "Web identity token",
    aka: ["JWT", "ID トークン"],
    def: {
      en: "A JWT from an OIDC provider (GitHub, EKS, Google…) passed to `AssumeRoleWithWebIdentity`. Its `iss`, `aud` and `sub` are matched by the trust policy.",
      ja: "OIDC プロバイダ (GitHub、EKS、Google など) が発行する JWT。`AssumeRoleWithWebIdentity` に渡し、`iss`・`aud`・`sub` を信頼ポリシーで照合する。",
    },
    chapter: "trust",
  },
  {
    term: "Outbound identity federation",
    aka: ["GetWebIdentityToken", "アウトバウンドフェデレーション"],
    def: {
      en: "Since November 2025, STS can sign a JWT about your AWS principal for services outside AWS (`GetWebIdentityToken`). Regional endpoints only.",
      ja: "2025 年 11 月から、STS が AWS のプリンシパルについての JWT を AWS 外のサービス向けに署名できる (`GetWebIdentityToken`)。リージョナルエンドポイントのみ。",
    },
    chapter: "api",
  },
  {
    term: "AssumeRoot",
    def: {
      en: "Gives the management account a root session in a member account for one of five tasks, for at most 15 minutes. Regional endpoints only.",
      ja: "管理アカウントが、メンバーアカウントのルートセッションを 5 つのタスクのどれか 1 つのために最大 15 分だけ得る。リージョナルエンドポイントのみ。",
    },
    chapter: "api",
  },
  {
    term: "Global endpoint",
    aka: ["sts.amazonaws.com", "グローバルエンドポイント"],
    def: {
      en: "`sts.amazonaws.com`. Since April 2025 it is served in the caller's Region for default-enabled Regions using Amazon DNS; otherwise us-east-1. Always logged in us-east-1.",
      ja: "`sts.amazonaws.com`。2025 年 4 月以降、Amazon DNS を使うデフォルト有効リージョンからは呼び出し元リージョンで処理され、それ以外は us-east-1。記録先は常に us-east-1。",
    },
    chapter: "endpoints",
  },
  {
    term: "Regional endpoint",
    aka: ["リージョナルエンドポイント"],
    def: {
      en: "`sts.<region>.amazonaws.com`. AWS's recommended choice: lower latency, fault isolation, and tokens valid in every Region.",
      ja: "`sts.<region>.amazonaws.com`。AWS 推奨。低レイテンシ、障害の分離、全リージョンで有効なトークン。",
    },
    chapter: "endpoints",
  },
  {
    term: "Opt-in Region",
    aka: ["オプトインリージョン"],
    def: {
      en: "A Region disabled by default that an account must enable, such as ap-east-1. Version 1 global-endpoint tokens do not work there.",
      ja: "既定で無効でアカウントごとに有効化が必要なリージョン (ap-east-1 など)。グローバルエンドポイントの v1 トークンは通らない。",
    },
    chapter: "endpoints",
  },
  {
    term: "v1 / v2 session token",
    aka: ["v1Token", "v2Token", "GlobalEndpointTokenVersion"],
    def: {
      en: "Global-endpoint token versions. v1 is valid only in default-enabled Regions; v2 is valid everywhere but longer. Set with `SetSecurityTokenServicePreferences`.",
      ja: "グローバルエンドポイントのトークンの版。v1 はデフォルト有効リージョンだけ、v2 は全リージョンで有効だが長い。`SetSecurityTokenServicePreferences` で設定する。",
    },
    chapter: "endpoints",
  },
  {
    term: "sts_regional_endpoints",
    aka: ["AWS_STS_REGIONAL_ENDPOINTS"],
    def: {
      en: "SDK/CLI setting, `legacy` or `regional`. On 31 July 2025 the SDKs that still sent STS calls to the global endpoint by default (boto3, CLI v1, PHP, C++, .NET, PowerShell) switched to Regional.",
      ja: "SDK/CLI の設定で値は `legacy` か `regional`。2025 年 7 月 31 日、既定でまだグローバルエンドポイントに送っていた SDK (boto3、CLI v1、PHP、C++、.NET、PowerShell) がリージョナルに切り替わった。",
    },
    chapter: "endpoints",
  },
  {
    term: "FIPS endpoint",
    def: {
      en: "`sts-fips.<region>.amazonaws.com`, using FIPS 140 validated cryptography. Only in a handful of US and Canada Regions.",
      ja: "FIPS 140 検証済みの暗号を使う `sts-fips.<region>.amazonaws.com`。米国とカナダの一部リージョンのみ。",
    },
    chapter: "endpoints",
  },
  {
    term: "Dual-stack endpoint",
    aka: ["IPv6", "デュアルスタック"],
    def: {
      en: "`sts.<region>.api.aws`, reachable over IPv4 and IPv6 since November 2025. The global endpoint has no IPv6.",
      ja: "2025 年 11 月から IPv4 と IPv6 の両方で使える `sts.<region>.api.aws`。グローバルエンドポイントに IPv6 は無い。",
    },
    chapter: "endpoints",
  },
  {
    term: "PrivateLink (STS VPC endpoint)",
    aka: ["VPC endpoint", "VPC エンドポイント", "com.amazonaws.region.sts"],
    def: {
      en: "Interface VPC endpoint `com.amazonaws.<region>.sts`. Private DNS covers the Regional hostname only; the global endpoint bypasses it.",
      ja: "インターフェイス VPC エンドポイント `com.amazonaws.<region>.sts`。プライベート DNS が効くのはリージョナルのホスト名だけで、グローバルエンドポイントは素通りする。",
    },
    chapter: "endpoints",
  },
  {
    term: "SigV4",
    aka: ["Signature Version 4", "署名"],
    def: {
      en: "AWS's request-signing scheme. STS's signing name is `sts`; AssumeRoleWithSAML and AssumeRoleWithWebIdentity are called unsigned.",
      ja: "AWS のリクエスト署名方式。STS の署名名は `sts`。AssumeRoleWithSAML と AssumeRoleWithWebIdentity は署名なしで呼ぶ。",
    },
    chapter: "why",
  },
  {
    term: "Credential provider chain",
    aka: ["認証情報プロバイダチェーン"],
    def: {
      en: "The ordered list of places an SDK looks for credentials (environment, profile, web identity, SSO, container, IMDS). The first match wins.",
      ja: "SDK が認証情報を探す場所の順番 (環境変数、プロファイル、Web ID、SSO、コンテナ、IMDS)。最初に見つかったものが使われる。",
    },
    chapter: "paths",
  },
  {
    term: "SessionTokenUtilization",
    aka: ["PackedPolicySize", "SessionTokenSize"],
    def: {
      en: "Percentage of the 4,096-byte session token limit a session uses. Replaced the deprecated `PackedPolicySize` in September 2026.",
      ja: "セッションが 4,096 バイトのトークン上限の何 % を使っているか。2026 年 9 月に非推奨の `PackedPolicySize` を置き換えた。",
    },
    chapter: "sessions",
  },
  {
    term: "aws:TokenIssueTime",
    aka: ["Revoke active sessions", "セッション無効化"],
    def: {
      en: "When the session's credentials were issued. Revoking sessions works by denying everything issued before now.",
      ja: "セッションの認証情報が発行された時刻。セッションの無効化は、この時刻が今より前のものを全部拒否することで行う。",
    },
    chapter: "sessions",
  },
  {
    term: "GetCallerIdentity",
    aka: ["whoami"],
    def: {
      en: "Returns the account, ARN and user ID behind the signing credentials. Needs no permission and cannot be denied, but it is logged.",
      ja: "署名に使った認証情報のアカウント・ARN・ユーザー ID を返す。権限不要で拒否もできないが、ログには残る。",
    },
    chapter: "api",
  },
  {
    term: "CloudTrail sharedEventID",
    aka: ["CloudTrail"],
    def: {
      en: "A cross-account AssumeRole is logged twice, once in each account; both records carry the same `sharedEventID`.",
      ja: "クロスアカウントの AssumeRole は両方のアカウントに 1 件ずつ記録され、2 件とも同じ `sharedEventID` を持つ。",
    },
    chapter: "ops",
  },
  {
    term: "STS request quota",
    aka: ["throttling", "600 RPS", "クォータ"],
    def: {
      en: "600 requests per second per account per Region, shared by AssumeRole, GetCallerIdentity, GetSessionToken and others. Calls made by AWS services don't count.",
      ja: "アカウント・リージョンあたり毎秒 600 リクエスト。AssumeRole・GetCallerIdentity・GetSessionToken などで共有する。AWS サービスによる呼び出しは数えない。",
    },
    chapter: "ops",
  },
];

/** Case-insensitive search over the term, aliases and the definition in both languages. */
export function searchTerms(q: string, terms: Term[] = TERMS): Term[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return terms;
  return terms.filter((t) =>
    [t.term, ...(t.aka ?? []), t.def.en, t.def.ja].some((s) =>
      s.toLowerCase().includes(needle),
    ),
  );
}
