import type { L } from "@/i18n/lang";

export type Category = "api" | "endpoints" | "federation" | "policy" | "limits";

export interface TimelineEvent {
  /** YYYY-MM or YYYY-MM-DD. */
  date: string;
  category: Category;
  title: L;
  detail: L;
  source?: string;
  /** The date or the fact could not be tied to an official AWS source. */
  unverified?: boolean;
}

/** Chapter each category is explained in, unless an event overrides it. */
const CATEGORY_CHAPTER: Record<Category, string> = {
  api: "api",
  endpoints: "endpoints",
  federation: "paths",
  policy: "sessions",
  limits: "sessions",
};

/** Events explained somewhere other than their category's chapter, keyed by English title. */
const CHAPTER_OVERRIDE: Record<string, string> = {
  "GitHub OIDC without thumbprints": "trust",
  "OIDC thumbprints optional": "trust",
  "RCPs cover STS": "trust",
  "Provider-specific OIDC claims": "trust",
  "STS over PrivateLink": "endpoints",
};

/** Chapter id (without #) that explains this event. */
export function chapterOf(e: TimelineEvent): string {
  return CHAPTER_OVERRIDE[e.title.en] ?? CATEGORY_CHAPTER[e.category];
}

export const CATEGORIES: { id: Category; label: L; color: string }[] = [
  { id: "api", label: { en: "APIs", ja: "API" }, color: "var(--sts)" },
  {
    id: "endpoints",
    label: { en: "Endpoints", ja: "エンドポイント" },
    color: "var(--role)",
  },
  {
    id: "federation",
    label: { en: "Federation", ja: "フェデレーション" },
    color: "var(--idp)",
  },
  { id: "policy", label: { en: "Policy", ja: "ポリシー" }, color: "var(--resource)" },
  { id: "limits", label: { en: "Limits", ja: "上限" }, color: "var(--caller)" },
];

/** From docs/07-timeline.md, in date order. */
export const EVENTS: TimelineEvent[] = [
  {
    date: "2011-08",
    category: "endpoints",
    title: { en: "STS launches", ja: "STS 登場" },
    detail: {
      en: "One global endpoint, `sts.amazonaws.com`, hosted in US East (N. Virginia). The API version string `2011-06-15` is still used by every operation today.",
      ja: "グローバルエンドポイント `sts.amazonaws.com` が 1 つだけ、米国東部 (バージニア北部) で動いていました。API バージョン `2011-06-15` は今も全操作で使われています。",
    },
    source:
      "https://aws.amazon.com/blogs/security/announcing-upcoming-changes-to-the-aws-security-token-service-global-endpoint/",
  },
  {
    date: "2011-08",
    category: "api",
    title: {
      en: "GetSessionToken and GetFederationToken at launch",
      ja: "最初の API は GetSessionToken と GetFederationToken",
    },
    detail: {
      en: 'The launch post names GetFederationToken as "one of two functions" but not the other; GetSessionToken as the second is likely but unconfirmed.',
      ja: "ローンチ時のブログは GetFederationToken を「2 つの機能のうちの 1 つ」と書いていますが、もう 1 つの名前は出していません。GetSessionToken である可能性は高いものの、確認できていません。",
    },
    unverified: true,
  },
  {
    date: "2012-06-11",
    category: "federation",
    title: { en: "IAM roles for EC2 instances", ja: "EC2 インスタンス用の IAM ロール" },
    detail: {
      en: "Instance profiles: EC2 assumes the role for you and serves the keys from instance metadata.",
      ja: "インスタンスプロファイルの登場です。EC2 がロールを引き受け、キーをインスタンスメタデータから配ります。",
    },
    source:
      "https://aws.amazon.com/blogs/aws/iam-roles-for-ec2-instances-simplified-secure-access-to-aws-service-apis-from-ec2/",
  },
  {
    date: "2012-11-19",
    category: "api",
    title: {
      en: "AssumeRole: cross-account roles",
      ja: "AssumeRole: クロスアカウントロール",
    },
    detail: {
      en: "Delegate access between accounts without sharing long-term keys. Roles become the cross-account primitive.",
      ja: "長期キーを共有せずに、アカウント間でアクセスを委任できるようになりました。以後、クロスアカウントの基本単位はロールです。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2012/11/19/Announcing-Cross-Account-API-Access-Using-IAM-Roles/",
  },
  {
    date: "2013-05-28",
    category: "federation",
    title: { en: "AssumeRoleWithWebIdentity", ja: "AssumeRoleWithWebIdentity" },
    detail: {
      en: "Web identity federation for Login with Amazon, Facebook and Google.",
      ja: "Login with Amazon、Facebook、Google の ID でロールを引き受けられるようになりました。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2013/05/28/announcing-iam-web-identity-federation/",
  },
  {
    date: "2013-11-11",
    category: "federation",
    title: { en: "AssumeRoleWithSAML", ja: "AssumeRoleWithSAML" },
    detail: {
      en: "SAML 2.0 providers and the `https://signin.aws.amazon.com/saml` sign-in endpoint for enterprise SSO.",
      ja: "SAML 2.0 プロバイダと、企業 SSO 用のサインインエンドポイント `https://signin.aws.amazon.com/saml` が加わりました。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2013/11/11/aws-identity-and-access-management-iam-adds-support-for-saml-security-assertion-markup-language-2-0/",
  },
  {
    date: "2015-02-17",
    category: "endpoints",
    title: { en: "Regional STS endpoints", ja: "リージョナルエンドポイント" },
    detail: {
      en: "STS becomes available in every Region. Regional endpoints are activated per account; us-east-1 is always on.",
      ja: "全リージョンで STS を呼べるようになりました。リージョナルエンドポイントはアカウントごとに有効化し、us-east-1 だけは常に有効です。",
    },
    source:
      "https://aws.amazon.com/blogs/security/aws-security-token-service-is-now-available-in-every-aws-region/",
  },
  {
    date: "2016-04-05",
    category: "api",
    title: { en: "GetCallerIdentity appears", ja: "GetCallerIdentity 登場" },
    detail: {
      en: "SDK support lands (botocore 1.4.9). AWS made no announcement.",
      ja: "SDK が対応しました (botocore 1.4.9)。AWS からの告知はありません。",
    },
    source: "https://github.com/boto/botocore/blob/develop/CHANGELOG.rst",
  },
  {
    date: "2018-03",
    category: "limits",
    title: { en: "Role sessions up to 12 hours", ja: "ロールセッションが最大 12 時間に" },
    detail: {
      en: "`MaxSessionDuration` on a role can be set from 1 to 12 hours.",
      ja: "ロールの `MaxSessionDuration` を 1〜12 時間で設定できるようになりました。",
    },
    source: "https://aws.amazon.com/about-aws/whats-new/2018/03/longer-role-sessions/",
  },
  {
    date: "2018-07-31",
    category: "endpoints",
    title: { en: "STS over PrivateLink", ja: "PrivateLink 経由の STS" },
    detail: {
      en: "Interface VPC endpoints for STS, starting in US West (Oregon).",
      ja: "STS のインターフェイス VPC エンドポイントが、米国西部 (オレゴン) から提供開始されました。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2018/07/aws-sts-support-for-privatelink-us-west-2/",
  },
  {
    date: "2019-04-26",
    category: "endpoints",
    title: {
      en: "v1 and v2 global-endpoint tokens",
      ja: "グローバルエンドポイントの v1/v2 トークン",
    },
    detail: {
      en: "`SetSecurityTokenServicePreferences` lets global-endpoint tokens work in opt-in Regions. The date is when it entered the SDK models; AWS made no announcement.",
      ja: "`SetSecurityTokenServicePreferences` で、グローバルエンドポイントのトークンをオプトインリージョンでも使えるようになりました。日付は SDK のモデルに入った日で、AWS からの告知はありません。",
    },
    source: "https://github.com/boto/botocore/commit/088f3c8cc9",
  },
  {
    date: "2019-07-24",
    category: "api",
    title: { en: "GetAccessKeyInfo appears", ja: "GetAccessKeyInfo 登場" },
    detail: {
      en: "Look up the account that owns an access key ID. Added to the SDK models; AWS made no announcement.",
      ja: "アクセスキー ID の持ち主のアカウントを調べる API です。SDK のモデルに追加されたもので、AWS からの告知はありません。",
    },
    source: "https://github.com/boto/botocore/blob/develop/CHANGELOG.rst",
  },
  {
    date: "2019-09-04",
    category: "federation",
    title: { en: "EKS IRSA", ja: "EKS IRSA" },
    detail: {
      en: "IAM roles for Kubernetes service accounts: pods call `AssumeRoleWithWebIdentity` with a projected token.",
      ja: "Kubernetes のサービスアカウントに IAM ロールを割り当てる仕組みです。Pod が投影トークンで `AssumeRoleWithWebIdentity` を呼びます。",
    },
    source:
      "https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/",
  },
  {
    date: "2019-11",
    category: "policy",
    title: { en: "Session tags", ja: "セッションタグ" },
    detail: {
      en: "`sts:TagSession`, transitive tags and up to 50 tags per session, for ABAC from IdP attributes.",
      ja: "`sts:TagSession`、推移タグ、セッションあたり最大 50 個のタグが入り、IdP の属性で ABAC ができるようになりました。",
    },
    source:
      "https://aws.amazon.com/blogs/aws/new-for-identity-federation-use-employee-attributes-for-access-control-in-aws/",
  },
  {
    date: "2021-04-13",
    category: "policy",
    title: { en: "Source identity", ja: "ソースアイデンティティ" },
    detail: {
      en: "`sts:SetSourceIdentity`: an immutable value that survives role chaining and shows up in CloudTrail.",
      ja: "`sts:SetSourceIdentity` が登場しました。ロールチェーンを通しても変わらず、CloudTrail に残る値です。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2021/04/aws-identity-and-access-management-now-makes-it-easier-to-relate-a-users-iam-role-activity-to-their-corporate-identity/",
  },
  {
    date: "2022-07",
    category: "endpoints",
    title: {
      en: "New SDK majors default to Regional",
      ja: "新しい SDK メジャーバージョンはリージョナルが既定に",
    },
    detail: {
      en: "SDK major versions released after July 2022 default to Regional STS endpoints. boto3 and CLI v1 kept the global default until 2025.",
      ja: "2022 年 7 月以降の SDK メジャーバージョンはリージョナルエンドポイントが既定です。boto3 と CLI v1 は 2025 年までグローバルのままでした。",
    },
    source:
      "https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html",
  },
  {
    date: "2022-07-06",
    category: "federation",
    title: { en: "IAM Roles Anywhere", ja: "IAM Roles Anywhere" },
    detail: {
      en: "Workloads outside AWS trade X.509 certificates for role sessions.",
      ja: "AWS 外のワークロードが、X.509 証明書と引き換えにロールセッションを得られるようになりました。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2022/07/aws-identity-access-management-iam-roles-anywhere-workloads-outside-aws/",
  },
  {
    date: "2023-07",
    category: "federation",
    title: {
      en: "GitHub OIDC without thumbprints",
      ja: "GitHub OIDC のサムプリント不要化",
    },
    detail: {
      en: "AWS verifies GitHub's OIDC provider through its trusted root CAs instead of the configured thumbprint.",
      ja: "AWS は GitHub の OIDC プロバイダを、設定されたサムプリントではなく信頼済みルート CA で検証するようになりました。",
    },
    source:
      "https://github.blog/changelog/2023-07-13-github-actions-oidc-integration-with-aws-no-longer-requires-pinning-of-intermediate-tls-certificates/",
  },
  {
    date: "2023-11",
    category: "federation",
    title: { en: "EKS Pod Identity", ja: "EKS Pod Identity" },
    detail: {
      en: "Pod credentials with session tags for cluster, namespace and service account; no per-cluster OIDC provider.",
      ja: "クラスタ、名前空間、サービスアカウントのセッションタグ付きで Pod に認証情報を渡します。クラスタごとの OIDC プロバイダは要りません。",
    },
    source: "https://aws.amazon.com/about-aws/whats-new/2023/11/amazon-eks-pod-identity/",
  },
  {
    date: "2024-07-12",
    category: "federation",
    title: { en: "OIDC thumbprints optional", ja: "OIDC サムプリントが原則不要に" },
    detail: {
      en: "IAM trusts the root CA behind the IdP's TLS certificate; thumbprints only matter for uncommon or self-signed CAs.",
      ja: "IAM は IdP の TLS 証明書のルート CA を信頼します。サムプリントが効くのは、珍しい CA や自己署名の場合だけです。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2024/07/aws-identity-access-management-open-id-connect-identity-providers",
  },
  {
    date: "2024-11-13",
    category: "policy",
    title: { en: "RCPs cover STS", ja: "RCP が STS に対応" },
    detail: {
      en: "Resource control policies launch with STS among the first services: org-wide guardrails on `sts:AssumeRole*`.",
      ja: "リソースコントロールポリシーが STS 対応で登場し、`sts:AssumeRole*` に組織全体のガードレールをかけられるようになりました。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2024/11/resource-control-policies-restrict-access-aws-resources/",
  },
  {
    date: "2024-11-15",
    category: "api",
    title: { en: "AssumeRoot", ja: "AssumeRoot" },
    detail: {
      en: "Root sessions in member accounts, scoped to one of five task policies, at most 15 minutes, Regional endpoints only.",
      ja: "メンバーアカウントのルートとしてのセッションです。5 つのタスクポリシーのどれかに限られ、最大 15 分、リージョナルエンドポイントのみです。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2024/11/manage-root-access-aws-identity-access-management/",
  },
  {
    date: "2025-01-27",
    category: "endpoints",
    title: {
      en: "Global endpoint change announced",
      ja: "グローバルエンドポイントの変更を告知",
    },
    detail: {
      en: "`sts.amazonaws.com` will be served in the caller's Region, starting with Europe (Stockholm).",
      ja: "`sts.amazonaws.com` を呼び出し元のリージョンで処理する方針が発表されました。最初は欧州 (ストックホルム) からです。",
    },
    source:
      "https://aws.amazon.com/blogs/security/announcing-upcoming-changes-to-the-aws-security-token-service-global-endpoint/",
  },
  {
    date: "2025-04-18",
    category: "endpoints",
    title: {
      en: "The global endpoint goes local",
      ja: "グローバルエンドポイントがローカル処理に",
    },
    detail: {
      en: "Requests from default-enabled Regions that resolve through Amazon VPC DNS are served in-Region. CloudTrail still logs them in us-east-1.",
      ja: "Amazon VPC DNS で名前解決したデフォルト有効リージョンからのリクエストは、そのリージョンで処理されます。CloudTrail の記録先は us-east-1 のままです。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2025/04/aws-sts-global-endpoint-requests-locally-regions-default/",
  },
  {
    date: "2025-07-31",
    category: "endpoints",
    title: {
      en: "Remaining SDKs and CLI v1 default to Regional",
      ja: "残りの SDK と CLI v1 がリージョナル既定に",
    },
    detail: {
      en: "Python (boto3 1.40.0), CLI v1 1.42.0, PHP, C++, .NET and PowerShell switch their default to Regional endpoints.",
      ja: "Python (boto3 1.40.0)、CLI v1 1.42.0、PHP、C++、.NET、PowerShell が既定をリージョナルに切り替えました。",
    },
    source:
      "https://aws.amazon.com/blogs/developer/updating-aws-sdk-defaults-aws-sts-service-endpoint-and-retry-strategy/",
  },
  {
    date: "2025-11",
    category: "endpoints",
    title: {
      en: "Dual-stack (IPv6) endpoints",
      ja: "デュアルスタック (IPv6) エンドポイント",
    },
    detail: {
      en: "`sts.<region>.api.aws`, public and over PrivateLink. The global endpoint stays IPv4-only.",
      ja: "`sts.<region>.api.aws` がパブリックと PrivateLink の両方で使えます。グローバルエンドポイントは IPv4 のみのままです。",
    },
    source: "https://aws.amazon.com/about-aws/whats-new/2025/11/aws-sts-ipv6/",
  },
  {
    date: "2025-11",
    category: "api",
    title: { en: "GetWebIdentityToken", ja: "GetWebIdentityToken" },
    detail: {
      en: "Outbound identity federation: STS signs a JWT (RS256 or ES384, 60 to 3,600 s) for services outside AWS.",
      ja: "アウトバウンド ID フェデレーションです。STS が AWS 外のサービス向けに JWT (RS256 か ES384、60〜3,600 秒) を署名します。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/",
  },
  {
    date: "2025-11",
    category: "api",
    title: { en: "GetDelegatedAccessToken", ja: "GetDelegatedAccessToken" },
    detail: {
      en: "IAM temporary delegation: onboarded partners redeem a customer-approved trade-in token for credentials.",
      ja: "IAM の一時委任です。オンボード済みのパートナーが、顧客の承認したトレードイントークンを認証情報に交換します。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2025/11/streamline-integration-partner-products-iam-delegation/",
  },
  {
    date: "2026-02-02",
    category: "policy",
    title: { en: "Provider-specific OIDC claims", ja: "IdP 固有の OIDC クレーム" },
    detail: {
      en: "Claims from GitHub, Google, CircleCI and OCI usable as condition keys, e.g. `token.actions.githubusercontent.com:repository_id`.",
      ja: "GitHub、Google、CircleCI、OCI のクレームを条件キーに使えるようになりました。例: `token.actions.githubusercontent.com:repository_id`。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/",
  },
  {
    date: "2026-08",
    category: "federation",
    title: {
      en: "Outbound federation in the EU Sovereign Cloud",
      ja: "European Sovereign Cloudでアウトバウンドフェデレーション",
    },
    detail: {
      en: "`GetWebIdentityToken` becomes available in the AWS European Sovereign Cloud.",
      ja: "AWS European Sovereign Cloud でも `GetWebIdentityToken` が使えるようになりました。",
    },
    source:
      "https://aws.amazon.com/about-aws/whats-new/2026/08/aws-iam-european-sovereign-cloud/",
  },
  {
    date: "2026-09",
    category: "limits",
    title: {
      en: "One 4,096-byte token limit",
      ja: "トークン上限を 4,096 バイトに一本化",
    },
    detail: {
      en: "`SessionTokenSize` and `SessionTokenUtilization` in responses, `PackedPolicySize` deprecated, CloudWatch `AWS/STS` metrics.",
      ja: "レスポンスに `SessionTokenSize` と `SessionTokenUtilization` が加わり、`PackedPolicySize` は非推奨になりました。CloudWatch には `AWS/STS` メトリクスが出ます。",
    },
    source: "https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/",
  },
  {
    date: "2026-09",
    category: "endpoints",
    title: {
      en: "VPC endpoints for OIDC discovery",
      ja: "OIDC ディスカバリ用 VPC エンドポイント",
    },
    detail: {
      en: "Private access to the outbound-federation discovery document and JWKS.",
      ja: "アウトバウンドフェデレーションのディスカバリ文書と JWKS に、プライベートにアクセスできるようになりました。",
    },
    source: "https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts-vpc-oidc/",
  },
];

/** Comparable key: missing month or day sorts as the start of the period. */
export function dateKey(d: string): string {
  const [y, m = "01", day = "01"] = d.split("-");
  return `${y}-${m}-${day}`;
}

export function isValidDate(d: string): boolean {
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d)) return false;
  const [y, m, day] = dateKey(d).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day
  );
}

/**
 * Pieces of a title between which a line break is allowed. Long camel-case API
 * names (AssumeRoleWithWebIdentity) may break at word boundaries instead of
 * mid-word; everything else is returned whole.
 */
export function softBreakPoints(title: string): string[] {
  if (!/^[A-Za-z]{17,}$/.test(title)) return [title];
  return title.split(/(?<=[a-z])(?=[A-Z])/);
}
