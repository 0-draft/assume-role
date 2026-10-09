import { useState, type KeyboardEvent } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { useNarrow } from "@/hooks/useNarrow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Code } from "./index";
import { actorVar, type Actor } from "@/lib/actor";
import { rich } from "@/lib/rich";

export interface Lane {
  id: string;
  label: L;
  actor: Actor;
  /** Second line under the lane name, e.g. a hostname. */
  sub?: string;
}

export interface Message {
  from: string;
  to: string;
  /** What travels on the wire, short: `PUT /latest/api/token`. */
  label: L;
  /** Caption shown under the diagram when this step is current. */
  detail: L;
  /** Optional real payload for this step. */
  payload?: { label: string; body: string };
  /** Dashed arrow for responses. */
  reply?: boolean;
}

/**
 * A step-through sequence diagram. Lanes are columns on wide screens and
 * stacked chips on phones; each Next reveals one message and sends a token
 * along it. Every step sets the full visual state, so skipping around never
 * leaves the picture half-drawn.
 */
export function Sequence({
  lanes,
  steps,
  ariaLabel,
}: {
  lanes: Lane[];
  steps: Message[];
  ariaLabel: L;
}) {
  const { t } = useLang();
  const narrow = useNarrow();
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const last = steps.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));
  const col = (id: string) => lanes.findIndex((l) => l.id === id);
  const x = (id: string) => ((col(id) + 0.5) / lanes.length) * 100;
  const laneOf = (id: string) => lanes[col(id)];
  const cur = steps[i];

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(last);
    }
  };

  return (
    <div onKeyDown={onKey} role="group" aria-label={t(ariaLabel)}>
      {narrow ? (
        <ol className="space-y-2">
          {steps.map((s, n) => {
            const a = laneOf(s.from);
            const b = laneOf(s.to);
            return (
              <li
                key={n}
                className="rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: n === i ? actorVar(a.actor) : "var(--line)",
                  borderStyle: n > i ? "dashed" : "solid",
                  background: n > i ? "var(--sunk)" : "var(--surface)",
                }}
              >
                <div className="flex flex-wrap items-center gap-1 text-xs font-semibold">
                  <span className="tabular-nums text-[var(--muted)]">{n + 1}.</span>
                  <span style={{ color: actorVar(a.actor) }}>{t(a.label)}</span>
                  <span aria-hidden className="text-[var(--muted)]">
                    {s.reply ? "⇠" : "⇢"}
                  </span>
                  <span className="sr-only">{t({ en: "to", ja: "から" })}</span>
                  <span style={{ color: actorVar(b.actor) }}>{t(b.label)}</span>
                </div>
                <div className="mt-0.5 font-mono text-[0.8rem] break-words">
                  {t(s.label)}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div tabIndex={0} className="scroll-x">
          <div className="relative min-w-[640px]" aria-hidden>
            {/* Lane heads */}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}
            >
              {lanes.map((l) => (
                <div
                  key={l.id}
                  className="mx-auto w-full max-w-44 rounded-xl border-2 px-2 py-2 text-center"
                  style={{
                    borderColor: actorVar(l.actor),
                    background: `color-mix(in oklab, ${actorVar(l.actor)} 9%, var(--surface))`,
                  }}
                >
                  <div className="text-sm leading-tight font-bold">{t(l.label)}</div>
                  {l.sub && (
                    <div className="mt-0.5 truncate font-mono text-[0.68rem] text-[var(--muted)]">
                      {l.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Lifelines + messages */}
            <div className="relative mt-1" style={{ height: steps.length * 46 + 16 }}>
              {lanes.map((l) => (
                <div
                  key={l.id}
                  className="absolute top-0 bottom-0 border-l-2 border-dashed"
                  style={{
                    left: `${x(l.id)}%`,
                    borderColor: `color-mix(in oklab, ${actorVar(l.actor)} 40%, transparent)`,
                  }}
                />
              ))}
              {steps.map((s, n) => {
                const a = x(s.from);
                const b = x(s.to);
                const self = s.from === s.to;
                const left = self ? a : Math.min(a, b);
                const width = self ? 100 / lanes.length / 2.4 : Math.abs(b - a);
                const color = actorVar(laneOf(s.from).actor);
                const rtl = !self && b < a;
                const visible = n <= i;
                const active = n === i;
                return (
                  <div
                    key={n}
                    className="absolute transition-opacity duration-300"
                    style={{
                      top: n * 46 + 8,
                      left: `${left}%`,
                      width: `${width}%`,
                      height: 40,
                      opacity: visible ? 1 : 0,
                      visibility: visible ? "visible" : "hidden",
                    }}
                  >
                    <div
                      className="absolute right-0 left-0 truncate px-2 text-center font-mono text-[0.74rem] font-semibold"
                      style={{ top: 0, color: active ? "var(--ink)" : "var(--muted)" }}
                    >
                      {t(s.label)}
                    </div>
                    {self ? (
                      <div
                        className="absolute left-0 rounded-r-lg border-2 border-l-0"
                        style={{
                          top: 18,
                          width: "100%",
                          height: 16,
                          borderColor: color,
                          opacity: active ? 1 : 0.45,
                        }}
                      />
                    ) : (
                      <>
                        <div
                          className="absolute right-1 left-1"
                          style={{
                            top: 27,
                            borderTop: `2px ${s.reply ? "dashed" : "solid"} ${color}`,
                            opacity: active ? 1 : 0.45,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            top: 22,
                            [rtl ? "left" : "right"]: 0,
                            width: 0,
                            height: 0,
                            borderTop: "6px solid transparent",
                            borderBottom: "6px solid transparent",
                            [rtl ? "borderRight" : "borderLeft"]: `9px solid ${color}`,
                            opacity: active ? 1 : 0.45,
                          }}
                        />
                      </>
                    )}
                    {active && !reduced && !self && (
                      <span
                        key={i}
                        className="absolute size-3 rounded-full shadow"
                        style={{
                          top: 22,
                          background: color,
                          boxShadow: `0 0 0 4px color-mix(in oklab, ${color} 30%, transparent)`,
                          animation: `seq-${rtl ? "rtl" : "ltr"} 650ms cubic-bezier(.3,.7,.2,1) both`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => go(i - 1)}
          aria-disabled={i === 0}
          className="min-h-10 rounded-lg border border-[var(--line)] px-4 py-1.5 text-sm font-bold aria-disabled:opacity-40"
        >
          {t({ en: "Back", ja: "戻る" })}
        </button>
        <button
          type="button"
          onClick={() => (i === last ? setI(0) : go(i + 1))}
          className="min-h-10 rounded-lg bg-[var(--sts)] px-4 py-1.5 text-sm font-bold text-[var(--on-color)]"
        >
          {i === last
            ? t({ en: "Start over", ja: "最初から" })
            : t({ en: "Next", ja: "次へ" })}
        </button>
        <span className="text-sm font-semibold text-[var(--muted)] tabular-nums">
          {t({ en: "Step", ja: "ステップ" })} {i + 1} / {steps.length}
        </span>
        <span className="hidden text-xs text-[var(--muted)] sm:inline">
          {t({ en: "Arrow keys work too.", ja: "矢印キーでも操作できます。" })}
        </span>
      </div>
      <div className="mt-3 space-y-3" aria-live="polite">
        <p className="prose-col">
          <span
            className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold text-[var(--on-color)]"
            style={{ background: actorVar(laneOf(cur.from).actor) }}
          >
            {i + 1}
          </span>
          {rich(t(cur.detail))}
        </p>
        {cur.payload && <Code label={cur.payload.label}>{cur.payload.body}</Code>}
      </div>
    </div>
  );
}
