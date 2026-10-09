import type { L, Lang } from "@/i18n/lang";
import type { Family, OpId } from "./ops";

/** One bar on the duration ruler. Values in seconds. */
export interface DurationRow {
  op: OpId;
  family: Family;
  variant?: L;
  min: number;
  /** Absent when the API has no default (the value comes from elsewhere). */
  def?: number;
  max: number;
  note?: L;
}

/** Every credential- or token-issuing call, from docs/03-api-operations.md. */
export const DURATIONS: DurationRow[] = [
  {
    op: "AssumeRole",
    family: "role",
    min: 900,
    def: 3600,
    max: 43200,
    note: {
      en: "Max is the role's MaxSessionDuration, 1 to 12 h.",
      ja: "上限はロールの MaxSessionDuration (1〜12 時間)。",
    },
  },
  {
    op: "AssumeRole",
    family: "role",
    variant: { en: "role chaining", ja: "ロールチェーン" },
    min: 900,
    def: 3600,
    max: 3600,
    note: {
      en: "A role session assuming another role. Asking for more than 1 h fails.",
      ja: "ロールセッションから別ロールを引き受ける場合。1 時間超を指定すると失敗する。",
    },
  },
  {
    op: "AssumeRoleWithSAML",
    family: "role",
    min: 900,
    def: 3600,
    max: 43200,
    note: {
      en: "Also cut short by the assertion's SessionNotOnOrAfter.",
      ja: "アサーションの SessionNotOnOrAfter でも打ち切られる。",
    },
  },
  {
    op: "AssumeRoleWithWebIdentity",
    family: "role",
    min: 900,
    def: 3600,
    max: 43200,
  },
  {
    op: "AssumeRoot",
    family: "direct",
    min: 0,
    def: 900,
    max: 900,
    note: {
      en: "The API Reference lists the range as 0 to 900 s.",
      ja: "API リファレンス上の範囲は 0〜900 秒。",
    },
  },
  {
    op: "GetSessionToken",
    family: "direct",
    variant: { en: "IAM user", ja: "IAM ユーザー" },
    min: 900,
    def: 43200,
    max: 129600,
  },
  {
    op: "GetSessionToken",
    family: "direct",
    variant: { en: "root", ja: "root" },
    min: 900,
    def: 3600,
    max: 3600,
  },
  {
    op: "GetFederationToken",
    family: "direct",
    variant: { en: "IAM user", ja: "IAM ユーザー" },
    min: 900,
    def: 43200,
    max: 129600,
  },
  {
    op: "GetFederationToken",
    family: "direct",
    variant: { en: "root", ja: "root" },
    min: 900,
    def: 3600,
    max: 3600,
  },
  {
    op: "GetDelegatedAccessToken",
    family: "direct",
    min: 300,
    max: 43200,
    note: {
      en: "No default: the delegation request's SessionDuration decides, counted from token release.",
      ja: "デフォルトなし。委任リクエストの SessionDuration で決まり、トークンのリリース時刻から数える。",
    },
  },
  {
    op: "GetWebIdentityToken",
    family: "out",
    variant: { en: "JWT lifetime", ja: "JWT の寿命" },
    min: 60,
    def: 300,
    max: 3600,
  },
];

/** Ruler domain: 1 minute to 36 hours, the widest range any STS call allows. */
export const RULER_MIN = 60;
export const RULER_MAX = 129600;

/**
 * Position of a duration on a log axis, as a fraction 0..1. Values outside
 * the domain clamp to its ends (AssumeRoot's documented 0 s sits at the left).
 */
export function logPos(seconds: number, lo = RULER_MIN, hi = RULER_MAX): number {
  if (!(seconds > lo)) return 0;
  if (seconds >= hi) return 1;
  return Math.log(seconds / lo) / Math.log(hi / lo);
}

export const TICKS = [60, 900, 3600, 43200, 129600];

/** Human duration: "15 min", "12 h", "300 s" style, in either language. */
export function formatDuration(seconds: number, lang: Lang): string {
  const ja = lang === "ja";
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600;
    return ja ? `${h} 時間` : `${h} h`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60;
    return ja ? `${m} 分` : `${m} min`;
  }
  return ja ? `${seconds} 秒` : `${seconds} s`;
}
