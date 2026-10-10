import type { L } from "@/i18n/lang";

/**
 * Every operation in the STS API Reference (11 as of 2026-10-10), with the
 * facts the chapter draws. Source: docs/03-api-operations.md, which cites the
 * API Reference page for each one. Values marked unverified there are either
 * left out here or labelled in the copy.
 */

export type OpId =
  | "AssumeRole"
  | "AssumeRoleWithSAML"
  | "AssumeRoleWithWebIdentity"
  | "AssumeRoot"
  | "GetSessionToken"
  | "GetFederationToken"
  | "GetDelegatedAccessToken"
  | "GetWebIdentityToken"
  | "GetCallerIdentity"
  | "GetAccessKeyInfo"
  | "DecodeAuthorizationMessage";

/** How the chapter groups the ticket windows. */
export type Family = "role" | "direct" | "out" | "intro";

export const FAMILIES: { id: Family; label: L; blurb: L; color: string }[] = [
  {
    id: "role",
    label: { en: "Credentials by becoming a role", ja: "ロールになって認証情報を得る" },
    blurb: {
      en: "You prove who you are, STS hands back keys for a role.",
      ja: "自分が誰かを証明すると、ロールのキーが返ってきます。",
    },
    color: "var(--role)",
  },
  {
    id: "direct",
    label: { en: "Credentials without a role", ja: "ロールを介さない認証情報" },
    blurb: {
      en: "Short-lived keys for an IAM user, a federated user, a member root, or a partner.",
      ja: "IAM ユーザー、フェデレーションユーザー、メンバーアカウントの root、パートナー向けの短期キーです。",
    },
    color: "var(--caller)",
  },
  {
    id: "out",
    label: { en: "Tokens going out of AWS", ja: "AWS の外へ出すトークン" },
    blurb: {
      en: "AWS acts as the identity provider and signs a JWT for someone else's API.",
      ja: "AWS が IdP 側に回り、外部サービス向けの JWT に署名します。",
    },
    color: "var(--idp)",
  },
  {
    id: "intro",
    label: { en: "Introspection", ja: "調べもの" },
    blurb: {
      en: "No credentials come out. These answer questions about ones you already have.",
      ja: "認証情報は出てきません。手元のキーやエラーについて答えるだけです。",
    },
    color: "var(--sts)",
  },
];

export type Auth = "sigv4" | "unsigned";

export interface Op {
  id: OpId;
  family: Family;
  auth: Auth;
  /** Not served by sts.amazonaws.com. */
  regionalOnly?: boolean;
  /** Launch year, shown only for operations added recently. */
  since?: number;
  /** Only onboarded AWS Partners can call it. */
  partnerOnly?: boolean;
  purpose: L;
  caller: L;
  duration: L;
  mfa: L;
  sessionPolicy: L;
  tags: L;
  returns: string[];
  /** What the resulting credentials cannot do. */
  restrictions?: L;
  cli: string;
  response: string;
  /** Caveat about the sample response, e.g. an unverified field. */
  responseNote?: L;
  ref: string;
  /** Short matrix cells. */
  matrix: {
    caller: L;
    temp: L;
    duration: L;
  };
}

const REF = "https://docs.aws.amazon.com/STS/latest/APIReference/API_";

const NO: L = { en: "No", ja: "なし" };
const NA: L = { en: "n/a", ja: "対象外" };

const SESSION_POLICY: L = {
  en: "Yes: 1 inline + up to 10 managed ARNs, 2,048 plaintext chars combined",
  ja: "あり: インライン 1 つ + 管理ポリシー ARN 最大 10 個、合計 2,048 文字まで",
};

export const OPS: Op[] = [
  {
    id: "AssumeRole",
    family: "role",
    auth: "sigv4",
    purpose: {
      en: "Get temporary credentials for an IAM role, in the same account or across accounts.",
      ja: "IAM ロールの一時認証情報を得ます。同一アカウントでもクロスアカウントでも使います。",
    },
    caller: {
      en: "An IAM user or a role session that already holds credentials. The role's trust policy must trust the caller; across accounts the caller's identity policy must also allow `sts:AssumeRole`.",
      ja: "すでに認証情報を持つ IAM ユーザーかロールセッションです。ロールの信頼ポリシーが呼び出し元を信頼している必要があり、クロスアカウントなら呼び出し元のアイデンティティポリシーでも `sts:AssumeRole` の許可が要ります。",
    },
    duration: {
      en: "900 s minimum, 3600 s default, up to the role's `MaxSessionDuration` (1 to 12 h). Role chaining, meaning a role session calling AssumeRole, is capped at 1 h and asking for more fails.",
      ja: "最短 900 秒、デフォルト 3600 秒、上限はロールの `MaxSessionDuration` (1〜12 時間)。ロールセッションから AssumeRole する「ロールチェーン」は 1 時間が上限で、それ以上を指定すると失敗します。",
    },
    mfa: {
      en: "Yes: pass `SerialNumber` and a 6-digit `TokenCode`.",
      ja: "あり: `SerialNumber` と 6 桁の `TokenCode` を渡します。",
    },
    sessionPolicy: SESSION_POLICY,
    tags: {
      en: "Yes: up to 50, and they can be transitive through role chaining.",
      ja: "あり: 最大 50 個。ロールチェーンに引き継ぐ (transitive) 指定もできます。",
    },
    returns: [
      "Credentials",
      "AssumedRoleUser",
      "SourceIdentity",
      "SessionTokenSize",
      "SessionTokenUtilization",
      "PackedPolicySize (deprecated)",
    ],
    restrictions: {
      en: "Can call any AWS service except STS `GetFederationToken` and `GetSessionToken`.",
      ja: "STS の `GetFederationToken` と `GetSessionToken` 以外なら、どの AWS サービスも呼べます。",
    },
    cli: `aws sts assume-role \\
  --role-arn arn:aws:iam::123456789012:role/demo \\
  --role-session-name alice-cli \\
  --duration-seconds 3600 \\
  --external-id 123ABC \\
  --source-identity alice \\
  --tags Key=Project,Value=Pegasus Key=Team,Value=Engineering \\
  --transitive-tag-keys Project \\
  --serial-number arn:aws:iam::123456789012:mfa/alice \\
  --token-code 123456`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW...",
    "Expiration": "2026-10-10T13:34:41+00:00"
  },
  "AssumedRoleUser": {
    "AssumedRoleId": "AROA123EXAMPLE123:alice-cli",
    "Arn": "arn:aws:sts::123456789012:assumed-role/demo/alice-cli"
  },
  "PackedPolicySize": 12,
  "SourceIdentity": "alice",
  "SessionTokenSize": 512,
  "SessionTokenUtilization": 12
}`,
    ref: `${REF}AssumeRole.html`,
    matrix: {
      caller: { en: "IAM user or role session", ja: "IAM ユーザー / ロールセッション" },
      temp: { en: "Yes (chaining caps at 1 h)", ja: "可 (チェーンは 1 時間まで)" },
      duration: {
        en: "15 min / 1 h / role max (≤12 h)",
        ja: "15 分 / 1 時間 / ロール上限 (≤12 時間)",
      },
    },
  },
  {
    id: "AssumeRoleWithSAML",
    family: "role",
    auth: "unsigned",
    purpose: {
      en: "Trade a SAML 2.0 response from your enterprise IdP for role credentials.",
      ja: "社内 IdP が出した SAML 2.0 レスポンスを、ロールの認証情報と交換します。",
    },
    caller: {
      en: "Anyone holding a SAML response from an IdP registered as an IAM SAML provider. No AWS credentials: STS checks the assertion against the provider's metadata. Not for IAM Identity Center roles (`AWSReservedSSO_*`).",
      ja: "IAM SAML プロバイダーに登録した IdP の SAML レスポンスを持っている人なら誰でも呼べます。AWS の認証情報は不要で、STS はプロバイダーのメタデータでアサーションを検証します。IAM Identity Center のロール (`AWSReservedSSO_*`) には使えません。",
    },
    duration: {
      en: "900 s minimum, 3600 s default, up to the role maximum, and never past the assertion's `SessionNotOnOrAfter`.",
      ja: "最短 900 秒、デフォルト 3600 秒、上限はロールの最大値。さらにアサーションの `SessionNotOnOrAfter` を超えられません。",
    },
    mfa: {
      en: "No MFA parameters. MFA is the IdP's job.",
      ja: "MFA のパラメータはありません。MFA は IdP 側で担います。",
    },
    sessionPolicy: SESSION_POLICY,
    tags: {
      en: "Yes, from attributes in the assertion (as are `RoleSessionName` and `SourceIdentity`).",
      ja: "あり。アサーションの属性から渡します (`RoleSessionName` や `SourceIdentity` も同様)。",
    },
    returns: [
      "Credentials",
      "AssumedRoleUser",
      "Issuer",
      "Audience",
      "Subject",
      "SubjectType",
      "NameQualifier",
      "SourceIdentity",
      "SessionTokenSize",
      "SessionTokenUtilization",
    ],
    restrictions: {
      en: "Can call any AWS service except STS `GetFederationToken` and `GetSessionToken`.",
      ja: "STS の `GetFederationToken` と `GetSessionToken` 以外なら、どの AWS サービスも呼べます。",
    },
    cli: `aws sts assume-role-with-saml \\
  --role-arn arn:aws:iam::123456789012:role/TestSaml \\
  --principal-arn arn:aws:iam::123456789012:saml-provider/SAML-test \\
  --saml-assertion file://samlresponse.b64 \\
  --duration-seconds 3600`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAV3ZUEFP6EXAMPLE",
    "SecretAccessKey": "8P+SQvWIuLnKhh8d++jpw0nNmQRBZvNEXAMPLEKEY",
    "SessionToken": "IQoJb3JpZ2luX2VjEOz////////////////////wEXAMPLEtMSJHMEUCIDoKK3JH9uG...",
    "Expiration": "2026-10-10T20:26:47+00:00"
  },
  "AssumedRoleUser": {
    "AssumedRoleId": "AROA456EXAMPLE789:alice@example.com",
    "Arn": "arn:aws:sts::123456789012:assumed-role/TestSaml/alice@example.com"
  },
  "Subject": "SamlExample",
  "SubjectType": "transient",
  "Issuer": "https://integ.example.com/idp/shibboleth",
  "Audience": "https://signin.aws.amazon.com/saml",
  "NameQualifier": "SbdGOnUkh1i4+EXAMPLExL/jEvs=",
  "SourceIdentity": "SourceIdentityValue",
  "PackedPolicySize": 6,
  "SessionTokenSize": 480,
  "SessionTokenUtilization": 12
}`,
    ref: `${REF}AssumeRoleWithSAML.html`,
    matrix: {
      caller: { en: "Holder of a SAML response", ja: "SAML レスポンスの保持者" },
      temp: NA,
      duration: {
        en: "15 min / 1 h / role max, capped by assertion",
        ja: "15 分 / 1 時間 / ロール上限 (アサーションで制限)",
      },
    },
  },
  {
    id: "AssumeRoleWithWebIdentity",
    family: "role",
    auth: "unsigned",
    purpose: {
      en: "Trade an OIDC ID token (GitHub Actions, EKS service accounts, Google, Cognito) for role credentials.",
      ja: "OIDC の ID トークン (GitHub Actions、EKS のサービスアカウント、Google、Cognito など) をロールの認証情報と交換します。",
    },
    caller: {
      en: "Anyone holding a token from an IdP the role's trust policy names. No AWS credentials required. Also accepts OAuth 2.0 access tokens from Login with Amazon and Facebook.",
      ja: "ロールの信頼ポリシーが名指しする IdP のトークンを持っていれば誰でも呼べます。AWS の認証情報は不要です。Login with Amazon と Facebook の OAuth 2.0 アクセストークンも受け付けます。",
    },
    duration: {
      en: "900 s minimum, 3600 s default, up to the role maximum (12 h at most).",
      ja: "最短 900 秒、デフォルト 3600 秒、上限はロールの最大値 (最大 12 時間)。",
    },
    mfa: { en: "No MFA parameters.", ja: "MFA パラメータなし。" },
    sessionPolicy: SESSION_POLICY,
    tags: {
      en: "Yes, from a claim in the token (as is `SourceIdentity`).",
      ja: "あり。トークンのクレームから渡します (`SourceIdentity` も同様)。",
    },
    returns: [
      "Credentials",
      "AssumedRoleUser",
      "SubjectFromWebIdentityToken",
      "Audience",
      "Provider",
      "SourceIdentity",
      "SessionTokenSize",
      "SessionTokenUtilization",
    ],
    restrictions: {
      en: "Can call any AWS service except STS `GetFederationToken` and `GetSessionToken`.",
      ja: "STS の `GetFederationToken` と `GetSessionToken` 以外なら、どの AWS サービスも呼べます。",
    },
    cli: `aws sts assume-role-with-web-identity \\
  --role-arn arn:aws:iam::123456789012:role/FederatedWebIdentityRole \\
  --role-session-name app1 \\
  --web-identity-token file://id_token.jwt \\
  --duration-seconds 3600`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoDYXdzEE0a8ANXXXXXXXXNO1ewxE5TijQyp+IEXAMPLE...",
    "Expiration": "2026-10-10T23:00:23+00:00"
  },
  "SubjectFromWebIdentityToken": "repo:example-org/example-repo:ref:refs/heads/main",
  "AssumedRoleUser": {
    "AssumedRoleId": "AROACLKWSDQRAOEXAMPLE:app1",
    "Arn": "arn:aws:sts::123456789012:assumed-role/FederatedWebIdentityRole/app1"
  },
  "Provider": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com",
  "Audience": "sts.amazonaws.com",
  "SourceIdentity": "SourceIdentityValue",
  "PackedPolicySize": 8,
  "SessionTokenSize": 470,
  "SessionTokenUtilization": 11
}`,
    responseNote: {
      en: "The `Provider` value is illustrative (unverified): the API Reference says it holds the token's `iss` for OIDC.",
      ja: "`Provider` の値は例示で、未検証です。API リファレンスによると、OIDC の場合はトークンの `iss` が入ります。",
    },
    ref: `${REF}AssumeRoleWithWebIdentity.html`,
    matrix: {
      caller: {
        en: "Holder of an OIDC / OAuth token",
        ja: "OIDC / OAuth トークンの保持者",
      },
      temp: NA,
      duration: {
        en: "15 min / 1 h / role max (≤12 h)",
        ja: "15 分 / 1 時間 / ロール上限 (≤12 時間)",
      },
    },
  },
  {
    id: "AssumeRoot",
    family: "direct",
    auth: "sigv4",
    regionalOnly: true,
    since: 2024,
    purpose: {
      en: "Get a 15-minute root session in an Organizations member account to do one privileged task, so the member account needs no root password.",
      ja: "Organizations のメンバーアカウントで、特権タスクを 1 つだけこなす 15 分間の root セッションを得ます。メンバー側に root パスワードを持たせずに済みます。",
    },
    caller: {
      en: "A principal in the management account or the IAM delegated administrator account, after centralized root access is enabled. Root itself cannot call it.",
      ja: "集中 root アクセスを有効化したうえで、管理アカウントか IAM の委任管理者アカウントのプリンシパルが呼びます。root 自身は呼べません。",
    },
    duration: {
      en: "Default and maximum are both 900 s (15 min). The API Reference lists the valid range as 0 to 900.",
      ja: "デフォルトも上限も 900 秒 (15 分) です。API リファレンス上の有効範囲は 0〜900 です。",
    },
    mfa: NO,
    sessionPolicy: {
      en: "Task policy only: `TaskPolicyArn` must be one of 5 AWS managed `root-task` policies.",
      ja: "タスクポリシーのみ: `TaskPolicyArn` に AWS 管理の `root-task` ポリシー 5 種のどれかを指定します。",
    },
    tags: NO,
    returns: [
      "Credentials",
      "SourceIdentity",
      "SessionTokenSize",
      "SessionTokenUtilization",
    ],
    restrictions: {
      en: "Scoped to the chosen task policy: IAMAuditRootUserCredentials, IAMCreateRootUserPassword, IAMDeleteRootUserCredentials, S3UnlockBucketPolicy or SQSUnlockQueuePolicy. No `AssumedRoleUser` in the response.",
      ja: "選んだタスクポリシーの範囲だけ: IAMAuditRootUserCredentials、IAMCreateRootUserPassword、IAMDeleteRootUserCredentials、S3UnlockBucketPolicy、SQSUnlockQueuePolicy。レスポンスに `AssumedRoleUser` は含まれません。",
    },
    cli: `aws sts assume-root \\
  --region us-east-1 \\
  --target-principal 111122223333 \\
  --task-policy-arn arn=arn:aws:iam::aws:policy/root-task/S3UnlockBucketPolicy \\
  --duration-seconds 900`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAJEXAMPLEXEG2JICEA",
    "SecretAccessKey": "9drTJvcXLB89EXAMPLELB8923FB892xMFI",
    "SessionToken": "AQoXdzELDDY//////////wEaoAK1wvxJY12r2IrDFT2IvAzTCn3zHoZ7YNtpiQLF0MqZye...",
    "Expiration": "2026-10-10T00:15:07+00:00"
  },
  "SourceIdentity": "Alice",
  "SessionTokenSize": 410,
  "SessionTokenUtilization": 10
}`,
    ref: `${REF}AssumeRoot.html`,
    matrix: {
      caller: {
        en: "Management / delegated admin account",
        ja: "管理 / 委任管理者アカウント",
      },
      temp: { en: "Yes (unverified)", ja: "可 (未検証)" },
      duration: { en: "15 min, fixed ceiling", ja: "15 分が上限" },
    },
  },
  {
    id: "GetSessionToken",
    family: "direct",
    auth: "sigv4",
    purpose: {
      en: "Turn an IAM user's long-term keys into short-lived ones, usually to prove MFA for API calls.",
      ja: "IAM ユーザーの長期キーを短期キーに変えます。主に API 呼び出しで MFA を証明するために使います。",
    },
    caller: {
      en: "An IAM user with long-term (`AKIA`) keys. Root can, but AWS advises against it. No permission is needed: it is an authentication step, which policies cannot control.",
      ja: "長期キー (`AKIA`) を持つ IAM ユーザーです。root でも呼べますが非推奨です。認証のステップなので権限は不要で、ポリシーでは制御できません。",
    },
    duration: {
      en: "IAM user: 900 s minimum, 43200 s (12 h) default, 129600 s (36 h) maximum. Root: 900 s minimum, 3600 s default and maximum.",
      ja: "IAM ユーザー: 最短 900 秒、デフォルト 43200 秒 (12 時間)、上限 129600 秒 (36 時間)。root: 最短 900 秒、デフォルトも上限も 3600 秒。",
    },
    mfa: {
      en: "Yes: pass `SerialNumber` and a 6-digit `TokenCode`. A wrong code returns access denied.",
      ja: "あり: `SerialNumber` と 6 桁の `TokenCode` を渡します。コードを間違えるとアクセス拒否になります。",
    },
    sessionPolicy: NO,
    tags: NO,
    returns: ["Credentials", "SessionTokenSize", "SessionTokenUtilization"],
    restrictions: {
      en: "Same permissions as the IAM user, but no IAM API calls unless MFA was included, no STS calls except `AssumeRole` and `GetCallerIdentity`, and no console sign-in through the federation endpoint.",
      ja: "IAM ユーザーと同じ権限です。ただし MFA 付きで取得しない限り IAM API は呼べず、STS は `AssumeRole` と `GetCallerIdentity` だけです。フェデレーションエンドポイント経由のコンソールサインインもできません。",
    },
    cli: `aws sts get-session-token \\
  --serial-number arn:aws:iam::123456789012:mfa/alice \\
  --token-code 123456 \\
  --duration-seconds 43200`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT+FvwqnKwRcOIfrRh3c/L...",
    "Expiration": "2026-10-11T00:00:00+00:00"
  },
  "SessionTokenSize": 380,
  "SessionTokenUtilization": 9
}`,
    ref: `${REF}GetSessionToken.html`,
    matrix: {
      caller: { en: "IAM user (long-term keys)", ja: "IAM ユーザー (長期キー)" },
      temp: { en: "No", ja: "不可" },
      duration: {
        en: "user 15 min / 12 h / 36 h; root 15 min / 1 h / 1 h",
        ja: "ユーザー 15 分 / 12 時間 / 36 時間、root 15 分 / 1 時間 / 1 時間",
      },
    },
  },
  {
    id: "GetFederationToken",
    family: "direct",
    auth: "sigv4",
    purpose: {
      en: "Mint credentials for a federated user, from a server-side broker that signs people in with its own login system.",
      ja: "自前のログイン基盤を持つサーバー側ブローカーが、フェデレーションユーザーの認証情報を発行します。",
    },
    caller: {
      en: "An IAM user's long-term keys (root possible, not recommended). Needs `sts:GetFederationToken`, plus `sts:TagSession` to pass tags.",
      ja: "IAM ユーザーの長期キーです (root も可能ですが非推奨)。`sts:GetFederationToken` が必要で、タグを渡すなら `sts:TagSession` も要ります。",
    },
    duration: {
      en: "IAM user: 900 s / 43200 s default / 129600 s maximum. Root: 900 s / 3600 s / 3600 s.",
      ja: "IAM ユーザー: 900 秒 / デフォルト 43200 秒 / 上限 129600 秒。root: 900 秒 / 3600 秒 / 3600 秒。",
    },
    mfa: { en: "Not supported.", ja: "非対応。" },
    sessionPolicy: {
      en: "Effectively required: with no session policy the federated user has no permissions at all.",
      ja: "事実上必須です。セッションポリシーを渡さないと、フェデレーションユーザーには権限がまったくありません。",
    },
    tags: { en: "Yes: up to 50.", ja: "あり: 最大 50 個。" },
    returns: [
      "Credentials",
      "FederatedUser",
      "PackedPolicySize (deprecated)",
      "SessionTokenSize",
      "SessionTokenUtilization",
    ],
    restrictions: {
      en: "No IAM calls through the CLI or API (console sessions are exempt), no STS calls except `GetCallerIdentity`. Console sign-in through the federation endpoint is allowed.",
      ja: "CLI や API からの IAM 呼び出しはできません (コンソールセッションは例外)。STS は `GetCallerIdentity` のみです。フェデレーションエンドポイント経由のコンソールサインインはできます。",
    },
    cli: `aws sts get-federation-token \\
  --name Bob \\
  --policy-arns arn=arn:aws:iam::123456789012:policy/federateduserdemopolicy1 \\
  --duration-seconds 3600 \\
  --tags Key=Dept,Value=Accounting`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW...",
    "Expiration": "2026-10-10T13:28:33+00:00"
  },
  "FederatedUser": {
    "FederatedUserId": "123456789012:Bob",
    "Arn": "arn:aws:sts::123456789012:federated-user/Bob"
  },
  "PackedPolicySize": 6,
  "SessionTokenSize": 420,
  "SessionTokenUtilization": 6
}`,
    ref: `${REF}GetFederationToken.html`,
    matrix: {
      caller: { en: "IAM user acting as a broker", ja: "ブローカー役の IAM ユーザー" },
      temp: { en: "No", ja: "不可" },
      duration: {
        en: "user 15 min / 12 h / 36 h; root 15 min / 1 h / 1 h",
        ja: "ユーザー 15 分 / 12 時間 / 36 時間、root 15 分 / 1 時間 / 1 時間",
      },
    },
  },
  {
    id: "GetDelegatedAccessToken",
    family: "direct",
    auth: "sigv4",
    since: 2025,
    partnerOnly: true,
    purpose: {
      en: "The STS half of IAM temporary delegation: an AWS Partner redeems a trade-in token the customer approved and released, and gets credentials in the customer's account.",
      ja: "IAM 一時委任の STS 側です。顧客が承認してリリースしたトレードイントークンを AWS パートナーが引き換え、顧客アカウントの認証情報を得ます。",
    },
    caller: {
      en: "Only onboarded AWS Partner accounts (ISV Accelerate plus an AWS Marketplace listing), and only the partner account that created the delegation request.",
      ja: "オンボード済みの AWS パートナーアカウントだけです (ISV Accelerate への参加と AWS Marketplace への出品が条件)。しかも委任リクエストを作ったパートナーアカウント本人に限られます。",
    },
    duration: {
      en: "Set by the delegation request's `SessionDuration` (300 to 43200 s), counted from when the customer releases the token. Every redemption expires at the same moment.",
      ja: "委任リクエストの `SessionDuration` (300〜43200 秒) で決まり、顧客がトークンをリリースした時刻から数えます。何度引き換えても有効期限は変わりません。",
    },
    mfa: NO,
    sessionPolicy: {
      en: "Fixed by the partner's registered policy template, as approved by the customer.",
      ja: "パートナーが登録したポリシーテンプレート (顧客が承認したもの) で固定されます。",
    },
    tags: NO,
    returns: ["Credentials", "AssumedPrincipal", "PackedPolicySize (not populated)"],
    restrictions: {
      en: "Scoped to the approved policy template.",
      ja: "承認されたポリシーテンプレートの範囲だけ。",
    },
    cli: `aws sts get-delegated-access-token --trade-in-token "eyJhbGciOi...EXAMPLE"`,
    response: `{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "IQoJb3JpZ2luX2VjEXAMPLE...",
    "Expiration": "2026-10-10T12:00:00+00:00"
  },
  "AssumedPrincipal": "arn:aws:iam::111122223333:user/approver"
}`,
    responseNote: {
      en: "The exact `AssumedPrincipal` format is unverified; this value is illustrative.",
      ja: "`AssumedPrincipal` の正確な形式は未検証です。この値は例示です。",
    },
    ref: `${REF}GetDelegatedAccessToken.html`,
    matrix: {
      caller: { en: "Onboarded AWS Partner", ja: "オンボード済み AWS パートナー" },
      temp: { en: "Unverified", ja: "未検証" },
      duration: {
        en: "Set by delegation (5 min to 12 h)",
        ja: "委任リクエストで決定 (5 分〜12 時間)",
      },
    },
  },
  {
    id: "GetWebIdentityToken",
    family: "out",
    auth: "sigv4",
    regionalOnly: true,
    since: 2025,
    purpose: {
      en: "Outbound identity federation: get a JWT signed by AWS that proves who your workload is to an external service supporting OIDC. It returns no AWS credentials.",
      ja: "アウトバウンド ID フェデレーション: ワークロードの身元を外部の OIDC 対応サービスに証明する、AWS 署名の JWT を得ます。AWS の認証情報は返しません。",
    },
    caller: {
      en: "An IAM role or user, typically a workload on EC2 or Lambda. The account must first run IAM `EnableOutboundWebIdentityFederation`, which creates its issuer URL.",
      ja: "IAM ロールかユーザーで、典型的には EC2 や Lambda 上のワークロードです。事前にアカウントで IAM の `EnableOutboundWebIdentityFederation` を実行し、issuer URL を作っておく必要があります。",
    },
    duration: {
      en: "JWT lifetime 60 s minimum, 300 s default, 3600 s maximum. It cannot outlive the calling session (`SessionDurationEscalation`).",
      ja: "JWT の有効期間は最短 60 秒、デフォルト 300 秒、上限 3600 秒です。呼び出し元のセッションより長くはできません (`SessionDurationEscalation`)。",
    },
    mfa: NO,
    sessionPolicy: NO,
    tags: {
      en: "Up to 50 `Tags`, which become custom claims (needs `sts:TagGetWebIdentityToken`).",
      ja: "`Tags` を最大 50 個渡せて、カスタムクレームになります (`sts:TagGetWebIdentityToken` が必要)。",
    },
    returns: ["WebIdentityToken", "Expiration"],
    cli: `aws sts get-web-identity-token \\
  --region us-east-1 \\
  --audience https://api.example.com \\
  --signing-algorithm RS256 \\
  --duration-seconds 300`,
    response: `{
  "WebIdentityToken": "eyJraWQiOiJFWEFNUExFIiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiJodHRwczovL2V4YW1wbGUudG9rZW5zLnN0cy5nbG9iYWwuYXBpLmF3cyJ9.SIGNATURE",
  "Expiration": "2026-10-10T22:44:21.703000+00:00"
}`,
    ref: `${REF}GetWebIdentityToken.html`,
    matrix: {
      caller: {
        en: "IAM role or user (workload)",
        ja: "IAM ロール / ユーザー (ワークロード)",
      },
      temp: {
        en: "Yes (token can't outlive session)",
        ja: "可 (セッションより長くできない)",
      },
      duration: { en: "1 min / 5 min / 1 h (JWT)", ja: "1 分 / 5 分 / 1 時間 (JWT)" },
    },
  },
  {
    id: "GetCallerIdentity",
    family: "intro",
    auth: "sigv4",
    purpose: {
      en: "Ask “who am I?”: returns the account, ARN and unique ID of whoever signed the request.",
      ja: "「自分は誰?」を聞く API です。リクエストに署名した主体のアカウント、ARN、一意 ID を返します。",
    },
    caller: {
      en: "Any valid credentials. No permission is needed, and even an explicit Deny on `sts:GetCallerIdentity` does not block it.",
      ja: "有効な認証情報ならなんでも呼べます。権限は不要で、`sts:GetCallerIdentity` を明示的に Deny しても止められません。",
    },
    duration: NA,
    mfa: NO,
    sessionPolicy: NO,
    tags: NO,
    returns: ["Account", "Arn", "UserId"],
    cli: "aws sts get-caller-identity",
    response: `{
  "UserId": "AROA123EXAMPLE123:my-role-session-name",
  "Account": "123456789012",
  "Arn": "arn:aws:sts::123456789012:assumed-role/my-role-name/my-role-session-name"
}`,
    ref: `${REF}GetCallerIdentity.html`,
    matrix: {
      caller: { en: "Any principal", ja: "あらゆるプリンシパル" },
      temp: { en: "Yes", ja: "可" },
      duration: NA,
    },
  },
  {
    id: "GetAccessKeyInfo",
    family: "intro",
    auth: "sigv4",
    purpose: {
      en: "Find the account that owns an access key ID. Handy when a key leaks.",
      ja: "アクセスキー ID の持ち主のアカウントを調べます。キー漏えいの調査で便利です。",
    },
    caller: {
      en: "A principal allowed `sts:GetAccessKeyInfo`. It works for `AKIA` and `ASIA` keys and never says whether the key is active.",
      ja: "`sts:GetAccessKeyInfo` を許可されたプリンシパルです。`AKIA` と `ASIA` の両方に使えますが、キーが有効かどうかは教えてくれません。",
    },
    duration: NA,
    mfa: NO,
    sessionPolicy: NO,
    tags: NO,
    returns: ["Account"],
    cli: "aws sts get-access-key-info --access-key-id AKIAI44QH8DHBEXAMPLE",
    response: `{
  "Account": "111122223333"
}`,
    ref: `${REF}GetAccessKeyInfo.html`,
    matrix: {
      caller: { en: "Principal with permission", ja: "権限を持つプリンシパル" },
      temp: { en: "Yes (unverified)", ja: "可 (未検証)" },
      duration: NA,
    },
  },
  {
    id: "DecodeAuthorizationMessage",
    family: "intro",
    auth: "sigv4",
    purpose: {
      en: "Decode the encoded failure message some services (notably EC2) return with a 403: explicit deny or missing allow, principal, action, resource and condition values.",
      ja: "一部のサービス (特に EC2) が 403 と一緒に返すエンコード済みの失敗メッセージを解読します。明示的な Deny か Allow 不足か、プリンシパル、アクション、リソース、条件キーの値がわかります。",
    },
    caller: {
      en: "A principal allowed `sts:DecodeAuthorizationMessage`. The message is encoded because it can contain privileged detail.",
      ja: "`sts:DecodeAuthorizationMessage` を許可されたプリンシパルです。特権的な情報を含みうるため、メッセージはエンコードされています。",
    },
    duration: NA,
    mfa: NO,
    sessionPolicy: NO,
    tags: NO,
    returns: ["DecodedMessage"],
    cli: `aws sts decode-authorization-message --encoded-message "EXAMPLE-ENCODED-MESSAGE" \\
  --query DecodedMessage --output text`,
    response: `{
  "allowed": false,
  "explicitDeny": false,
  "matchedStatements": {"items": []},
  "failures": {"items": []},
  "context": {
    "principal": {
      "id": "AIDACKCEVSQ6C2EXAMPLE",
      "name": "Bob",
      "arn": "arn:aws:iam::123456789012:user/Bob"
    },
    "action": "ec2:StopInstances",
    "resource": "arn:aws:ec2:us-east-1:123456789012:instance/i-dd01c9bd",
    "conditions": {
      "items": [
        {"key": "ec2:Tenancy", "values": {"items": [{"value": "default"}]}}
      ]
    }
  }
}`,
    responseNote: {
      en: "The nested `items` wrapping follows typical real output and is unverified against the official sample, which shows a simpler shape.",
      ja: "入れ子の `items` は実際によく見る出力に合わせたもので、公式サンプル (より単純な形) とは照合していません。",
    },
    ref: `${REF}DecodeAuthorizationMessage.html`,
    matrix: {
      caller: { en: "Principal with permission", ja: "権限を持つプリンシパル" },
      temp: { en: "Yes (unverified)", ja: "可 (未検証)" },
      duration: NA,
    },
  },
];

export const opById = (id: OpId): Op => {
  const op = OPS.find((o) => o.id === id);
  if (!op) throw new Error(`unknown op ${id}`);
  return op;
};

/** What the caller has in hand, for the picker. */
export type Holding =
  | "iam-keys"
  | "role-session"
  | "saml"
  | "oidc"
  | "mgmt-root"
  | "partner"
  | "jwt-out"
  | "whoami"
  | "key-lookup"
  | "encoded-msg";

export const HOLDINGS: { id: Holding; label: L; ops: OpId[]; why: L }[] = [
  {
    id: "iam-keys",
    label: { en: "IAM user access keys", ja: "IAM ユーザーのアクセスキー" },
    ops: ["AssumeRole", "GetSessionToken", "GetFederationToken"],
    why: {
      en: "Long-term `AKIA` keys can become a role with `AssumeRole`, add MFA with `GetSessionToken`, or mint a federated user for someone else with `GetFederationToken`.",
      ja: "長期キー (`AKIA`) からは、`AssumeRole` でロールになる、`GetSessionToken` で MFA 付きにする、`GetFederationToken` で他人用のフェデレーションユーザーを発行する、の 3 通りです。",
    },
  },
  {
    id: "role-session",
    label: { en: "A role session", ja: "ロールセッション" },
    ops: ["AssumeRole", "GetWebIdentityToken"],
    why: {
      en: "From a role session you can assume another role (role chaining, 1 h cap) or, if outbound federation is enabled, ask for a JWT. `GetSessionToken` and `GetFederationToken` are off-limits.",
      ja: "ロールセッションからは別ロールへの AssumeRole (ロールチェーン、1 時間上限) か、アウトバウンドフェデレーションを有効にしていれば JWT を取得できます。`GetSessionToken` と `GetFederationToken` は呼べません。",
    },
  },
  {
    id: "saml",
    label: { en: "A SAML assertion from my IdP", ja: "IdP の SAML アサーション" },
    ops: ["AssumeRoleWithSAML"],
    why: {
      en: "Send the base64 SAML response as-is. No AWS keys needed: the call is unsigned.",
      ja: "base64 の SAML レスポンスをそのまま送ります。署名なしの呼び出しなので AWS のキーは要りません。",
    },
  },
  {
    id: "oidc",
    label: { en: "An OIDC token (CI, Kubernetes)", ja: "OIDC トークン (CI、Kubernetes)" },
    ops: ["AssumeRoleWithWebIdentity"],
    why: {
      en: "GitHub Actions, EKS service account tokens and friends all land here. Unsigned, so no AWS keys needed.",
      ja: "GitHub Actions や EKS のサービスアカウントトークンなどは、全部ここに来ます。署名なしなので AWS のキーは不要です。",
    },
  },
  {
    id: "mgmt-root",
    label: {
      en: "Org management access, need member root",
      ja: "組織の管理権限で、メンバーの root が要る",
    },
    ops: ["AssumeRoot"],
    why: {
      en: "One task, 15 minutes, Regional endpoint only. Pick one of the 5 `root-task` policies.",
      ja: "タスク 1 つ、15 分、リージョナルエンドポイント限定です。`root-task` ポリシー 5 種から選びます。",
    },
  },
  {
    id: "partner",
    label: {
      en: "A trade-in token (AWS Partner)",
      ja: "トレードイントークン (AWS パートナー)",
    },
    ops: ["GetDelegatedAccessToken"],
    why: {
      en: "Only for onboarded partners, after the customer approved and released the delegation request.",
      ja: "オンボード済みパートナー専用です。顧客が委任リクエストを承認してリリースしたあとに使います。",
    },
  },
  {
    id: "jwt-out",
    label: { en: "Need a JWT for a non-AWS API", ja: "AWS 外の API 用に JWT が欲しい" },
    ops: ["GetWebIdentityToken"],
    why: {
      en: "AWS signs a JWT whose `sub` is your principal ARN. The external service verifies it with the account's issuer URL.",
      ja: "AWS が、`sub` にプリンシパル ARN を入れた JWT に署名します。外部サービスはアカウントの issuer URL で検証します。",
    },
  },
  {
    id: "whoami",
    label: { en: "Just want to know who I am", ja: "自分が誰か知りたいだけ" },
    ops: ["GetCallerIdentity"],
    why: {
      en: "Works with any credentials and cannot be denied.",
      ja: "どんな認証情報でも動き、Deny では止められません。",
    },
  },
  {
    id: "key-lookup",
    label: { en: "Someone's access key ID", ja: "誰かのアクセスキー ID" },
    ops: ["GetAccessKeyInfo"],
    why: {
      en: "Returns only the owning account. For the user or role, look at the credential report (`AKIA`) or CloudTrail (`ASIA`).",
      ja: "返るのは持ち主のアカウントだけです。ユーザーやロールまで知りたいなら、認証情報レポート (`AKIA`) か CloudTrail (`ASIA`) を見てください。",
    },
  },
  {
    id: "encoded-msg",
    label: { en: "An encoded 403 message", ja: "エンコードされた 403 メッセージ" },
    ops: ["DecodeAuthorizationMessage"],
    why: {
      en: "Paste it in one line; line breaks make the call fail with `InvalidAuthorizationMessage`.",
      ja: "1 行のまま貼ってください。改行が入ると `InvalidAuthorizationMessage` で失敗します。",
    },
  },
];
