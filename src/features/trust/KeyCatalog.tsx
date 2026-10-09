import { useId, useState } from "react";
import { Figure, Segmented } from "@/components/ui";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { filterCatalog, type KeyFamily } from "./catalog";

const FAMILY: Record<KeyFamily, { color: string; label: L }> = {
  sts: { color: "var(--sts)", label: { en: "sts:", ja: "sts:" } },
  federation: {
    color: "var(--idp)",
    label: { en: "federation", ja: "フェデレーション" },
  },
  global: { color: "var(--role)", label: { en: "aws: global", ja: "aws: グローバル" } },
};

export function KeyCatalog() {
  const { t } = useLang();
  const id = useId();
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<KeyFamily | "all">("all");
  const rows = filterCatalog(q, family);

  return (
    <Figure
      title={{
        en: "Condition keys you will write in trust policies",
        ja: "信頼ポリシーで書くことになる条件キー",
      }}
      hint={{
        en: "Filter by family or search any word: key name, type, operation or meaning.",
        ja: "種類で絞り込むか、キー名・型・API・意味のどれでも検索できます。",
      }}
    >
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-0 flex-1 text-sm" htmlFor={id}>
          <span className="mb-1 block font-semibold text-[var(--muted)]">
            {t({ en: "Search", ja: "検索" })}
          </span>
          <input
            id={id}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ExternalId, MFA, GitHub, Bool…"
            className="min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          />
        </label>
        <Segmented<KeyFamily | "all">
          label={{ en: "Family", ja: "種類" }}
          value={family}
          onChange={setFamily}
          options={[
            { value: "all", label: { en: "All", ja: "すべて" } },
            { value: "sts", label: FAMILY.sts.label },
            { value: "federation", label: FAMILY.federation.label },
            { value: "global", label: FAMILY.global.label },
          ]}
        />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]" aria-live="polite">
        {t({ en: `${rows.length} keys`, ja: `${rows.length} 件` })}
      </p>
      <ul className="mt-2 grid gap-2 md:grid-cols-2">
        {rows.map((k) => (
          <li
            key={k.key}
            className="rounded-xl border border-l-4 border-[var(--line)] bg-[var(--surface)] px-3 py-2"
            style={{ borderLeftColor: FAMILY[k.family].color }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <code className="font-mono text-[0.82rem] font-semibold break-all">
                {k.key}
              </code>
              <span className="font-mono text-xs text-[var(--muted)]">{k.type}</span>
            </div>
            <p className="mt-1 text-sm">{t(k.meaning)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t(k.when)}</p>
          </li>
        ))}
      </ul>
      {rows.length === 0 && (
        <p className="mt-2 text-sm">
          {t({
            en: "No key matches. Try a shorter word.",
            ja: "一致するキーがありません。もっと短い語で試してください。",
          })}
        </p>
      )}
    </Figure>
  );
}
