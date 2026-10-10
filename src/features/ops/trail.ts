import type { L } from "@/i18n/lang";

/**
 * CloudTrail scenarios. Records are trimmed to the fields that matter for STS
 * and use fake IDs; field names and placement follow the IAM User Guide's
 * CloudTrail page and the CloudTrail userIdentity reference (docs/06).
 */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface TrailRecord {
  account: "caller" | "role";
  region: string;
  body: { [k: string]: Json };
}

export interface Scenario {
  id: string;
  label: L;
  summary: L;
  callerAccount: string;
  roleAccount: string;
  /** Records actually delivered. A missing side means nothing is logged there. */
  records: TrailRecord[];
  /** Why the role account has no record, when it has none. */
  missingNote?: L;
}

const CALLER = "111122223333";
const ROLE = "444455556666";

export const SCENARIOS: Scenario[] = [
  {
    id: "cross",
    label: { en: "Cross-account AssumeRole", ja: "クロスアカウント AssumeRole" },
    summary: {
      en: "One call, two records: one in each account, joined by the same sharedEventID.",
      ja: "1 回の呼び出しで記録は 2 件残ります。両方のアカウントに 1 件ずつで、同じ sharedEventID で結び付きます。",
    },
    callerAccount: CALLER,
    roleAccount: ROLE,
    records: [
      {
        account: "caller",
        region: "ap-northeast-1",
        body: {
          eventSource: "sts.amazonaws.com",
          eventName: "AssumeRole",
          awsRegion: "ap-northeast-1",
          userIdentity: {
            type: "IAMUser",
            principalId: "AIDAEXAMPLEALICE0001",
            arn: `arn:aws:iam::${CALLER}:user/alice`,
            accountId: CALLER,
          },
          requestParameters: {
            roleArn: `arn:aws:iam::${ROLE}:role/deploy`,
            roleSessionName: "alice",
            durationSeconds: 3600,
          },
          responseElements: {
            credentials: {
              accessKeyId: "ASIAEXAMPLECROSS0001",
              expiration: "Oct 10, 2026, 11:00:00 AM",
            },
            assumedRoleUser: {
              assumedRoleId: "AROAEXAMPLEDEPLOY001:alice",
              arn: `arn:aws:sts::${ROLE}:assumed-role/deploy/alice`,
            },
          },
          readOnly: true,
          managementEvent: true,
          eventCategory: "Management",
          tlsDetails: { clientProvidedHostHeader: "sts.ap-northeast-1.amazonaws.com" },
          recipientAccountId: CALLER,
          sharedEventID: "6b1c3f2e-EXAMPLE",
        },
      },
      {
        account: "role",
        region: "ap-northeast-1",
        body: {
          eventSource: "sts.amazonaws.com",
          eventName: "AssumeRole",
          awsRegion: "ap-northeast-1",
          userIdentity: {
            type: "AWSAccount",
            principalId: "AIDAEXAMPLEALICE0001",
            accountId: CALLER,
          },
          requestParameters: {
            roleArn: `arn:aws:iam::${ROLE}:role/deploy`,
            roleSessionName: "alice",
          },
          readOnly: true,
          managementEvent: true,
          eventCategory: "Management",
          recipientAccountId: ROLE,
          sharedEventID: "6b1c3f2e-EXAMPLE",
        },
      },
    ],
  },
  {
    id: "denied",
    label: { en: "Denied cross-account call", ja: "拒否されたクロスアカウント呼び出し" },
    summary: {
      en: "The role owner sees nothing. A denied cross-account AssumeRole is logged only in the caller's account.",
      ja: "ロールの持ち主には何も見えません。拒否されたクロスアカウントの AssumeRole は、呼び出し側のアカウントにしか記録されません。",
    },
    callerAccount: CALLER,
    roleAccount: ROLE,
    records: [
      {
        account: "caller",
        region: "ap-northeast-1",
        body: {
          eventSource: "sts.amazonaws.com",
          eventName: "AssumeRole",
          awsRegion: "ap-northeast-1",
          userIdentity: {
            type: "IAMUser",
            arn: `arn:aws:iam::${CALLER}:user/mallory`,
            accountId: CALLER,
          },
          errorCode: "AccessDenied",
          errorMessage: `User: arn:aws:iam::${CALLER}:user/mallory is not authorized to perform: sts:AssumeRole on resource: arn:aws:iam::${ROLE}:role/deploy`,
          requestParameters: {
            roleArn: `arn:aws:iam::${ROLE}:role/deploy`,
            roleSessionName: "probe",
          },
          responseElements: null,
          recipientAccountId: CALLER,
        },
      },
    ],
    missingNote: {
      en: "Nothing here. CloudTrail does not log denied cross-account role assumptions (or AssumeRoot) in the target account, which also means role-name probing is invisible to you.",
      ja: "何も残りません。拒否されたクロスアカウントのロール引き受け (と AssumeRoot) は対象アカウントに記録されないので、ロール名の総当たり探索もあなたからは見えません。",
    },
  },
  {
    id: "global",
    label: {
      en: "Global endpoint, served locally",
      ja: "グローバルエンドポイントをローカル処理",
    },
    summary: {
      en: "Called sts.amazonaws.com from eu-north-1. Served in eu-north-1, but the record is delivered to us-east-1.",
      ja: "eu-north-1 から sts.amazonaws.com を呼んだ例です。処理は eu-north-1 ですが、記録が届くのは us-east-1 です。",
    },
    callerAccount: CALLER,
    roleAccount: CALLER,
    records: [
      {
        account: "caller",
        region: "us-east-1",
        body: {
          eventSource: "sts.amazonaws.com",
          eventName: "AssumeRole",
          awsRegion: "us-east-1",
          userIdentity: {
            type: "AssumedRole",
            arn: `arn:aws:sts::${CALLER}:assumed-role/app/i-0abc1234def567890`,
            accountId: CALLER,
          },
          additionalEventData: {
            RequestDetails: { awsServingRegion: "eu-north-1", endpointType: "global" },
          },
          tlsDetails: { clientProvidedHostHeader: "sts-global.eu-north-1.amazonaws.com" },
          recipientAccountId: CALLER,
        },
      },
    ],
  },
  {
    id: "oidc",
    label: { en: "GitHub Actions (OIDC)", ja: "GitHub Actions (OIDC)" },
    summary: {
      en: "AssumeRoleWithWebIdentity is unsigned, so there is no caller account: only the role account logs it, with the GitHub subject.",
      ja: "AssumeRoleWithWebIdentity は署名なしなので、呼び出し側のアカウントがありません。記録はロール側だけで、GitHub の subject が残ります。",
    },
    callerAccount: "GitHub",
    roleAccount: ROLE,
    records: [
      {
        account: "role",
        region: "us-east-1",
        body: {
          eventSource: "sts.amazonaws.com",
          eventName: "AssumeRoleWithWebIdentity",
          awsRegion: "us-east-1",
          userIdentity: {
            type: "WebIdentityUser",
            principalId:
              "token.actions.githubusercontent.com:sts.amazonaws.com:repo:octo-org/app:ref:refs/heads/main",
            userName: "repo:octo-org/app:ref:refs/heads/main",
            identityProvider: "token.actions.githubusercontent.com",
          },
          requestParameters: {
            roleArn: `arn:aws:iam::${ROLE}:role/gha-deploy`,
            roleSessionName: "GitHubActions",
          },
          responseElements: {
            subjectFromWebIdentityToken: "repo:octo-org/app:ref:refs/heads/main",
            provider: `arn:aws:iam::${ROLE}:oidc-provider/token.actions.githubusercontent.com`,
            audience: "sts.amazonaws.com",
            sessionTokenSize: 1012,
            sessionTokenUtilization: 25,
          },
          additionalEventData: {
            identityProviderConnectionVerificationMethod: "IAMTrustStore",
          },
          recipientAccountId: ROLE,
        },
      },
    ],
    missingNote: {
      en: "There is no AWS caller account. The request came from a GitHub runner holding a JWT, not from AWS credentials.",
      ja: "AWS 上に呼び出し側のアカウントはありません。リクエストは AWS の認証情報ではなく、JWT を持った GitHub ランナーから来ています。",
    },
  },
  {
    id: "chain",
    label: {
      en: "Role chain with source identity",
      ja: "ソースアイデンティティ付きロールチェーン",
    },
    summary: {
      en: "A role session assumes a second role. sessionContext names the issuer, and sourceIdentity still says who the human was.",
      ja: "ロールセッションが 2 つ目のロールを引き受けます。sessionContext に発行元が、sourceIdentity に元の人が残ります。",
    },
    callerAccount: CALLER,
    roleAccount: CALLER,
    records: [
      {
        account: "caller",
        region: "ap-northeast-1",
        body: {
          eventSource: "sts.amazonaws.com",
          eventName: "AssumeRole",
          awsRegion: "ap-northeast-1",
          userIdentity: {
            type: "AssumedRole",
            principalId: "AROAEXAMPLEENGINEER1:alice@example.com",
            arn: `arn:aws:sts::${CALLER}:assumed-role/Engineer/alice@example.com`,
            sessionContext: {
              sessionIssuer: {
                type: "Role",
                arn: `arn:aws:iam::${CALLER}:role/Engineer`,
              },
              attributes: {
                creationDate: "2026-10-10T09:00:00Z",
                mfaAuthenticated: "false",
              },
              sourceIdentity: "alice",
            },
          },
          requestParameters: {
            roleArn: `arn:aws:iam::${CALLER}:role/db-admin`,
            roleSessionName: "alice-db",
            durationSeconds: 3600,
          },
          responseElements: {
            assumedRoleUser: {
              arn: `arn:aws:sts::${CALLER}:assumed-role/db-admin/alice-db`,
            },
            sourceIdentity: "alice",
          },
          tlsDetails: { clientProvidedHostHeader: "sts.ap-northeast-1.amazonaws.com" },
          recipientAccountId: CALLER,
        },
      },
    ],
  },
];

/** Field explanations, keyed by dotted path inside a record. */
export const FIELDS: Record<string, L> = {
  awsRegion: {
    en: "The Region the event is delivered to. Regional endpoint calls land in that Region; global endpoint calls always land in us-east-1.",
    ja: "イベントが届くリージョンです。リージョナルエンドポイントならそのリージョン、グローバルエンドポイントなら常に us-east-1 です。",
  },
  "userIdentity.type": {
    en: "Who signed the request: IAMUser, AssumedRole, FederatedUser, Root, or for the role account's copy AWSAccount / AWSService. SAMLUser and WebIdentityUser mark unsigned federation calls.",
    ja: "誰が署名したかを示します。IAMUser、AssumedRole、FederatedUser、Root のほか、ロール側の記録では AWSAccount や AWSService になります。SAMLUser と WebIdentityUser は署名なしのフェデレーション呼び出しです。",
  },
  "userIdentity.sessionContext": {
    en: "Present when the caller is itself a session: which role issued it (sessionIssuer), when it was created, whether MFA was used.",
    ja: "呼び出し元自体がセッションのときに付きます。どのロールが発行したか (sessionIssuer)、作成時刻、MFA の有無が入ります。",
  },
  "userIdentity.sessionContext.sessionIssuer": {
    en: "The role that issued the current session. Follow it backwards to walk a role chain.",
    ja: "現在のセッションを発行したロールです。これをたどればロールチェーンを遡れます。",
  },
  "userIdentity.sessionContext.sourceIdentity": {
    en: "Set once with sts:SetSourceIdentity and immutable through every hop. If you require it, you never have to walk the chain to find the human.",
    ja: "sts:SetSourceIdentity で一度だけ設定され、どのホップでも変わりません。必須にしておけば、誰がやったかを探すためにチェーンを遡る必要がなくなります。",
  },
  "userIdentity.principalId": {
    en: "Unique ID of the caller. For role sessions it is AROA…:session-name; for web identity it combines issuer, audience and subject.",
    ja: "呼び出し元の一意 ID です。ロールセッションなら AROA…:セッション名、Web ID なら発行者、audience、subject の組み合わせです。",
  },
  "responseElements.credentials.accessKeyId": {
    en: "The ASIA key that was issued. Search for it in later events to trace what the session did; the secret key is never logged.",
    ja: "発行された ASIA キーです。後続のイベントでこれを検索すれば、セッションの行動を追えます。シークレットキーは記録されません。",
  },
  "responseElements.sourceIdentity": {
    en: "The source identity carried into the new session.",
    ja: "新しいセッションに引き継がれたソースアイデンティティです。",
  },
  "responseElements.subjectFromWebIdentityToken": {
    en: "The `sub` claim from the OIDC token: for GitHub, which repo and ref asked.",
    ja: "OIDC トークンの `sub` クレームです。GitHub なら、どのリポジトリのどの ref (ブランチやタグなど) から要求されたかがわかります。",
  },
  "responseElements.sessionTokenUtilization": {
    en: "Percentage of the 4,096-byte session token limit this session used (since September 2026).",
    ja: "このセッションが 4,096 バイトのトークン上限の何 % を使ったかを示します (2026 年 9 月から)。",
  },
  "additionalEventData.RequestDetails": {
    en: "Added with the 2025 global endpoint change.",
    ja: "2025 年のグローバルエンドポイント変更で追加されました。",
  },
  "additionalEventData.RequestDetails.endpointType": {
    en: "global or regional: which hostname family the client called.",
    ja: "global か regional で、クライアントがどちらのホスト名を呼んだかを示します。",
  },
  "additionalEventData.RequestDetails.awsServingRegion": {
    en: "The Region that actually served the request. For a global call from a default-enabled Region using Amazon DNS, that is the caller's own Region.",
    ja: "実際に処理したリージョンです。Amazon DNS を使うデフォルト有効リージョンからのグローバル呼び出しなら、呼び出し元自身のリージョンになります。",
  },
  "additionalEventData.identityProviderConnectionVerificationMethod": {
    en: "IAMTrustStore if AWS verified the IdP through its trusted root CAs, Thumbprint if it used a configured thumbprint.",
    ja: "IAMTrustStore なら、AWS が信頼済みルート CA で IdP を検証しています。Thumbprint なら、登録済みのサムプリントを使っています。",
  },
  "tlsDetails.clientProvidedHostHeader": {
    en: "The hostname the client actually called. The quickest way to find code still using sts.amazonaws.com. The sts-global.<region> value comes from AWS's own example and is not an endpoint to call.",
    ja: "クライアントが実際に呼んだホスト名です。sts.amazonaws.com を使い続けているコードを探す一番の近道です。sts-global.<region> は AWS の例に出てくる値で、呼び出し先として使うものではありません。",
  },
  recipientAccountId: {
    en: "The account this copy of the event was delivered to.",
    ja: "このイベントのコピーが届いたアカウントです。",
  },
  sharedEventID: {
    en: "Shared by the caller-side and role-side copies of one cross-account call. Join on it to see both halves.",
    ja: "1 回のクロスアカウント呼び出しで、呼び出し側とロール側の記録が共有する ID です。これで結合すれば両側が見えます。",
  },
  readOnly: {
    en: "AssumeRole, AssumeRoleWithSAML and AssumeRoleWithWebIdentity are logged as read-only, yet the response elements (minus the secret) are still included.",
    ja: "AssumeRole、AssumeRoleWithSAML、AssumeRoleWithWebIdentity は読み取り扱いで記録されますが、レスポンス要素 (シークレット以外) も含まれます。",
  },
  managementEvent: {
    en: "All STS events are management events. STS has no data events.",
    ja: "STS のイベントはすべて管理イベントです。データイベントはありません。",
  },
  errorCode: {
    en: "Set on failed calls. Denied cross-account attempts appear only here, in the caller's account.",
    ja: "失敗した呼び出しに付きます。拒否されたクロスアカウントの試行は、呼び出し側アカウントのこの欄にしか出ません。",
  },
};
