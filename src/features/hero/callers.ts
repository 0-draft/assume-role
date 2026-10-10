import type { L } from "@/i18n/lang";

/**
 * The hero prints one credential pass per kind of caller. Every value here is
 * fake but shaped like the real thing: account IDs, key prefixes, ARN formats,
 * session names and durations follow docs/03 and docs/05.
 */
export interface Caller {
  id: string;
  who: L;
  holds: L;
  api: string;
  signed: boolean;
  endpoint: string;
  /** Seconds the printed pass is valid for; null when AWS rotates it for you. */
  seconds: number | null;
  /** What the duration means for this caller. */
  durationNote: L;
  /** ARN that GetCallerIdentity would report for the new session. */
  arn: string;
  accessKeyId: string;
  /** Where the credentials end up. */
  delivered: L;
  /** Chapter that explains this caller's path in depth. */
  next: { href: string; label: L };
}

export const CALLERS: Caller[] = [
  {
    id: "dev",
    who: { en: "A developer", ja: "開発者" },
    holds: { en: "IAM user access keys", ja: "IAM ユーザーのアクセスキー" },
    api: "AssumeRole",
    signed: true,
    endpoint: "sts.ap-northeast-1.amazonaws.com",
    seconds: 3600,
    durationNote: {
      en: "Default 1 h. Can go up to the role's MaxSessionDuration (12 h max).",
      ja: "既定 1 時間で、ロールの MaxSessionDuration (最大 12 時間) まで延ばせます。",
    },
    arn: "arn:aws:sts::210987654321:assumed-role/deploy/alice",
    accessKeyId: "ASIAQEXAMPLEDEVKEY01",
    delivered: { en: "~/.aws/cli/cache", ja: "~/.aws/cli/cache" },
    next: {
      href: "#trust",
      label: {
        en: "Why both accounts must agree",
        ja: "両方のアカウントが許可する必要がある理由",
      },
    },
  },
  {
    id: "ci",
    who: { en: "A GitHub Actions job", ja: "GitHub Actions のジョブ" },
    holds: { en: "An OIDC token from GitHub", ja: "GitHub が発行した OIDC トークン" },
    api: "AssumeRoleWithWebIdentity",
    signed: false,
    endpoint: "sts.us-east-1.amazonaws.com",
    seconds: 3600,
    durationNote: {
      en: "configure-aws-credentials asks for 1 h by default.",
      ja: "configure-aws-credentials の既定は 1 時間です。",
    },
    arn: "arn:aws:sts::123456789012:assumed-role/gha-deploy/GitHubActions",
    accessKeyId: "ASIAQEXAMPLEGHAKEY02",
    delivered: { en: "Job environment variables", ja: "ジョブの環境変数" },
    next: {
      href: "#paths",
      label: { en: "Follow the GitHub OIDC flow", ja: "GitHub OIDC の流れを追う" },
    },
  },
  {
    id: "sso",
    who: { en: "An employee signing in with SAML", ja: "SAML でサインインする社員" },
    holds: { en: "A signed SAML assertion", ja: "署名済み SAML アサーション" },
    api: "AssumeRoleWithSAML",
    signed: false,
    endpoint: "signin.aws.amazon.com/saml",
    seconds: 3600,
    durationNote: {
      en: "Default 1 h, capped by the role max and the assertion's SessionNotOnOrAfter.",
      ja: "既定 1 時間で、ロールの上限とアサーションの SessionNotOnOrAfter を超えられません。",
    },
    arn: "arn:aws:sts::123456789012:assumed-role/Engineer/alice@example.com",
    accessKeyId: "ASIAQEXAMPLESAMLKY03",
    delivered: { en: "The console session", ja: "コンソールのセッション" },
    next: {
      href: "#paths",
      label: { en: "Follow the SAML sign-in", ja: "SAML サインインの流れを追う" },
    },
  },
  {
    id: "ec2",
    who: { en: "An EC2 instance", ja: "EC2 インスタンス" },
    holds: { en: "An instance profile", ja: "インスタンスプロファイル" },
    api: "AssumeRole",
    signed: true,
    endpoint: "169.254.169.254 (IMDS)",
    seconds: null,
    durationNote: {
      en: "EC2 calls STS for you and puts fresh credentials in IMDS at least 5 minutes before the old ones expire.",
      ja: "STS を呼ぶのは EC2 サービスです。古い認証情報が切れる 5 分以上前に、新しいものが IMDS に置かれます。",
    },
    arn: "arn:aws:sts::123456789012:assumed-role/web-app/i-0abc1234def567890",
    accessKeyId: "ASIAQEXAMPLEEC2KEY04",
    delivered: {
      en: "Instance metadata (IMDSv2)",
      ja: "インスタンスメタデータ (IMDSv2)",
    },
    next: {
      href: "#paths",
      label: { en: "See how IMDS hands keys over", ja: "IMDS がキーを渡す流れを見る" },
    },
  },
  {
    id: "mfa",
    who: { en: "An admin with an MFA device", ja: "MFA デバイスを持つ管理者" },
    holds: {
      en: "IAM user keys plus a 6-digit code",
      ja: "IAM ユーザーのキーと 6 桁のコード",
    },
    api: "GetSessionToken",
    signed: true,
    endpoint: "sts.ap-northeast-1.amazonaws.com",
    seconds: 43200,
    durationNote: {
      en: "Default 12 h, up to 36 h. With root credentials the maximum is 1 h.",
      ja: "既定 12 時間、最大 36 時間です。ルートの認証情報で呼ぶと最大 1 時間になります。",
    },
    arn: "arn:aws:iam::123456789012:user/alice",
    accessKeyId: "ASIAQEXAMPLEMFAKEY05",
    delivered: { en: "A named CLI profile", ja: "CLI の名前付きプロファイル" },
    next: {
      href: "#api",
      label: {
        en: "Compare GetSessionToken with the rest",
        ja: "GetSessionToken を他の API と比べる",
      },
    },
  },
  {
    id: "root",
    who: { en: "An Organizations admin", ja: "Organizations の管理者" },
    holds: { en: "Management-account access", ja: "管理アカウントの権限" },
    api: "AssumeRoot",
    signed: true,
    endpoint: "sts.us-east-1.amazonaws.com",
    seconds: 900,
    durationNote: {
      en: "15 minutes at most, scoped to one of five root-task policies. Regional endpoints only.",
      ja: "最大 15 分で、5 種類の root-task ポリシーのどれか 1 つに絞られます。リージョナルエンドポイントでしか呼べません。",
    },
    arn: "root user of 444455556666, one task only",
    accessKeyId: "ASIAQEXAMPLEROOTKY06",
    delivered: { en: "Your shell, for one task", ja: "1 タスク分だけシェルに" },
    next: {
      href: "#api",
      label: { en: "Read the AssumeRoot rules", ja: "AssumeRoot のルールを読む" },
    },
  },
];

/** "59:58" or "11:59:58" style countdown for the printed pass. */
export function formatLeft(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Human duration: 900 → "15 min", 3600 → "1 h", 43200 → "12 h". */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = seconds / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
