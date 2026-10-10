import { useEffect, useState, type PointerEvent } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { softBreaks } from "@/lib/rich";
import { useLang } from "@/i18n/useLang";
import { Segmented } from "@/components/ui";
import { CALLERS, formatDuration, formatLeft, type Caller } from "./callers";

export function Hero() {
  const { t, lang } = useLang();
  const [id, setId] = useState(CALLERS[0].id);
  const caller = CALLERS.find((c) => c.id === id) ?? CALLERS[0];

  return (
    <section
      aria-labelledby="hero-title"
      className="grid gap-x-10 gap-y-6 py-10 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:grid-rows-[auto_auto_1fr]"
    >
      {/* Phones read headline, pass, picker, then the lede, so the pass is on the
          first screen; wide screens put the pass beside all three. */}
      <div className="lg:col-start-1 lg:row-start-1">
        <h1
          id="hero-title"
          className={`leading-[1.06] font-bold [text-wrap:pretty] ${lang === "ja" ? "text-[1.8rem] sm:text-5xl lg:text-[3.1rem]" : "text-[2.6rem] sm:text-6xl lg:text-[3.6rem] xl:text-6xl"}`}
        >
          {lang === "ja" ? (
            <span className="break-keep">
              自分で打ち込んでいない
              <wbr />
              AWS の認証情報は、
              <wbr />
              ほぼすべて
              <wbr /> STS が発行している。
            </span>
          ) : (
            "Almost every AWS credential you didn't type was printed by STS."
          )}
        </h1>
      </div>
      <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center">
        <Pass key={caller.id} caller={caller} />
      </div>
      <div className="lg:col-start-1 lg:row-start-3">
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
      <div className="lg:col-start-1 lg:row-start-2">
        <p className="prose-col text-base text-[var(--muted)] sm:text-lg">
          {t({
            en: "The AWS Security Token Service hands out short-lived keys to developers, CI jobs, EC2 instances, employees and admins. It has 11 APIs, a global endpoint that no longer works the way it used to, and dozens of regional, FIPS and IPv6 hostnames. This page draws all of it.",
            ja: "AWS Security Token Service は、開発者・CI ジョブ・EC2・社員・管理者に短命のキーを配る窓口です。API は 11 個あり、グローバルエンドポイントの挙動はかつてと変わり、リージョン・FIPS・IPv6 のホスト名は数十個にのぼります。このページはそれを全部図にします。",
          })}
        </p>
      </div>
    </section>
  );
}

function Pass({ caller }: { caller: Caller }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const [left, setLeft] = useState(caller.seconds ?? 0);
  const [tilt, setTilt] = useState(135);

  useEffect(() => {
    if (caller.seconds === null) return;
    const started = Date.now();
    const total = caller.seconds;
    const tick = setInterval(() => setLeft(total - (Date.now() - started) / 1000), 1000);
    return () => clearInterval(tick);
  }, [caller.seconds]);

  // The foil seal catches the light as the pointer moves over the pass.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setTilt(Math.round(90 + x * 180 + y * 90));
  };

  const rows: [string, string][] = [
    ["AccessKeyId", caller.accessKeyId],
    ["SecretAccessKey", "wJalrXUtnFEMI/K7MDENG/bPxRfi…"],
    ["SessionToken", "AQoEXAMPLEH4aoAH0gNCAPy…"],
    [t({ en: "Identity", ja: "ID" }), caller.arn],
  ];
  const share = caller.seconds === null ? 1 : Math.max(0, left / caller.seconds);

  return (
    <div>
      <div
        role="img"
        aria-label={t({
          en: `Temporary credential issued by ${caller.api} for ${caller.who.en}`,
          ja: `${caller.api} が${caller.who.ja}に発行した一時認証情報`,
        })}
        onPointerMove={onMove}
        className="print-in guilloche relative grid overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow)] sm:grid-cols-[1fr_auto_auto]"
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
          <div
            className={`mt-2 font-mono leading-tight font-semibold ${caller.api.length > 20 ? "text-xl sm:text-[1.4rem]" : "text-2xl sm:text-[1.7rem]"}`}
          >
            sts:{softBreaks(caller.api)}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--caller)]">{t(caller.who)}</span>
            {t({ en: ", holding ", ja: "の手元に " })}
            {t(caller.holds)}
          </div>
          <dl className="mt-5 space-y-2.5">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
                <dt className="font-mono text-[0.68rem] text-[var(--muted)]">{k}</dt>
                <dd className="font-mono text-[0.82rem]">{softBreaks(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-3 border-t border-dashed border-[var(--line)] pt-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[0.72rem] text-[var(--muted)]">
                {t({ en: "Asked at", ja: "問い合わせ先" })}
              </div>
              <div className="font-mono text-[0.8rem]">{softBreaks(caller.endpoint)}</div>
            </div>
            <div>
              <div className="text-[0.72rem] text-[var(--muted)]">
                {t({ en: "Ends up in", ja: "置き場所" })}
              </div>
              <div className="text-[0.85rem]">{t(caller.delivered)}</div>
            </div>
          </div>
        </div>
        <div className="perforated hidden w-3 sm:block" aria-hidden />
        <div className="flex items-center justify-between gap-4 border-t border-dashed border-[var(--line)] bg-[color-mix(in_oklab,var(--sunk)_70%,transparent)] px-5 py-4 sm:w-40 sm:flex-col sm:justify-center sm:gap-5 sm:border-t-0 sm:px-4 sm:text-center">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-full font-display text-sm font-bold text-[#2a1d05] shadow-inner"
            style={{
              background: `conic-gradient(from ${tilt}deg, #f6e7b0, #d9a441, #f3c9d6, #b9d7f0, #c8efd2, #f6e7b0, #d9a441, #f6e7b0)`,
              transition: reduced ? undefined : "background 120ms linear",
            }}
          >
            <span className="grid size-11 place-items-center rounded-full border border-[#2a1d05]/30">
              STS
            </span>
          </span>
          <div>
            <div className="text-[0.72rem] text-[var(--muted)]">
              {caller.seconds === null
                ? t({ en: "Rotation", ja: "更新" })
                : t({ en: "Expires in", ja: "失効まで" })}
            </div>
            <div className="font-mono text-2xl font-semibold text-[var(--deny)] tabular-nums">
              {caller.seconds === null ? t({ en: "auto", ja: "自動" }) : formatLeft(left)}
            </div>
            <div className="mx-auto mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-[var(--deny)]"
                style={{ width: `${share * 100}%` }}
              />
            </div>
            {caller.seconds !== null && (
              <div className="mt-1 text-[0.72rem] text-[var(--muted)]">
                {t({ en: "issued for", ja: "有効期間" })} {formatDuration(caller.seconds)}
              </div>
            )}
          </div>
          <span
            aria-hidden
            className="stamp-in rounded-md border-[3px] border-[var(--deny)] px-2 py-0.5 font-display text-base font-bold text-[var(--deny)]"
          >
            {t({ en: "Temporary", ja: "期限付き" })}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {t(caller.durationNote)}{" "}
        <a
          href={caller.next.href}
          className="font-semibold text-[var(--sts)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {t(caller.next.label)}
        </a>
      </p>
    </div>
  );
}
