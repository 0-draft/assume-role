import type { L } from "@/i18n/lang";

/** Endpoint-related changes, from docs/02-endpoints.md "Timeline". */
export interface Change {
  date: string;
  title: L;
  href: string;
}

export const CHANGES: Change[] = [
  {
    date: "2015",
    title: {
      en: "STS available in every Region, with per-Region activation",
      ja: "全リージョンで STS が使えるように。リージョン単位で有効化",
    },
    href: "https://aws.amazon.com/blogs/security/aws-security-token-service-is-now-available-in-every-aws-region/",
  },
  {
    date: "2019-03-20",
    title: {
      en: "New Regions launch as opt-in (disabled by default)",
      ja: "以降の新リージョンはオプトイン (デフォルト無効) に",
    },
    href: "https://aws.amazon.com/blogs/security/setting-permissions-to-enable-accounts-for-upcoming-aws-regions/",
  },
  {
    date: "2022-07",
    title: {
      en: "Every new SDK major version defaults to Regional",
      ja: "新しい SDK メジャーバージョンはすべてリージョナルが既定に",
    },
    href: "https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html",
  },
  {
    date: "2025-01-27",
    title: {
      en: "AWS announces the global endpoint will be served locally",
      ja: "グローバルエンドポイントのローカル処理化を予告",
    },
    href: "https://aws.amazon.com/blogs/security/announcing-upcoming-changes-to-the-aws-security-token-service-global-endpoint/",
  },
  {
    date: "2025-04-18",
    title: {
      en: "Global endpoint served in the caller's Region (default-enabled Regions only)",
      ja: "グローバルエンドポイントが呼び出し元リージョンで処理されるように (デフォルト有効リージョンのみ)",
    },
    href: "https://aws.amazon.com/about-aws/whats-new/2025/04/aws-sts-global-endpoint-requests-locally-regions-default/",
  },
  {
    date: "2025-07-31",
    title: {
      en: "Boto3 1.40.0 and AWS CLI v1 1.42.0 switch their default to regional",
      ja: "Boto3 1.40.0 と AWS CLI v1 1.42.0 の既定が regional に",
    },
    href: "https://github.com/boto/boto3/issues/4583",
  },
  {
    date: "2025-11-19",
    title: {
      en: "Outbound identity federation: JWT issuers under tokens.sts.global.api.aws",
      ja: "アウトバウンド ID フェデレーション: 発行者は tokens.sts.global.api.aws 配下",
    },
    href: "https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/",
  },
  {
    date: "2025-11-21",
    title: {
      en: "Dual-stack (IPv6) endpoints: sts.<region>.api.aws",
      ja: "デュアルスタック (IPv6) エンドポイント sts.<region>.api.aws",
    },
    href: "https://aws.amazon.com/about-aws/whats-new/2025/11/aws-sts-ipv6/",
  },
  {
    date: "2026-01-15",
    title: {
      en: "European Sovereign Cloud (aws-eusc) generally available",
      ja: "European Sovereign Cloud (aws-eusc) が一般提供",
    },
    href: "https://aws.amazon.com/blogs/security/announcing-initial-services-available-in-the-aws-european-sovereign-cloud-backed-by-the-full-power-of-aws/",
  },
  {
    date: "2026-09-25",
    title: {
      en: "VPC endpoints for STS OIDC discovery: com.amazonaws.<region>.sts-oidc",
      ja: "STS OIDC ディスカバリ用 VPC エンドポイント com.amazonaws.<region>.sts-oidc",
    },
    href: "https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts-vpc-oidc/",
  },
];
