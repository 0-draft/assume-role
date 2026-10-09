import { useEffect, useState } from "react";
import { useLang } from "@/i18n/useLang";
import { Segmented } from "@/components/ui";
import { CALLERS, formatDuration, formatLeft, type Caller } from "./callers";

export function Hero() {
  const { t } = useLang();
  const [id, setId] = useState(CALLERS[0].id);
  const caller = CALLERS.find((c) => c.id === id) ?? CALLERS[0];

  return (
    <section
      aria-labelledby="hero-title"
      className="grid gap-10 py-12 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center"
    >
      <div>
        <h1
          id="hero-title"
          className="text-[2.6rem] leading-[1.02] font-bold sm:text-6xl"
        >
          {t({
            en: "Almost every AWS credential you didn't type was printed by STS.",
            ja: "自分で打ち込んでいない AWS の認証情報は、ほぼすべて STS が発行している。",
          })}
        </h1>
        <p className="prose-col mt-5 text-lg text-[var(--muted)]">
          {t({
            en: "The AWS Security Token Service hands out short-lived keys to developers, CI jobs, EC2 instances, employees and admins. It has 11 APIs, a global endpoint that no longer works the way it used to, and dozens of regional, FIPS and IPv6 hostnames. This page draws all of it.",
            ja: "AWS Security Token Service は、開発者・CI ジョブ・EC2・社員・管理者に短命のキーを配る窓口です。API は 11 個。かつてと挙動が変わったグローバルエンドポイントに、リージョン・FIPS・IPv6 のホスト名がずらり。このページはそれを全部図にします。",
          })}
        </p>
        <div className="mt-8">
          <Segmented
            label={{
              en: "Who is asking STS for credentials?",
              ja: "誰が STS に認証情報を求めている?",
            }}
            options={CALLERS.map((c) => ({ value: c.id, label: c.who }))}
            value={id}
            onChange={setId}
            color="var(--caller)"
          />
        </div>
      </div>
      <Pass key={caller.id} caller={caller} />
    </section>
  );
}

function Pass({ caller }: { caller: Caller }) {
  const { t } = useLang();
  const [left, setLeft] = useState(caller.seconds ?? 0);

  useEffect(() => {
    if (caller.seconds === null) return;
    const started = Date.now();
    const total = caller.seconds;
    const tick = setInterval(() => setLeft(total - (Date.now() - started) / 1000), 1000);
    return () => clearInterval(tick);
  }, [caller.seconds]);

  const rows: [string, string][] = [
    ["AccessKeyId", caller.accessKeyId],
    ["SecretAccessKey", "wJalrXUtnFEMI/K7MDENG/bPxRfi…"],
    ["SessionToken", "AQoEXAMPLEH4aoAH0gNCAPy…"],
    [t({ en: "Identity", ja: "ID" }), caller.arn],
  ];

  return (
    <div className="relative">
      <div
        role="img"
        aria-label={t({
          en: `Temporary credential issued by ${caller.api} for ${caller.who.en}`,
          ja: `${caller.api} が${caller.who.ja}に発行した一時認証情報`,
        })}
        className="print-in guilloche relative grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow)]"
      >
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-sm font-semibold text-[var(--sts)]">
              AWS Security Token Service
            </span>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[0.7rem] font-semibold"
              style={{
                color: caller.signed ? "var(--role)" : "var(--idp)",
                borderColor: caller.signed ? "var(--role)" : "var(--idp)",
              }}
            >
              {caller.signed ? "SigV4" : t({ en: "unsigned", ja: "署名なし" })}
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold break-all sm:text-[1.7rem]">
            sts:{caller.api}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {t(caller.who)}
            {t({ en: ", holding ", ja: "。持っているのは " })}
            {t(caller.holds)}
          </div>
          <dl className="mt-5 space-y-2.5">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
                <dt className="font-mono text-[0.68rem] text-[var(--muted)]">{k}</dt>
                <dd className="font-mono text-[0.82rem] break-all">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-3 border-t border-dashed border-[var(--line)] pt-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[0.72rem] text-[var(--muted)]">
                {t({ en: "Asked at", ja: "問い合わせ先" })}
              </div>
              <div className="font-mono text-[0.8rem] break-all">{caller.endpoint}</div>
            </div>
            <div>
              <div className="text-[0.72rem] text-[var(--muted)]">
                {t({ en: "Ends up in", ja: "置き場所" })}
              </div>
              <div className="text-[0.85rem]">{t(caller.delivered)}</div>
            </div>
          </div>
        </div>
        <div className="perforated w-3" aria-hidden />
        <div className="col-span-full flex items-center justify-between gap-4 border-t border-[var(--line)] bg-[var(--sunk)] px-5 py-3 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:w-36 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l sm:text-center">
          <div>
            <div className="text-[0.72rem] text-[var(--muted)]">
              {caller.seconds === null
                ? t({ en: "Rotation", ja: "更新" })
                : t({ en: "Expires in", ja: "失効まで" })}
            </div>
            <div className="font-mono text-2xl font-semibold text-[var(--deny)] tabular-nums">
              {caller.seconds === null ? t({ en: "auto", ja: "自動" }) : formatLeft(left)}
            </div>
          </div>
          {caller.seconds !== null && (
            <div className="text-[0.72rem] text-[var(--muted)]">
              {t({ en: "of", ja: "発行時" })} {formatDuration(caller.seconds)}
            </div>
          )}
        </div>
        <span
          aria-hidden
          className="stamp-in pointer-events-none absolute top-[44%] right-6 rounded-md border-[3px] px-2 py-0.5 font-display text-lg font-bold text-[var(--deny)] opacity-80 sm:right-44"
          style={{ borderColor: "var(--deny)" }}
        >
          {t({ en: "TEMPORARY", ja: "一時発行" })}
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{t(caller.durationNote)}</p>
    </div>
  );
}
