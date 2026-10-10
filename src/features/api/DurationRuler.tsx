import type { Lang } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { DURATIONS, TICKS, formatDuration, logPos } from "./duration";
import { FAMILIES } from "./ops";

const pct = (s: number) => `${(logPos(s) * 100).toFixed(2)}%`;

function Axis({ lang }: { lang: Lang }) {
  return (
    <div className="relative h-5 text-[0.7rem] text-[var(--muted)]" aria-hidden>
      {TICKS.map((s, i) => (
        <span
          key={s}
          // 12 h and 36 h sit close together on a phone; keep the outer one there.
          className={`absolute top-0 whitespace-nowrap tabular-nums ${s === 43200 ? "hidden sm:inline" : ""}`}
          style={{
            left: pct(s),
            transform:
              i === 0
                ? "none"
                : i === TICKS.length - 1
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          {formatDuration(s, lang)}
        </span>
      ))}
    </div>
  );
}

/**
 * Every issuing call on one log-scale axis from 1 minute to 36 hours. A bar is
 * the allowed range, a ring is the default. Numbers are always printed too, so
 * the chart never has to be read by eye alone.
 */
export function DurationRuler() {
  const { t, lang } = useLang();
  const colorOf = (f: string) => FAMILIES.find((x) => x.id === f)!.color;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-8 rounded-full bg-[var(--muted)] opacity-60" />
          {t({ en: "allowed range", ja: "指定できる範囲" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border-[3px] border-[var(--ink)] bg-[var(--surface)]" />
          {t({ en: "default", ja: "デフォルト" })}
        </span>
        <span>{t({ en: "log scale", ja: "対数目盛" })}</span>
      </div>
      {/* One shared axis. On phones it sticks under the header while the rows scroll. */}
      <div className="sticky top-14 z-10 -mx-1 mb-2 bg-[var(--surface)] px-1 py-1 sm:static sm:mx-0 sm:grid sm:grid-cols-[15rem_1fr] sm:gap-4 sm:px-0">
        <span className="hidden sm:block" />
        <Axis lang={lang} />
      </div>
      <ul className="space-y-3">
        {DURATIONS.map((r, i) => {
          const color = colorOf(r.family);
          const left = logPos(r.min);
          const right = logPos(r.max);
          const summary =
            r.def !== undefined
              ? `${formatDuration(r.min, lang)} / ${formatDuration(r.def, lang)} / ${formatDuration(r.max, lang)}`
              : `${formatDuration(r.min, lang)} – ${formatDuration(r.max, lang)}`;
          return (
            <li
              key={i}
              className="grid gap-1 sm:grid-cols-[15rem_1fr] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <div className="font-mono text-[0.8rem] font-semibold [overflow-wrap:anywhere]">
                  {r.op}
                  {r.variant && (
                    <span className="ml-1 font-sans font-normal text-[var(--muted)]">
                      ({t(r.variant)})
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--muted)] tabular-nums">
                  {r.def !== undefined
                    ? t({ en: "min / default / max: ", ja: "最短 / デフォルト / 上限: " })
                    : t({ en: "range: ", ja: "範囲: " })}
                  {summary}
                </div>
                {r.note && <div className="text-xs text-[var(--muted)]">{t(r.note)}</div>}
              </div>
              <div>
                <div className="relative h-6" aria-hidden>
                  {TICKS.map((s) => (
                    <span
                      key={s}
                      className="absolute top-0 bottom-0 w-px bg-[var(--line)]"
                      style={{ left: pct(s) }}
                    />
                  ))}
                  <span
                    className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${left * 100}%`,
                      width: `max(10px, ${(right - left) * 100}%)`,
                      background: color,
                      opacity: 0.85,
                    }}
                  />
                  {r.def !== undefined && (
                    <span
                      className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-[var(--surface)]"
                      style={{ left: pct(r.def), borderColor: "var(--ink)" }}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
