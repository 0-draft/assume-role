import { useId, useMemo, useState } from "react";
import { Section } from "@/components/ui";
import { NAV, chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { searchTerms } from "./terms";

export function GlossarySection() {
  const { t } = useLang();
  const inputId = useId();
  const [q, setQ] = useState("");
  const shown = useMemo(() => searchTerms(q), [q]);

  return (
    <Section
      id="glossary"
      index={chapter("glossary")}
      title={{ en: "Glossary", ja: "用語集" }}
      lede={{
        en: "Every term on this page in one or two sentences, with a link back to the chapter that draws it.",
        ja: "このページに出てくる用語を 1〜2 文で。図解している章へのリンク付き。",
      }}
    >
      <div className="max-w-md">
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
        <p className="mt-1.5 text-xs text-[var(--muted)]" aria-live="polite">
          {t({ en: `${shown.length} terms`, ja: `${shown.length} 件` })}
        </p>
      </div>
      <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {shown.map((term) => {
          const nav = NAV.find((n) => n.id === term.chapter);
          return (
            <div key={term.term} className="border-t border-[var(--line)] pt-3">
              <dt className="font-mono text-[0.95rem] font-semibold">{term.term}</dt>
              <dd className="mt-1 text-[0.95rem]">
                {rich(t(term.def))}{" "}
                {nav && (
                  <a
                    href={`#${nav.id}`}
                    className="text-sm whitespace-nowrap text-[var(--sts)] underline underline-offset-2"
                  >
                    {t(nav.label)}
                  </a>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}
