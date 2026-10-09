import type { L } from "@/i18n/lang";

export type KeyFamily = "sts" | "global" | "federation";

export interface ConditionKey {
  key: string;
  family: KeyFamily;
  type: string;
  /** Where or when the key is present. */
  when: L;
  meaning: L;
}

/**
 * Condition keys that matter for STS, from the Service Authorization Reference
 * for STS and the IAM global condition key reference (see
 * docs/04-sessions-and-policies.md, section 10).
 */
export const CATALOG: ConditionKey[] = [
  {
    key: "sts:ExternalId",
    family: "sts",
    type: "String",
    when: {
      en: "AssumeRole, only when the caller passes one",
      ja: "AssumeRole で呼び出し元が渡したときだけ",
    },
    meaning: {
      en: "The third-party external ID. The vendor generates it per customer; the customer checks it in the trust policy.",
      ja: "サードパーティ用の外部 ID。ベンダーが顧客ごとに発行し、顧客側が信頼ポリシーで検査します。",
    },
  },
  {
    key: "sts:RoleSessionName",
    family: "sts",
    type: "String",
    when: {
      en: "AssumeRole* (console, CLI, API)",
      ja: "AssumeRole* (コンソール、CLI、API)",
    },
    meaning: {
      en: "The session name the caller asks for. Use it to force a naming scheme such as ${aws:username}.",
      ja: "呼び出し元が指定するセッション名。${aws:username} のような命名規則を強制するのに使います。",
    },
  },
  {
    key: "sts:SourceIdentity",
    family: "sts",
    type: "String",
    when: {
      en: "AssumeRole*, sts:SetSourceIdentity",
      ja: "AssumeRole*、sts:SetSourceIdentity",
    },
    meaning: {
      en: "The source identity being set in this request. It cannot be changed later and survives role chaining.",
      ja: "このリクエストで設定しようとしている Source Identity。後から変更できず、ロールチェーンを通しても引き継がれます。",
    },
  },
  {
    key: "sts:TransitiveTagKeys",
    family: "sts",
    type: "ArrayOfString",
    when: { en: "AssumeRole*, sts:TagSession", ja: "AssumeRole*、sts:TagSession" },
    meaning: {
      en: "Which session tag keys may (or must) be marked transitive, so they follow the session down a role chain.",
      ja: "どのセッションタグを transitive (ロールチェーンの先まで引き継ぐ) にしてよいか、あるいはしなければならないか。",
    },
  },
  {
    key: "sts:RequestContext/${ContextKey}",
    family: "sts",
    type: "String",
    when: { en: "sts:SetContext", ja: "sts:SetContext" },
    meaning: {
      en: "Values inside a trusted context assertion (ProvidedContexts), used for IAM Identity Center trusted identity propagation.",
      ja: "信頼されたコンテキストアサーション (ProvidedContexts) の中身。IAM Identity Center の Trusted Identity Propagation で使います。",
    },
  },
  {
    key: "sts:RequestContextProviders",
    family: "sts",
    type: "ArrayOfARN",
    when: { en: "sts:SetContext", ja: "sts:SetContext" },
    meaning: {
      en: "The context provider ARNs in the request, such as arn:aws:iam::aws:contextProvider/IdentityCenter.",
      ja: "リクエストに含まれるコンテキストプロバイダーの ARN (arn:aws:iam::aws:contextProvider/IdentityCenter など)。",
    },
  },
  {
    key: "sts:RoleAuthorizedByIdp",
    family: "sts",
    type: "Bool",
    when: {
      en: "AssumeRoleWithWebIdentity, always present",
      ja: "AssumeRoleWithWebIdentity で常に存在",
    },
    meaning: {
      en: "true when the token's https://aws.amazon.com/roles claim lists the requested role. Use Bool, not BoolIfExists.",
      ja: "トークンの https://aws.amazon.com/roles クレームに要求ロールが含まれていれば true。BoolIfExists ではなく Bool で書きます。",
    },
  },
  {
    key: "sts:TaskPolicyArn",
    family: "sts",
    type: "ARN",
    when: { en: "AssumeRoot", ja: "AssumeRoot" },
    meaning: {
      en: "Which of the five AWS managed root-task policies the centralized root session may use.",
      ja: "集中ルートアクセスのセッションが使える root-task ポリシー (AWS 管理の 5 種) のどれか。",
    },
  },
  {
    key: "sts:AWSServiceName",
    family: "sts",
    type: "String",
    when: { en: "sts:GetServiceBearerToken", ja: "sts:GetServiceBearerToken" },
    meaning: {
      en: "The service a bearer token is requested for, for example CodeArtifact.",
      ja: "ベアラートークンを要求している対象サービス (CodeArtifact など)。",
    },
  },
  {
    key: "sts:DurationSeconds",
    family: "sts",
    type: "Numeric",
    when: {
      en: "sts:GetServiceBearerToken, GetWebIdentityToken (not the AssumeRole* calls)",
      ja: "sts:GetServiceBearerToken、GetWebIdentityToken (AssumeRole* には効かない)",
    },
    meaning: {
      en: "Requested token lifetime in seconds.",
      ja: "要求されたトークンの有効期間 (秒)。",
    },
  },
  {
    key: "sts:IdentityTokenAudience",
    family: "sts",
    type: "ArrayOfString",
    when: { en: "GetWebIdentityToken", ja: "GetWebIdentityToken" },
    meaning: {
      en: "Allowed aud values for JWTs that AWS issues to outside services (outbound identity federation).",
      ja: "AWS が外部サービス向けに発行する JWT (アウトバウンド ID フェデレーション) で許す aud。",
    },
  },
  {
    key: "sts:SigningAlgorithm",
    family: "sts",
    type: "String",
    when: { en: "GetWebIdentityToken", ja: "GetWebIdentityToken" },
    meaning: {
      en: "Signing algorithm for the outbound JWT: ES384 or RS256.",
      ja: "アウトバウンド JWT の署名アルゴリズム。ES384 か RS256。",
    },
  },
  {
    key: "token.actions.githubusercontent.com:sub",
    family: "federation",
    type: "String",
    when: {
      en: "AssumeRoleWithWebIdentity with GitHub's provider",
      ja: "GitHub プロバイダーでの AssumeRoleWithWebIdentity",
    },
    meaning: {
      en: "repo:ORG/REPO:ref:..., :environment:..., or :pull_request. IAM requires it, and not as a bare wildcard, on roles that trust GitHub.",
      ja: "repo:ORG/REPO:ref:...、:environment:...、:pull_request のいずれか。GitHub を信頼するロールでは IAM がこのキー (ワイルドカード単体は不可) を必須にしています。",
    },
  },
  {
    key: "token.actions.githubusercontent.com:aud",
    family: "federation",
    type: "String",
    when: {
      en: "AssumeRoleWithWebIdentity with GitHub's provider",
      ja: "GitHub プロバイダーでの AssumeRoleWithWebIdentity",
    },
    meaning: {
      en: "The token audience, sts.amazonaws.com when using aws-actions/configure-aws-credentials.",
      ja: "トークンの audience。aws-actions/configure-aws-credentials を使うなら sts.amazonaws.com。",
    },
  },
  {
    key: "saml:aud",
    family: "federation",
    type: "String",
    when: { en: "AssumeRoleWithSAML", ja: "AssumeRoleWithSAML" },
    meaning: {
      en: "Comes from the assertion's Recipient (not Audience). Usually https://signin.aws.amazon.com/saml.",
      ja: "アサーションの Recipient 由来 (Audience ではない)。通常は https://signin.aws.amazon.com/saml。",
    },
  },
  {
    key: "saml:sub",
    family: "federation",
    type: "String",
    when: {
      en: "AssumeRoleWithSAML and the resulting session",
      ja: "AssumeRoleWithSAML と、その後のセッション",
    },
    meaning: {
      en: "The assertion subject. One of the few SAML keys (with saml:sub_type and saml:namequalifier) still available after sign-in.",
      ja: "アサーションの Subject。サインイン後も使える数少ない SAML キー (他は saml:sub_type と saml:namequalifier)。",
    },
  },
  {
    key: "cognito-identity.amazonaws.com:amr",
    family: "federation",
    type: "ArrayOfString",
    when: { en: "Cognito identity pool web identity", ja: "Cognito ID プールの Web ID" },
    meaning: {
      en: "Contains authenticated or unauthenticated. Pair with the :aud key (identity pool ID).",
      ja: "authenticated か unauthenticated を含みます。:aud (ID プール ID) と組み合わせて使います。",
    },
  },
  {
    key: "aws:SourceArn",
    family: "global",
    type: "ARN",
    when: {
      en: "A service principal acts on behalf of a resource",
      ja: "サービスプリンシパルがリソースの代わりに動くとき",
    },
    meaning: {
      en: "The resource the service is acting for. Prevents cross-service confused deputy.",
      ja: "サービスがどのリソースのために動いているか。サービス間の Confused Deputy を防ぎます。",
    },
  },
  {
    key: "aws:SourceAccount",
    family: "global",
    type: "String",
    when: {
      en: "A service principal acts on behalf of a resource",
      ja: "サービスプリンシパルがリソースの代わりに動くとき",
    },
    meaning: {
      en: "The account that owns that resource. With aws:SourceArn, both must match.",
      ja: "そのリソースを所有するアカウント。aws:SourceArn と併用すると両方の一致が必要です。",
    },
  },
  {
    key: "aws:MultiFactorAuthPresent",
    family: "global",
    type: "Bool",
    when: {
      en: "Requests signed with temporary credentials only",
      ja: "一時認証情報で署名されたリクエストのみ",
    },
    meaning: {
      en: "Whether MFA was used to get the credentials. Absent for long-term keys, so deny statements need BoolIfExists.",
      ja: "認証情報の取得時に MFA を使ったか。長期キーでは存在しないので、Deny 文では BoolIfExists を使います。",
    },
  },
  {
    key: "aws:MultiFactorAuthAge",
    family: "global",
    type: "Numeric",
    when: {
      en: "Temporary credentials obtained with MFA",
      ja: "MFA 付きで取得した一時認証情報",
    },
    meaning: {
      en: "Seconds since the MFA check.",
      ja: "MFA 認証からの経過秒数。",
    },
  },
  {
    key: "aws:TokenIssueTime",
    family: "global",
    type: "Date",
    when: { en: "Temporary credentials only", ja: "一時認証情報のみ" },
    meaning: {
      en: "When the session was issued. The console's Revoke sessions denies everything issued before a timestamp.",
      ja: "セッションの発行時刻。コンソールの「セッションの取り消し」は、ある時刻より前に発行されたものを全部拒否します。",
    },
  },
  {
    key: "aws:SourceIdentity",
    family: "global",
    type: "String",
    when: {
      en: "Requests made with a session that has a source identity",
      ja: "Source Identity を持つセッションからのリクエスト",
    },
    meaning: {
      en: "The immutable source identity, for per-human controls on shared roles.",
      ja: "変更不能な Source Identity。共有ロールでも人ごとに制御できます。",
    },
  },
  {
    key: "aws:PrincipalTag/${TagKey}",
    family: "global",
    type: "String",
    when: {
      en: "The principal has tags (incl. session tags)",
      ja: "プリンシパルにタグがある (セッションタグ含む)",
    },
    meaning: {
      en: "Tags on the principal; session tags override role tags with the same key. The basis of ABAC.",
      ja: "プリンシパルのタグ。同じキーならセッションタグがロールのタグを上書きします。ABAC の基本。",
    },
  },
  {
    key: "aws:RequestTag/${TagKey}",
    family: "global",
    type: "String",
    when: {
      en: "The request carries tags (e.g. session tags)",
      ja: "リクエストにタグがある (セッションタグなど)",
    },
    meaning: {
      en: "Tag values being passed now. Use with sts:TagSession to control which session tags are allowed.",
      ja: "今回渡されるタグの値。sts:TagSession と組み合わせて、許すセッションタグを制御します。",
    },
  },
  {
    key: "aws:PrincipalArn",
    family: "global",
    type: "ARN",
    when: { en: "Signed requests", ja: "署名付きリクエスト" },
    meaning: {
      en: "For a role session this is the role ARN, not the session ARN. Matched by name, so it survives role recreation.",
      ja: "ロールセッションではセッション ARN ではなくロール ARN。名前で照合されるので、ロールを作り直しても一致し続けます。",
    },
  },
  {
    key: "aws:PrincipalType",
    family: "global",
    type: "String",
    when: { en: "Always", ja: "常に" },
    meaning: {
      en: "Account, User, FederatedUser, AssumedRole or Anonymous.",
      ja: "Account、User、FederatedUser、AssumedRole、Anonymous のいずれか。",
    },
  },
  {
    key: "aws:userid",
    family: "global",
    type: "String",
    when: { en: "Always", ja: "常に" },
    meaning: {
      en: "For a role session: AROA…:session-name. Deny one exact session with it.",
      ja: "ロールセッションなら AROA…:セッション名。特定の 1 セッションだけを拒否できます。",
    },
  },
  {
    key: "aws:FederatedProvider",
    family: "global",
    type: "String",
    when: {
      en: "OIDC-assumed sessions and their trust evaluation",
      ja: "OIDC で引き受けたセッションと、その信頼評価",
    },
    meaning: {
      en: "The IdP that issued the token: the provider ARN for custom IdPs, or e.g. cognito-identity.amazonaws.com.",
      ja: "トークンを発行した IdP。カスタム IdP ならプロバイダー ARN、組み込みなら cognito-identity.amazonaws.com など。",
    },
  },
  {
    key: "aws:AssumedRoot",
    family: "global",
    type: "Bool",
    when: { en: "Credentials from AssumeRoot only", ja: "AssumeRoot の認証情報のみ" },
    meaning: {
      en: "Marks centralized root-access sessions.",
      ja: "集中ルートアクセスのセッションであることを示します。",
    },
  },
  {
    key: "aws:Ec2InstanceSourceVpc",
    family: "global",
    type: "String",
    when: {
      en: "Requests signed with EC2 instance role credentials",
      ja: "EC2 インスタンスロールの認証情報で署名されたリクエスト",
    },
    meaning: {
      en: "The VPC the credentials were delivered to. Pin stolen-credential use back to that VPC.",
      ja: "認証情報が配布された VPC。盗まれた認証情報を VPC 外で使わせない制御に使います。",
    },
  },
];

export function filterCatalog(q: string, family: KeyFamily | "all"): ConditionKey[] {
  const needle = q.trim().toLowerCase();
  return CATALOG.filter(
    (k) =>
      (family === "all" || k.family === family) &&
      (!needle ||
        [k.key, k.type, k.when.en, k.when.ja, k.meaning.en, k.meaning.ja].some((s) =>
          s.toLowerCase().includes(needle),
        )),
  );
}
