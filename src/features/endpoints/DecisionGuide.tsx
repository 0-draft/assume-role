import { useState } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { Figure } from "@/components/ui";
import { decide, type Answers, type QuestionId } from "./decide";

const QUESTIONS: Record<QuestionId, L> = {
  commercial: {
    en: "Is the workload in the commercial partition (not China, GovCloud, ESC or ISO)?",
    ja: "商用パーティション (中国・GovCloud・ESC・ISO 以外) のワークロード?",
  },
  fips: {
    en: "Do you need FIPS 140 validated endpoints?",
    ja: "FIPS 140 検証済みのエンドポイントが必要?",
  },
  fipsRegion: {
    en: "Is the Region us-east-1/2, us-west-1/2, ca-central-1 or ca-west-1?",
    ja: "リージョンは us-east-1/2・us-west-1/2・ca-central-1・ca-west-1 のどれか?",
  },
  privateNoEgress: {
    en: "Does it run in private subnets with no internet egress?",
    ja: "インターネットへの出口がないプライベートサブネットで動く?",
  },
  ipv6: { en: "Do clients need IPv6?", ja: "クライアントに IPv6 が必要?" },
};

export function DecisionGuide() {
  const { t } = useLang();
  const [a, setA] = useState<Answers>({
    commercial: true,
    fips: false,
    fipsRegion: true,
    privateNoEgress: false,
    ipv6: false,
  });
  const d = decide(a);

  return (
    <Figure
      title={{
        en: "Which endpoint should I use?",
        ja: "結局どのエンドポイントを使えばいい?",
      }}
      hint={{
        en: "Answer top to bottom. Questions that no longer matter drop out.",
        ja: "上から答えてください。関係なくなった質問は消えます。",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
        <ol className="relative space-y-3 border-l-2 border-[var(--line)] pl-5">
          {d.asked.map((q) => (
            <li key={q} className="relative">
              <span
                aria-hidden
                className="absolute top-2.5 -left-[1.69rem] size-3 rounded-full border-2 border-[var(--sts)] bg-[var(--surface)]"
              />
              <fieldset>
                <legend className="text-sm font-semibold">{t(QUESTIONS[q])}</legend>
                <div className="mt-1.5 flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={a[q] === v}
                      onClick={() => setA({ ...a, [q]: v })}
                      className="min-h-9 min-w-16 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold aria-pressed:border-[var(--sts)] aria-pressed:bg-[color-mix(in_oklab,var(--sts)_14%,var(--surface))]"
                    >
                      {v ? t({ en: "Yes", ja: "はい" }) : t({ en: "No", ja: "いいえ" })}
                    </button>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <div
          aria-live="polite"
          className="guilloche self-start rounded-2xl border-2 p-5"
          style={{ borderColor: d.host ? "var(--sts)" : "var(--deny)" }}
        >
          <div className="text-xs font-semibold text-[var(--muted)]">
            {t({ en: "Use", ja: "使うのは" })}
          </div>
          <div
            className="mt-1 font-mono text-lg font-semibold break-all"
            style={{ color: d.host ? "var(--sts)" : "var(--deny)" }}
          >
            {d.host ??
              t({ en: "No FIPS window here", ja: "ここに FIPS の窓口はありません" })}
          </div>
          <p className="mt-3 text-sm">{t(d.why)}</p>
        </div>
      </div>
    </Figure>
  );
}
