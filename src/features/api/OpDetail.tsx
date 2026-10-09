import { Code, Src } from "@/components/ui";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { OpBadges } from "./Badges";
import { DURATIONS, formatDuration } from "./duration";
import { FAMILIES, type Op } from "./ops";

/**
 * One operation drawn as the pass STS would print: the main body says what it
 * is and who may ask, the torn-off stub says how long the result lasts.
 */
export function OpDetail({ op }: { op: Op }) {
  const { t, lang } = useLang();
  const family = FAMILIES.find((f) => f.id === op.family)!;
  const rows = DURATIONS.filter((d) => d.op === op.id);
  const fields: [L, L][] = [
    [{ en: "Who can call", ja: "呼べる人" }, op.caller],
    [{ en: "Duration", ja: "有効期間" }, op.duration],
    [{ en: "MFA", ja: "MFA" }, op.mfa],
    [{ en: "Session policies", ja: "セッションポリシー" }, op.sessionPolicy],
    [{ en: "Session tags", ja: "セッションタグ" }, op.tags],
  ];
  if (op.restrictions)
    fields.push([{ en: "The result cannot", ja: "結果の制約" }, op.restrictions]);

  return (
    <article
      aria-labelledby={`op-${op.id}`}
      className="print-in overflow-hidden rounded-2xl border-2 shadow-[var(--shadow)]"
      style={{ borderColor: family.color }}
    >
      <div className="grid sm:grid-cols-[1fr_11rem]">
        <div className="guilloche p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`op-${op.id}`}
              className="font-mono text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl"
              style={{ color: family.color }}
            >
              {op.id}
            </h3>
            <OpBadges op={op} />
          </div>
          <p className="prose-col mt-2 text-[1.02rem]">{rich(t(op.purpose))}</p>
          <dl className="mt-4 grid gap-x-4 gap-y-3 text-[0.95rem] md:grid-cols-[9rem_1fr]">
            {fields.map(([k, v]) => (
              <div key={k.en} className="contents">
                <dt className="font-semibold text-[var(--muted)]">{t(k)}</dt>
                <dd className="prose-col">{rich(t(v))}</dd>
              </div>
            ))}
            <dt className="font-semibold text-[var(--muted)]">
              {t({ en: "Returns", ja: "返り値" })}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {op.returns.map((r) => (
                <code key={r} className="chip">
                  {r}
                </code>
              ))}
            </dd>
          </dl>
        </div>
        <aside
          className="flex flex-col justify-center gap-2 border-t-2 border-dashed p-4 sm:border-t-0 sm:border-l-2"
          style={{
            borderColor: `color-mix(in oklab, ${family.color} 45%, transparent)`,
            background: `color-mix(in oklab, ${family.color} 8%, var(--surface))`,
          }}
        >
          <span className="text-sm font-semibold text-[var(--muted)]">
            {rows.length
              ? t({ en: "Valid for", ja: "有効期間" })
              : t({ en: "Issues", ja: "発行するもの" })}
          </span>
          {rows.length ? (
            rows.map((r, i) => (
              <div key={i}>
                {r.variant && (
                  <div className="text-xs text-[var(--muted)]">{t(r.variant)}</div>
                )}
                <div className="font-display text-2xl leading-tight font-bold tabular-nums">
                  {r.def !== undefined
                    ? formatDuration(r.def, lang)
                    : `≤ ${formatDuration(r.max, lang)}`}
                </div>
                <div className="text-xs text-[var(--muted)] tabular-nums">
                  {r.def !== undefined ? t({ en: "default, ", ja: "デフォルト、" }) : ""}
                  {t({ en: "max ", ja: "上限 " })}
                  {formatDuration(r.max, lang)}
                </div>
              </div>
            ))
          ) : (
            <div className="font-display text-lg leading-tight font-bold">
              {t({ en: "No credentials, just answers", ja: "認証情報なし、答えだけ" })}
            </div>
          )}
        </aside>
      </div>
      <div className="space-y-3 border-t border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-2">
          <Code label="AWS CLI">{op.cli}</Code>
          <Code label={t({ en: "Response", ja: "レスポンス" })}>{op.response}</Code>
        </div>
        {op.responseNote && (
          <p className="text-sm text-[var(--muted)]">{rich(t(op.responseNote))}</p>
        )}
        <p className="text-sm">
          <Src href={op.ref}>
            {t({ en: `API Reference: ${op.id}`, ja: `API リファレンス: ${op.id}` })}
          </Src>
          <span className="text-[var(--muted)]">
            {t({
              en: ". Values above are illustrative; the keys are AWS's EXAMPLE placeholders.",
              ja: "。上の値は例示で、キーは AWS ドキュメントの EXAMPLE 値。",
            })}
          </span>
        </p>
      </div>
    </article>
  );
}
