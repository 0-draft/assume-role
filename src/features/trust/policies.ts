import type { L } from "@/i18n/lang";

export interface ExamplePolicy {
  id: string;
  label: L;
  note: L;
  json: string;
}

const doc = (statement: unknown) =>
  JSON.stringify({ Version: "2012-10-17", Statement: statement }, null, 2);

/** Trust policies adapted from the examples in docs/04-sessions-and-policies.md. */
export const EXAMPLES: ExamplePolicy[] = [
  {
    id: "mfa",
    label: {
      en: "Cross-account humans, MFA required",
      ja: "別アカウントの人間、MFA 必須",
    },
    note: {
      en: "Trusts account 444455556666 and requires an MFA sign-in within the last hour. That account must still grant sts:AssumeRole to its users. The MFA claim is only as strong as the trusted account: anyone there who can create virtual MFA devices can satisfy it.",
      ja: "アカウント 444455556666 を信頼し、1 時間以内の MFA 認証を要求します。相手側アカウントでもユーザーに sts:AssumeRole を許可する必要があります。MFA 条件がどこまで信用できるかは信頼先アカウント次第です。そこで仮想 MFA デバイスを作れる人なら条件を満たせてしまいます。",
    },
    json: doc([
      {
        Effect: "Allow",
        Principal: { AWS: "arn:aws:iam::444455556666:root" },
        Action: "sts:AssumeRole",
        Condition: {
          Bool: { "aws:MultiFactorAuthPresent": "true" },
          NumericLessThan: { "aws:MultiFactorAuthAge": "3600" },
        },
      },
    ]),
  },
  {
    id: "vendor",
    label: {
      en: "Third-party vendor with ExternalId",
      ja: "外部 ID 付きのサードパーティ",
    },
    note: {
      en: "Trusts one vendor role and requires the external ID the vendor issued to you. The ID is 2 to 1,224 characters.",
      ja: "ベンダーの 1 ロールだけを信頼し、ベンダーがあなたに発行した外部 ID を必須にします。外部 ID は 2〜1,224 文字です。",
    },
    json: doc([
      {
        Effect: "Allow",
        Principal: { AWS: "arn:aws:iam::999988887777:role/VendorScanner" },
        Action: "sts:AssumeRole",
        Condition: {
          StringEquals: { "sts:ExternalId": "c0b6f9d2-6a1e-4f7d-9a51-2b1d0e6c7a33" },
        },
      },
    ]),
  },
  {
    id: "github",
    label: { en: "GitHub Actions OIDC", ja: "GitHub Actions OIDC" },
    note: {
      en: "One repository, main branch only. Repositories created, renamed or transferred after 2026-07-15 send an ID-qualified sub (repo:OWNER@ID/REPO@ID:...), so list both forms while migrating.",
      ja: "1 リポジトリの main ブランチだけを許可します。2026-07-15 以降に作成・リネーム・移管されたリポジトリは ID 付きの sub (repo:OWNER@ID/REPO@ID:...) を送るので、移行期間中は両方の形を並べておきます。",
    },
    json: doc([
      {
        Effect: "Allow",
        Principal: {
          Federated:
            "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com",
        },
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": [
              "repo:example-org/infra:ref:refs/heads/main",
              "repo:example-org@1234567/infra@7654321:ref:refs/heads/main",
            ],
          },
        },
      },
    ]),
  },
  {
    id: "saml",
    label: {
      en: "SAML IdP with source identity and tags",
      ja: "ソースアイデンティティ とタグ付きの SAML IdP",
    },
    note: {
      en: "If the IdP sends a source identity or session tags, the trust policy must also allow sts:SetSourceIdentity and sts:TagSession, otherwise the whole AssumeRoleWithSAML call fails.",
      ja: "IdP が ソースアイデンティティ やセッションタグを送ってくるなら、信頼ポリシーで sts:SetSourceIdentity と sts:TagSession も許可しないと AssumeRoleWithSAML 自体が失敗します。",
    },
    json: doc([
      {
        Effect: "Allow",
        Principal: { Federated: "arn:aws:iam::111122223333:saml-provider/CorpIdP" },
        Action: ["sts:AssumeRoleWithSAML", "sts:SetSourceIdentity", "sts:TagSession"],
        Condition: {
          StringEquals: { "SAML:aud": "https://signin.aws.amazon.com/saml" },
          StringLike: { "sts:SourceIdentity": "*@example.com" },
        },
      },
    ]),
  },
  {
    id: "ec2",
    label: { en: "EC2 instance role", ja: "EC2 インスタンスロール" },
    note: {
      en: "A service principal. EC2 calls AssumeRole for you and hands the credentials to the instance through the instance metadata service.",
      ja: "サービスプリンシパルです。EC2 があなたの代わりに AssumeRole を呼び、インスタンスメタデータサービス経由でインスタンスに認証情報を渡します。",
    },
    json: doc([
      {
        Effect: "Allow",
        Principal: { Service: "ec2.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ]),
  },
  {
    id: "service",
    label: {
      en: "Service principal with confused-deputy guard",
      ja: "Confused Deputy 対策付きのサービスプリンシパル",
    },
    note: {
      en: "aws:SourceAccount and aws:SourceArn are evaluated independently; a request must satisfy both. Whether a given service sets them on sts:AssumeRole is service-specific, so check that service's docs.",
      ja: "aws:SourceAccount と aws:SourceArn は独立に評価され、両方を満たす必要があります。各サービスが sts:AssumeRole でこれらを設定するかはサービスごとに違うので、そのサービスのドキュメントを確認してください。",
    },
    json: doc([
      {
        Effect: "Allow",
        Principal: { Service: "logs.amazonaws.com" },
        Action: "sts:AssumeRole",
        Condition: {
          StringEquals: { "aws:SourceAccount": "111122223333" },
          ArnLike: {
            "aws:SourceArn": "arn:aws:logs:us-east-1:111122223333:log-group:*",
          },
        },
      },
    ]),
  },
];
