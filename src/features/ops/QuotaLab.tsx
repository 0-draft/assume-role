import { useId, useState } from "react";
import { Figure } from "@/components/ui";
import { useLang } from "@/i18n/useLang";
import type { L } from "@/i18n/lang";
import { buckets, counts, STS_RPS, type SourceId } from "./quota";

const LABELS: Record<SourceId, { label: L; note: L }> = {
  app: {
    label: { en: "Your app: AssumeRole", ja: "自分のアプリ: AssumeRole" },
    note: { en: "Regional endpoint, ap-northeast-1", ja: "リージョナル、ap-northeast-1" },
  },
  health: {
    label: {
      en: "Health checks: GetCallerIdentity",
      ja: "ヘルスチェック: GetCallerIdentity",
    },
    note: { en: "Same bucket as AssumeRole", ja: "AssumeRole と同じ枠" },
  },
  global: {
    label: { en: "Old SDK: global endpoint", ja: "古い SDK: グローバルエンドポイント" },
    note: { en: "Called from eu-north-1, its own budget", ja: "eu-north-1 から。別枠" },
  },
  partner: {
    label: {
      en: "Another account assuming your role",
      ja: "他アカウントがあなたのロールを引き受け",
    },
    note: { en: "Billed to the caller's account", ja: "呼び出し側アカウントの枠を消費" },
  },
  lambda: {
    label: {
      en: "Lambda assuming your execution role",
      ja: "Lambda が実行ロールを引き受け",
    },
    note: {
      en: "AWS service principal: doesn't count",
      ja: "AWS サービスプリンシパル: カウント対象外",
    },
  },
  oidc: {
    label: {
      en: "CI jobs: AssumeRoleWithWebIdentity",
      ja: "CI ジョブ: AssumeRoleWithWebIdentity",
    },
    note: {
      en: "Not on the shared list; its limit is not published",
      ja: "共有枠の対象外。上限は非公開",
    },
  },
};

const ORDER: SourceId[] = ["app", "health", "global", "partner", "lambda", "oidc"];

export function QuotaLab() {
  const { t } = useLang();
  const base = useId();
  const [rates, setRates] = useState<Record<SourceId, number>>({
    app: 350,
    health: 150,
    global: 200,
    partner: 100,
    lambda: 300,
    oidc: 50,
  });
  const result = buckets(rates);

  const bucketLabel = (b: (typeof result)[number]) =>
    b.account === "partner"
      ? t({
          en: "Partner account, regional ap-northeast-1",
          ja: "相手アカウント、リージョナル ap-northeast-1",
        })
      : b.endpoint === "global"
        ? t({
            en: "Your account, global endpoint (from eu-north-1)",
            ja: "あなたのアカウント、グローバル (eu-north-1 発)",
          })
        : t({
            en: "Your account, regional ap-northeast-1",
            ja: "あなたのアカウント、リージョナル ap-northeast-1",
          });

  return (
    <Figure
      title={{
        en: "Who spends your 600 requests per second?",
        ja: "毎秒 600 リクエストの枠を誰が使う?",
      }}
      hint={{
        en: "Drag the sliders. Each bar is one quota bucket: per account, per Region, with the global endpoint counted separately.",
        ja: "スライダーを動かしてください。棒 1 本が 1 つのクォータ枠 (アカウント×リージョン、グローバルは別枠) です。",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="space-y-4">
          {ORDER.map((id) => {
            const c = counts(id);
            return (
              <li key={id}>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`${base}-${id}`} className="text-sm font-semibold">
                    {t(LABELS[id].label)}
                  </label>
                  <span className="font-mono text-sm tabular-nums">{rates[id]} rps</span>
                </div>
                <input
                  id={`${base}-${id}`}
                  type="range"
                  min={0}
                  max={800}
                  step={10}
                  value={rates[id]}
                  onChange={(e) =>
                    setRates((r) => ({ ...r, [id]: Number(e.target.value) }))
                  }
                  className="mt-1 w-full accent-[var(--sts)]"
                />
                <div
                  className={`text-xs ${c ? "text-[var(--muted)]" : "text-[var(--resource)]"}`}
                >
                  {t(LABELS[id].note)}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-4" aria-live="polite">
          {result.map((b) => {
            const pct = Math.min(100, (b.rps / STS_RPS) * 100);
            const color = b.throttled
              ? "var(--deny)"
              : b.account === "partner"
                ? "var(--role)"
                : "var(--sts)";
            return (
              <div key={b.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{bucketLabel(b)}</span>
                  <span className="font-mono tabular-nums" style={{ color }}>
                    {b.rps} / {STS_RPS}
                  </span>
                </div>
                <div className="relative mt-1 h-5 overflow-hidden rounded-md bg-[var(--sunk)]">
                  <div
                    className="h-full rounded-md transition-[width] duration-300"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                {b.throttled && (
                  <div className="mt-1 font-mono text-xs font-semibold text-[var(--deny)]">
                    ThrottlingException: Rate exceeded
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-[var(--muted)]">
            {t({
              en: "Shared by AssumeRole, GetCallerIdentity, GetSessionToken, GetFederationToken, GetAccessKeyInfo and DecodeAuthorizationMessage. Raise it through AWS Support, not Service Quotas.",
              ja: "AssumeRole、GetCallerIdentity、GetSessionToken、GetFederationToken、GetAccessKeyInfo、DecodeAuthorizationMessage で共有します。引き上げは Service Quotas ではなく AWS サポート経由です。",
            })}
          </p>
        </div>
      </div>
    </Figure>
  );
}
