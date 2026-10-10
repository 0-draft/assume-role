import { Fragment, useMemo, useRef, useState } from "react";
import { Section, Src } from "@/components/ui";
import { chapter, NAV } from "@/data/nav";
import { useNarrow } from "@/hooks/useNarrow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import {
  CATEGORIES,
  EVENTS,
  chapterOf,
  softBreakPoints,
  type Category,
  type TimelineEvent,
} from "./events";

const colorOf = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.color ?? "var(--muted)";

/** Width of one slot on the desktop axis. Cards span two slots, alternating sides. */
const SLOT = 132;

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

  const events = useMemo(() => EVENTS.filter((e) => on.has(e.category)), [on]);

  return (
    <Section
      id="timeline"
      index={chapter("timeline")}
      title={{ en: "Fifteen years of STS", ja: "STS の 15 年" }}
      lede={{
        en: "Most of the confusion about STS comes from behaviour that changed under people's feet: the global endpoint, SDK defaults, token sizes. Here is when each piece arrived, and where on this page it is explained.",
        ja: "STS がわかりにくいのは、グローバルエンドポイントや SDK の既定値、トークンサイズなど、使っているうちに挙動が変わってきたからです。どれがいつ入ったのか、このページのどこで説明しているのかを並べました。",
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

      {narrow ? <VerticalTimeline events={events} /> : <AxisTimeline events={events} />}
    </Section>
  );
}

function VerticalTimeline({ events }: { events: TimelineEvent[] }) {
  const years = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const y = e.date.slice(0, 4);
      map.set(y, [...(map.get(y) ?? []), e]);
    }
    return [...map.entries()];
  }, [events]);
  return (
    <ol className="relative ml-2 border-l-2 border-[var(--line)] pl-5">
      {years.map(([year, list]) => (
        <li key={year} className="mb-6">
          <h3 className="mb-2 -ml-[1.95rem] flex items-center gap-2 font-display text-xl font-bold">
            <span aria-hidden className="size-3 rounded-full bg-[var(--ink)]" />
            {year}
          </h3>
          <ul className="space-y-2">
            {list.map((e) => (
              <li key={e.date + e.title.en}>
                <EventCard e={e} />
              </li>
            ))}
          </ul>
        </li>
      ))}
      <li className="flex items-center gap-2 font-display text-lg font-bold text-[var(--deny)]">
        <span aria-hidden className="-ml-[1.6rem] size-3 rounded-full bg-[var(--deny)]" />
        <NowLabel />
      </li>
    </ol>
  );
}

function NowLabel() {
  const { t } = useLang();
  return (
    <span>{t({ en: "You are here: October 2026", ja: "現在地: 2026 年 10 月" })}</span>
  );
}

/**
 * Desktop: one horizontal axis in date order (evenly spaced, not to scale, so
 * the busy years stay legible). Cards alternate above and below the line and
 * span two slots, so neighbours on the same side never collide.
 */
function AxisTimeline({ events }: { events: TimelineEvent[] }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft < 8,
      end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8,
    });
  };

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({
      left: dir * el.clientWidth * 0.8,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const cols = events.length + 2;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="mr-auto text-sm text-[var(--muted)]">
          {t({
            en: "Scroll sideways, or use the buttons. Each card links to the chapter that explains it.",
            ja: "横にスクロールするか、ボタンで移動できます。各カードから解説している章に飛べます。",
          })}
        </span>
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-disabled={edges.start}
          className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold aria-disabled:opacity-40"
        >
          {t({ en: "Earlier", ja: "前へ" })}
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-disabled={edges.end}
          className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold aria-disabled:opacity-40"
        >
          {t({ en: "Later", ja: "次へ" })}
        </button>
      </div>
      <div className="relative">
        <div
          ref={scroller}
          onScroll={update}
          tabIndex={0}
          aria-label={t({ en: "Timeline, scrolls sideways", ja: "年表 (横スクロール)" })}
          className="scroll-x rounded-2xl border border-[var(--line)] bg-[var(--sunk)] px-4 py-5"
        >
          <ol
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${SLOT}px)`,
              gridTemplateRows: "auto 3.25rem auto",
            }}
          >
            {/* The axis itself */}
            <li
              aria-hidden
              className="pointer-events-none self-center border-t-2 border-[var(--ink)]"
              style={{ gridColumn: `1 / ${cols + 1}`, gridRow: 2 }}
            />
            {events.map((e, i) => {
              const above = i % 2 === 0;
              const year = e.date.slice(0, 4);
              const newYear = i === 0 || events[i - 1].date.slice(0, 4) !== year;
              const color = colorOf(e.category);
              return (
                <Fragment key={e.date + e.title.en}>
                  <li
                    className={`relative pb-6 ${above ? "self-end" : "self-start pt-6 pb-0"}`}
                    style={{
                      gridColumn: `${i + 1} / span 2`,
                      gridRow: above ? 1 : 3,
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute left-3 w-0.5"
                      style={{
                        background: color,
                        ...(above
                          ? { bottom: 0, height: "1.5rem" }
                          : { top: 0, height: "1.5rem" }),
                      }}
                    />
                    <div className="w-[15.5rem]">
                      <EventCard e={e} compact />
                    </div>
                  </li>
                  <li
                    aria-hidden
                    className="relative"
                    style={{ gridColumn: i + 1, gridRow: 2 }}
                  >
                    <span
                      className="absolute top-1/2 left-3 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--sunk)]"
                      style={{ background: color }}
                    />
                    {newYear && (
                      <span
                        className={`absolute left-6 font-display text-lg leading-none font-bold tabular-nums ${above ? "top-[calc(50%+0.35rem)]" : "bottom-[calc(50%+0.35rem)]"}`}
                      >
                        {year}
                      </span>
                    )}
                  </li>
                </Fragment>
              );
            })}
            <li
              className="relative"
              style={{ gridColumn: `${events.length + 1} / span 2`, gridRow: 2 }}
            >
              <span
                aria-hidden
                className={`absolute top-1/2 left-3 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--deny)] ${reduced ? "" : "animate-pulse"}`}
              />
              <span className="absolute bottom-[calc(50%+0.5rem)] left-6 font-display text-sm font-bold whitespace-nowrap text-[var(--deny)]">
                <NowLabel />
              </span>
            </li>
          </ol>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-px left-px w-10 rounded-l-2xl bg-gradient-to-r from-[var(--sunk)] to-transparent transition-opacity"
          style={{ opacity: edges.start ? 0 : 1 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-px right-px w-10 rounded-r-2xl bg-gradient-to-l from-[var(--sunk)] to-transparent transition-opacity"
          style={{ opacity: edges.end ? 0 : 1 }}
        />
      </div>
    </div>
  );
}

function Title({ text }: { text: string }) {
  const parts = softBreakPoints(text);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </>
  );
}

function EventCard({ e, compact = false }: { e: TimelineEvent; compact?: boolean }) {
  const { t } = useLang();
  const color = colorOf(e.category);
  const ch = chapterOf(e);
  const nav = NAV.find((n) => n.id === ch);
  return (
    <article
      className="rounded-xl border border-l-4 border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]"
      style={{ borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--muted)]">
        <time dateTime={e.date}>{e.date}</time>
        {e.unverified && (
          <span className="rounded border border-dashed border-[var(--muted)] px-1">
            {t({ en: "unverified", ja: "未検証" })}
          </span>
        )}
      </div>
      <h3
        className={`mt-1 font-sans leading-snug font-semibold ${compact ? "text-[0.95rem]" : ""}`}
      >
        <Title text={t(e.title)} />
      </h3>
      <p className={`mt-1 text-[var(--muted)] ${compact ? "text-[0.82rem]" : "text-sm"}`}>
        {rich(t(e.detail))}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {nav && (
          <a
            href={`#${ch}`}
            className="inline-flex min-h-6 items-center rounded-full border px-2 font-semibold"
            style={{ borderColor: color, color }}
          >
            {t({ en: "Read: ", ja: "解説: " })}
            {t(nav.label)}
          </a>
        )}
        {e.source && <Src href={e.source}>{t({ en: "Source", ja: "出典" })}</Src>}
      </div>
    </article>
  );
}
