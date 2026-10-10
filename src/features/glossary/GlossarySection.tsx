import { useId, useMemo, useState, type ReactNode } from "react";
import { Section } from "@/components/ui";
import { NAV, chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { searchTerms, type ChapterId } from "./terms";

/** Accent per chapter, reusing the actor hue that chapter is mostly about. */
const ACCENT: Record<ChapterId, string> = {
  why: "var(--caller)",
  endpoints: "var(--sts)",
  api: "var(--sts)",
  paths: "var(--idp)",
  sessions: "var(--role)",
  trust: "var(--idp)",
  ops: "var(--resource)",
  errors: "var(--deny)",
};

export function GlossarySection() {
  const { t } = useLang();
  const inputId = useId();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<ChapterId | null>(null);
  const found = useMemo(() => searchTerms(q), [q]);
  const shown = only ? found.filter((x) => x.chapter === only) : found;

  const chapters = NAV.filter((n) => n.id in ACCENT).map((n) => ({
    id: n.id as ChapterId,
    label: n.label,
    count: found.filter((x) => x.chapter === n.id).length,
  }));

  return (
    <Section
      id="glossary"
      index={chapter("glossary")}
      title={{ en: "Glossary", ja: "用語集" }}
      lede={{
        en: "Every term on this page in one or two sentences, with a link back to the chapter that draws it.",
        ja: "このページに出てくる用語を 1〜2 文で説明します。図解している章へのリンク付きです。",
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="w-full max-w-sm">
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-semibold text-[var(--muted)]"
          >
            {t({ en: "Search terms", ja: "用語を検索" })}
          </label>
          <input
            id={inputId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t({
              en: "e.g. chaining, IRSA, v2Token",
              ja: "例: チェーン、IRSA、v2Token",
            })}
            className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"
          />
        </div>
        <div
          role="group"
          aria-label={t({ en: "Filter by chapter", ja: "章で絞り込む" })}
          className="flex flex-wrap gap-1.5"
        >
          <FilterChip
            on={only === null}
            onClick={() => setOnly(null)}
            color="var(--ink)"
            count={found.length}
          >
            {t({ en: "All", ja: "すべて" })}
          </FilterChip>
          {chapters.map((c) => (
            <FilterChip
              key={c.id}
              on={only === c.id}
              onClick={() => setOnly(only === c.id ? null : c.id)}
              color={ACCENT[c.id]}
              count={c.count}
            >
              {t(c.label)}
            </FilterChip>
          ))}
        </div>
      </div>
      <p className="-mt-6 text-xs text-[var(--muted)]" aria-live="polite">
        {t({ en: `${shown.length} terms`, ja: `${shown.length} 件` })}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-[var(--muted)]">
          {t({
            en: "No term matches. Try the API name or a shorter word.",
            ja: "該当する用語がありません。API 名や短い語で試してください。",
          })}
        </p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((term) => {
            const nav = NAV.find((n) => n.id === term.chapter);
            const color = ACCENT[term.chapter];
            return (
              <div
                key={term.term}
                className="flex flex-col rounded-xl border border-t-4 border-[var(--line)] bg-[var(--surface)] p-4"
                style={{ borderTopColor: color }}
              >
                <dt className="font-mono text-[0.95rem] font-semibold">{term.term}</dt>
                <dd className="mt-1.5 flex-1 text-[0.92rem]">{rich(t(term.def))}</dd>
                {nav && (
                  <dd className="mt-3">
                    <a
                      href={`#${nav.id}`}
                      className="inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold"
                      style={{ borderColor: color, color }}
                    >
                      <span className="font-mono tabular-nums">
                        {String(chapter(nav.id)).padStart(2, "0")}
                      </span>
                      {t(nav.label)}
                    </a>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      )}
    </Section>
  );
}

function FilterChip({
  on,
  onClick,
  color,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={count === 0 && !on}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: on ? color : "var(--line)",
        background: on
          ? `color-mix(in oklab, ${color} 12%, var(--surface))`
          : "var(--surface)",
        color: on ? "var(--ink)" : "var(--muted)",
      }}
    >
      {children}
      <span className="font-mono text-xs tabular-nums">{count}</span>
    </button>
  );
}
