import type { L } from "@/i18n/lang";

/**
 * Every STS-related error from docs/06 (operation-specific errors from the STS
 * API Reference, plus the common caller-side ones). `patterns` are matched
 * case-insensitively against whatever the reader pastes.
 */
export interface StsError {
  id: string;
  /** Wire error code; SDK exception classes add an `Exception` suffix. */
  code: string;
  http: number | null;
  apis: string[];
  /** What the reader sees. */
  symptom: L;
  cause: L;
  fix: L;
  /** Chapter that explains the mechanism. */
  chapter: "endpoints" | "api" | "paths" | "sessions" | "trust" | "ops" | "why";
  patterns: RegExp[];
  source: string;
}

const ASSUME = ["AssumeRole", "AssumeRoleWithSAML", "AssumeRoleWithWebIdentity"];

export const ERRORS: StsError[] = [
  {
    id: "access-denied",
    code: "AccessDenied",
    http: 403,
    apis: ["AssumeRole", "AssumeRoot", "GetFederationToken", "…"],
    symptom: {
      en: "User: arn:… is not authorized to perform: sts:AssumeRole on resource: arn:aws:iam::…:role/X",
      ja: "User: arn:… is not authorized to perform: sts:AssumeRole on resource: arn:aws:iam::…:role/X",
    },
    cause: {
      en: "One gate said no: the caller's identity policy (needed cross-account), the role's trust policy, a trust-policy condition such as `sts:ExternalId`, MFA or `aws:PrincipalOrgID`, an SCP on the caller's account, or an RCP on the role's account.",
      ja: "どこかのゲートが拒否している。呼び出し側の ID ポリシー (クロスアカウントでは必須)、ロールの信頼ポリシー、`sts:ExternalId`・MFA・`aws:PrincipalOrgID` などの条件、呼び出し側アカウントの SCP、ロール側アカウントの RCP のどれか。",
    },
    fix: {
      en: "Check both sides. Newer AccessDenied messages name the policy type that denied. Denied cross-account attempts are not logged in the role's account, so read the caller account's CloudTrail.",
      ja: "両側を確認する。新しめの AccessDenied メッセージは拒否したポリシーの種類を教えてくれる。拒否されたクロスアカウント呼び出しはロール側アカウントには記録されないので、呼び出し側アカウントの CloudTrail を見る。",
    },
    chapter: "trust",
    patterns: [/not authorized to perform:?\s*sts:/i, /\bAccessDenied\b/i],
    source: "https://repost.aws/knowledge-center/iam-assume-role-error",
  },
  {
    id: "expired-token",
    code: "ExpiredToken",
    http: 400,
    apis: [...ASSUME, "AssumeRoot", "any service"],
    symptom: {
      en: "ExpiredTokenException: The security token included in the request is expired",
      ja: "ExpiredTokenException: The security token included in the request is expired",
    },
    cause: {
      en: "Either the OIDC token or SAML assertion you passed has expired, or the temporary credentials signing the request have passed their expiration. Temporary credentials cannot be extended.",
      ja: "渡した OIDC トークンや SAML アサーションの期限切れか、リクエストに署名している一時認証情報自体の期限切れ。一時認証情報は延長できない。",
    },
    fix: {
      en: "Fetch a fresh IdP token or assertion, or request new credentials. Let the SDK credential provider refresh them instead of caching keys yourself.",
      ja: "IdP トークンやアサーションを取り直すか、新しい認証情報を発行する。キーを自前でキャッシュせず SDK の認証情報プロバイダに更新を任せる。",
    },
    chapter: "sessions",
    patterns: [/ExpiredToken/i, /token included in the request is expired/i],
    source: "https://repost.aws/knowledge-center/iam-credentials-token",
  },
  {
    id: "invalid-client-token-id",
    code: "InvalidClientTokenId",
    http: 403,
    apis: ["any"],
    symptom: {
      en: "InvalidClientTokenId: The security token included in the request is invalid",
      ja: "InvalidClientTokenId: The security token included in the request is invalid",
    },
    cause: {
      en: "The access key is deleted, inactive or mistyped, a session token is missing or belongs to different keys, or the SDK picked up credentials from somewhere you did not expect in the provider chain.",
      ja: "アクセスキーが削除・無効・打ち間違い、セッショントークンが無い・別のキーのもの、または認証情報プロバイダチェーンの想定外の場所からキーを拾っている。",
    },
    fix: {
      en: "Run `aws sts get-caller-identity --debug` to see which provider supplied the keys, then fix or replace them.",
      ja: "`aws sts get-caller-identity --debug` でどのプロバイダがキーを渡したか確認し、直すか差し替える。",
    },
    chapter: "paths",
    patterns: [
      /InvalidClientTokenId/i,
      /security token included in the request is invalid/i,
    ],
    source: "https://repost.aws/knowledge-center/iam-credentials-token",
  },
  {
    id: "opt-in-v1-token",
    code: "AuthFailure",
    http: null,
    apis: ["services in opt-in Regions"],
    symptom: {
      en: "Credentials work everywhere except an opt-in Region, e.g. EC2: AuthFailure: AWS was not able to validate the provided access credentials",
      ja: "オプトインリージョンでだけ認証が通らない。例: EC2 の AuthFailure: AWS was not able to validate the provided access credentials",
    },
    cause: {
      en: "The credentials came from the global endpoint, whose session tokens default to version 1. Version 1 tokens are valid only in Regions enabled by default.",
      ja: "グローバルエンドポイントから取った認証情報で、そのセッショントークンが既定の v1。v1 トークンはデフォルト有効なリージョンでしか通らない。",
    },
    fix: {
      en: "Call a Regional STS endpoint (its tokens are valid everywhere), or set `aws iam set-security-token-service-preferences --global-endpoint-token-version v2Token`.",
      ja: "リージョナルエンドポイントを使う (トークンは全リージョンで有効)。または `aws iam set-security-token-service-preferences --global-endpoint-token-version v2Token` を設定する。",
    },
    chapter: "endpoints",
    patterns: [/AuthFailure/i, /not able to validate the provided access credentials/i],
    source: "https://repost.aws/knowledge-center/iam-validate-access-credentials",
  },
  {
    id: "region-disabled",
    code: "RegionDisabled",
    http: 403,
    apis: [
      ...ASSUME,
      "AssumeRoot",
      "GetFederationToken",
      "GetSessionToken",
      "GetDelegatedAccessToken",
    ],
    symptom: {
      en: "RegionDisabledException: STS is not activated in the requested region for the account that is being asked to generate credentials",
      ja: "RegionDisabledException: STS is not activated in the requested region for the account that is being asked to generate credentials",
    },
    cause: {
      en: "STS is deactivated in that Region for the account whose credentials are being issued, or, for an opt-in Region, the role-owning account has not enabled the Region.",
      ja: "認証情報を発行するアカウントで、そのリージョンの STS が無効化されている。オプトインリージョンなら、ロールを持つアカウントがそのリージョンを有効化していない。",
    },
    fix: {
      en: "Activate the Regional STS endpoint in IAM account settings, or enable the opt-in Region in the role-owning account.",
      ja: "IAM のアカウント設定でそのリージョンの STS を有効化する。オプトインリージョンならロール側アカウントでリージョンを有効化する。",
    },
    chapter: "endpoints",
    patterns: [/RegionDisabled/i, /not activated in the requested region/i],
    source:
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-regions.html",
  },
  {
    id: "invalid-identity-token",
    code: "InvalidIdentityToken",
    http: 400,
    apis: ["AssumeRoleWithSAML", "AssumeRoleWithWebIdentity"],
    symptom: {
      en: "InvalidIdentityToken: … Incorrect token audience / No OpenIDConnect provider found in your account for …",
      ja: "InvalidIdentityToken: … Incorrect token audience / No OpenIDConnect provider found in your account for …",
    },
    cause: {
      en: "AWS could not validate the token: `iss` does not match an IAM OIDC provider, `aud` is not in the provider's client ID list, or the signature does not match the IdP's keys.",
      ja: "トークンを検証できない。`iss` に対応する IAM OIDC プロバイダが無い、`aud` がクライアント ID リストに無い、署名が IdP の鍵と合わない、のどれか。",
    },
    fix: {
      en: "Get a new token. Make the IAM OIDC provider URL and audience match the token's `iss` and `aud`, and check that the IdP's JWKS is reachable.",
      ja: "トークンを取り直す。IAM OIDC プロバイダの URL と audience を、トークンの `iss` と `aud` に合わせる。IdP の JWKS に到達できるかも確認する。",
    },
    chapter: "trust",
    patterns: [
      /InvalidIdentityToken/i,
      /No OpenIDConnect provider found/i,
      /Incorrect token audience/i,
    ],
    source: "https://repost.aws/knowledge-center/iam-sts-invalididentitytoken",
  },
  {
    id: "idp-communication",
    code: "IDPCommunicationError",
    http: 400,
    apis: ["AssumeRoleWithWebIdentity"],
    symptom: {
      en: "IDPCommunicationError: The request could not be fulfilled because the identity provider (IDP) that was asked to verify the incoming identity token could not be reached",
      ja: "IDPCommunicationError: The request could not be fulfilled because the identity provider (IDP) that was asked to verify the incoming identity token could not be reached",
    },
    cause: {
      en: "STS could not reach the IdP to verify the token. Often transient; STS gives the IdP about 5 seconds.",
      ja: "STS がトークン検証のために IdP に到達できなかった。一時的なことが多い。STS が待つのは約 5 秒。",
    },
    fix: {
      en: "Retry a few times with backoff. Check the IdP's availability and how fast its JWKS endpoint answers.",
      ja: "バックオフ付きで数回リトライ。IdP の稼働状況と JWKS エンドポイントの応答速度を確認する。",
    },
    chapter: "paths",
    patterns: [
      /IDPCommunicationError/i,
      /identity provider \(IDP\).*could not be reached/i,
    ],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html",
  },
  {
    id: "idp-rejected",
    code: "IDPRejectedClaim",
    http: 403,
    apis: ["AssumeRoleWithSAML", "AssumeRoleWithWebIdentity"],
    symptom: {
      en: "IDPRejectedClaim: The identity provider (IdP) reported that authentication failed",
      ja: "IDPRejectedClaim: The identity provider (IdP) reported that authentication failed",
    },
    cause: {
      en: "The IdP reported failed authentication, or the claim is invalid, expired or revoked.",
      ja: "IdP が認証失敗を返した、またはクレームが不正・期限切れ・失効済み。",
    },
    fix: {
      en: "Sign in at the IdP again. For SAML, check the `Role` and `RoleSessionName` attributes, the audience and the signing certificate.",
      ja: "IdP で再認証する。SAML なら `Role` と `RoleSessionName` 属性、audience、署名証明書を確認する。",
    },
    chapter: "paths",
    patterns: [/IDPRejectedClaim/i, /reported that authentication failed/i],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html",
  },
  {
    id: "malformed-policy",
    code: "MalformedPolicyDocument",
    http: 400,
    apis: [...ASSUME, "GetFederationToken"],
    symptom: {
      en: "MalformedPolicyDocument: The request was rejected because the policy document was malformed",
      ja: "MalformedPolicyDocument: The request was rejected because the policy document was malformed",
    },
    cause: {
      en: "The inline session policy you passed is not valid JSON or not valid policy grammar.",
      ja: "渡したインラインのセッションポリシーが JSON として、またはポリシー文法として不正。",
    },
    fix: {
      en: "Fix the JSON. The error message names the problem.",
      ja: "JSON を直す。エラーメッセージに問題箇所が書いてある。",
    },
    chapter: "sessions",
    patterns: [/MalformedPolicyDocument/i, /policy document was malformed/i],
    source: "https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html",
  },
  {
    id: "packed-policy",
    code: "PackedPolicyTooLarge",
    http: 400,
    apis: [...ASSUME, "GetFederationToken", "GetDelegatedAccessToken"],
    symptom: {
      en: "PackedPolicyTooLarge: The request was rejected because the total packed size of the session policies and session tags combined was too large",
      ja: "PackedPolicyTooLarge: The request was rejected because the total packed size of the session policies and session tags combined was too large",
    },
    cause: {
      en: "Since September 2026 the assembled session token must fit in 4,096 bytes. Session policies and session tags pushed it over, even if each stayed within its own limit.",
      ja: "2026 年 9 月以降、組み上がったセッショントークンは 4,096 バイト以内である必要がある。個々の上限内でも、セッションポリシーとセッションタグの合計で超えた。",
    },
    fix: {
      en: "Trim session policies and tags, prefer managed policy ARNs over long inline JSON, and watch `SessionTokenUtilization`.",
      ja: "セッションポリシーとタグを減らす。長いインライン JSON よりマネージドポリシー ARN を使う。`SessionTokenUtilization` を監視する。",
    },
    chapter: "sessions",
    patterns: [/PackedPolicyTooLarge/i, /packed size/i],
    source:
      "https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/",
  },
  {
    id: "invalid-authz-message",
    code: "InvalidAuthorizationMessage",
    http: 400,
    apis: ["DecodeAuthorizationMessage"],
    symptom: {
      en: "InvalidAuthorizationMessageException: The error returned if the message passed to DecodeAuthorizationMessage was invalid",
      ja: "InvalidAuthorizationMessageException: The error returned if the message passed to DecodeAuthorizationMessage was invalid",
    },
    cause: {
      en: "The encoded message was altered (line breaks, truncation) or has expired.",
      ja: "エンコード済みメッセージが改行や切り詰めで壊れているか、期限切れ。",
    },
    fix: {
      en: "Pass the exact string as returned, decode it promptly, and grant `sts:DecodeAuthorizationMessage`.",
      ja: "返ってきた文字列をそのまま渡し、早めにデコードする。`sts:DecodeAuthorizationMessage` の権限も付ける。",
    },
    chapter: "api",
    patterns: [/InvalidAuthorizationMessage/i],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_DecodeAuthorizationMessage.html",
  },
  {
    id: "throttling",
    code: "ThrottlingException",
    http: 400,
    apis: [
      "AssumeRole",
      "GetCallerIdentity",
      "GetSessionToken",
      "GetFederationToken",
      "GetAccessKeyInfo",
      "DecodeAuthorizationMessage",
    ],
    symptom: {
      en: "ThrottlingException: Rate exceeded",
      ja: "ThrottlingException: Rate exceeded",
    },
    cause: {
      en: "More than 600 requests per second per account per Region for the operations that share the STS quota.",
      ja: "STS のクォータを共有する操作で、アカウント・リージョンあたり毎秒 600 リクエストを超えた。",
    },
    fix: {
      en: "Cache credentials until shortly before expiry, let SDKs retry with backoff, spread load across Regional endpoints, or ask AWS Support for an increase.",
      ja: "期限直前まで認証情報を使い回す。SDK のバックオフ付きリトライに任せる。リージョナルエンドポイントに負荷を分散する。必要なら AWS サポートに引き上げを依頼する。",
    },
    chapter: "ops",
    patterns: [/Throttling/i, /Rate exceeded/i, /request rate is too high/i],
    source: "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html",
  },
  {
    id: "signature",
    code: "SignatureDoesNotMatch",
    http: 403,
    apis: ["any signed call"],
    symptom: {
      en: "SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided",
      ja: "SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided",
    },
    cause: {
      en: "Wrong secret for the access key ID, stray whitespace in the secret, a session token mixed with different keys, a proxy that altered the request, or the wrong Region in the credential scope.",
      ja: "アクセスキー ID とシークレットの組み合わせ違い、シークレットに余計な空白、別のキーのセッショントークン、プロキシによるリクエスト改変、認証スコープのリージョン違いのどれか。",
    },
    fix: {
      en: "Re-export a consistent key, secret and token, and sign for the Region of the endpoint you call.",
      ja: "キー・シークレット・トークンを揃えて設定し直し、呼ぶエンドポイントのリージョンで署名する。",
    },
    chapter: "why",
    patterns: [/SignatureDoesNotMatch/i, /signature we calculated does not match/i],
    source:
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-troubleshooting.html",
  },
  {
    id: "request-expired",
    code: "RequestExpired",
    http: 400,
    apis: ["any signed call"],
    symptom: {
      en: "RequestExpired: Request has expired",
      ja: "RequestExpired: Request has expired",
    },
    cause: {
      en: "The request timestamp is more than 15 minutes off, usually because the clock is skewed.",
      ja: "リクエストのタイムスタンプが 15 分以上ずれている。たいていは時計のずれ。",
    },
    fix: {
      en: "Sync the clock with NTP.",
      ja: "NTP で時刻を合わせる。",
    },
    chapter: "why",
    patterns: [/RequestExpired/i, /Request has expired/i],
    source: "https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html",
  },
  {
    id: "chain-cap",
    code: "DurationSeconds > 3600",
    http: null,
    apis: ["AssumeRole"],
    symptom: {
      en: "AssumeRole fails when called with role-session credentials and a DurationSeconds above 3600, even though the target role allows 12 hours.",
      ja: "ロールセッションの認証情報で DurationSeconds を 3600 超にして AssumeRole すると失敗する。ターゲットロールが 12 時間を許していても同じ。",
    },
    cause: {
      en: "A role session tried to assume another role for longer than 1 hour. Role chaining is capped at 1 hour and STS rejects the call instead of shortening it.",
      ja: "ロールセッションから別ロールを 1 時間超で引き受けようとした。ロールチェーンは 1 時間が上限で、STS は短縮せずに拒否する。",
    },
    fix: {
      en: "Request 3600 seconds or less, or assume the target role directly from a non-session principal.",
      ja: "3600 秒以下を指定するか、セッションでないプリンシパルから直接ターゲットロールを引き受ける。",
    },
    chapter: "sessions",
    patterns: [
      /role chaining|role-session credentials/i,
      /DurationSeconds (exceeds|above 3600)/i,
    ],
    source: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html",
  },
  {
    id: "jwt-size",
    code: "JWTPayloadSizeExceeded",
    http: 400,
    apis: ["GetWebIdentityToken"],
    symptom: {
      en: "JWTPayloadSizeExceeded",
      ja: "JWTPayloadSizeExceeded",
    },
    cause: {
      en: "Too many or too large request tags for the JWT.",
      ja: "JWT に載せるリクエストタグが多すぎる、または大きすぎる。",
    },
    fix: { en: "Send fewer or shorter tags.", ja: "タグを減らすか短くする。" },
    chapter: "api",
    patterns: [/JWTPayloadSizeExceeded/i],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html",
  },
  {
    id: "outbound-disabled",
    code: "OutboundWebIdentityFederationDisabled",
    http: 403,
    apis: ["GetWebIdentityToken"],
    symptom: {
      en: "OutboundWebIdentityFederationDisabled",
      ja: "OutboundWebIdentityFederationDisabled",
    },
    cause: {
      en: "Outbound identity federation has not been enabled for the account.",
      ja: "アカウントでアウトバウンド ID フェデレーションが有効化されていない。",
    },
    fix: {
      en: "Enable it first with IAM `EnableOutboundWebIdentityFederation` or in the console.",
      ja: "先に IAM の `EnableOutboundWebIdentityFederation` かコンソールで有効化する。",
    },
    chapter: "api",
    patterns: [/OutboundWebIdentityFederationDisabled/i],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html",
  },
  {
    id: "duration-escalation",
    code: "SessionDurationEscalation",
    http: 403,
    apis: ["GetWebIdentityToken"],
    symptom: {
      en: "SessionDurationEscalation",
      ja: "SessionDurationEscalation",
    },
    cause: {
      en: "The requested JWT lifetime would outlive the session that is asking for it.",
      ja: "要求した JWT の有効期間が、呼び出し元セッションの残り時間より長い。",
    },
    fix: {
      en: "Request a shorter `DurationSeconds`.",
      ja: "`DurationSeconds` を短くする。",
    },
    chapter: "api",
    patterns: [/SessionDurationEscalation/i],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html",
  },
  {
    id: "trade-in-expired",
    code: "ExpiredTradeInToken",
    http: 400,
    apis: ["GetDelegatedAccessToken"],
    symptom: {
      en: "ExpiredTradeInToken",
      ja: "ExpiredTradeInToken",
    },
    cause: {
      en: "The trade-in token from the temporary delegation flow has expired.",
      ja: "一時委任フローのトレードイントークンが期限切れ。",
    },
    fix: { en: "Request a new delegation.", ja: "委任をもう一度リクエストする。" },
    chapter: "api",
    patterns: [/ExpiredTradeInToken/i],
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html",
  },
];
