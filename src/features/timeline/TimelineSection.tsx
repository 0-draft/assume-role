import { useMemo, useState } from "react";
import { Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { useNarrow } from "@/hooks/useNarrow";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { CATEGORIES, EVENTS, type Category, type TimelineEvent } from "./events";

const colorOf = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.color ?? "var(--muted)";

export function TimelineSection() {
  const { t } = useLang();
  const narrow = useNarrow();
  const [on, setOn] = useState<Set<Category>>(() => new Set(CATEGORIES.map((c) => c.id)));

  const toggle = (c: Category) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(c)) {
        if (next.size > 1) next.delete(c);
      } else next.add(c);
      return next;
    });

  const years = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of EVENTS) {
      if (!on.has(e.category)) continue;
      const y = e.date.slice(0, 4);
      map.set(y, [...(map.get(y) ?? []), e]);
    }
    return [...map.entries()];
  }, [on]);

  return (
    <Section
      id="timeline"
      index={chapter("timeline")}
      title={{ en: "Fifteen years of STS", ja: "STS の 15 年" }}
      lede={{
        en: "Most of the confusion about STS comes from behaviour that changed under people's feet: the global endpoint, SDK defaults, token sizes. Here is when each piece arrived.",
        ja: "STS がわかりにくいのは、グローバルエンドポイント・SDK の既定値・トークンサイズなど、使っているうちに挙動が変わってきたから。どれがいつ入ったかを並べます。",
      }}
    >
      <div
        role="group"
        aria-label={t({ en: "Show categories", ja: "表示するカテゴリ" })}
        className="flex flex-wrap gap-2"
      >
        {CATEGORIES.map((c) => {
          const active = on.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(c.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold"
              style={{
                borderColor: active ? c.color : "var(--line)",
                color: active ? "var(--ink)" : "var(--muted)",
                background: active
                  ? `color-mix(in oklab, ${c.color} 12%, var(--surface))`
                  : "var(--surface)",
              }}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: active ? c.color : "var(--line)" }}
              />
              {t(c.label)}
            </button>
          );
        })}
      </div>

      {narrow ? (
        <ol className="relative ml-2 border-l-2 border-[var(--line)] pl-5">
          {years.map(([year, events]) => (
            <li key={year} className="mb-6">
              <h3 className="-ml-[1.95rem] mb-2 flex items-center gap-2 font-display text-xl font-bold">
                <span aria-hidden className="size-3 rounded-full bg-[var(--ink)]" />
                {year}
              </h3>
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.date + e.title.en}>
                    <EventCard e={e} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <div
          className="scroll-x pb-3"
          tabIndex={0}
          aria-label={t({ en: "Timeline, scrolls sideways", ja: "年表 (横スクロール)" })}
        >
          <ol className="flex min-w-max gap-4">
            {years.map(([year, events]) => (
              <li key={year} className="w-64 shrink-0">
                <h3 className="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-1 font-display text-2xl font-bold">
                  {year}
                </h3>
                <ul className="mt-3 space-y-2">
                  {events.map((e) => (
                    <li key={e.date + e.title.en}>
                      <EventCard e={e} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Section>
  );
}

function EventCard({ e }: { e: TimelineEvent }) {
  const { t } = useLang();
  const color = colorOf(e.category);
  return (
    <article
      className="rounded-xl border border-l-4 border-[var(--line)] bg-[var(--surface)] p-3"
      style={{ borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--muted)]">
        <time dateTime={e.date}>{e.date}</time>
        {e.unverified && (
          <span className="rounded border border-dashed border-[var(--muted)] px-1">
            {t({ en: "unverified", ja: "未確認" })}
          </span>
        )}
      </div>
      <h4 className="mt-1 font-semibold leading-snug">{t(e.title)}</h4>
      <p className="mt-1 text-sm text-[var(--muted)]">{rich(t(e.detail))}</p>
      {e.source && (
        <div className="mt-1.5 text-xs">
          <Src href={e.source}>{t({ en: "Source", ja: "出典" })}</Src>
        </div>
      )}
    </article>
  );
}
