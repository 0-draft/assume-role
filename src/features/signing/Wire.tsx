import { useMemo, useState, type ReactNode } from "react";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { TONE_VAR, wireText, type Annotation, type WireMessage } from "./demos";

/**
 * Splits the wire text on the annotated substrings and wraps each one in a
 * button, so the literal bytes stay readable while every interesting token can
 * be opened. Each annotation marks its first occurrence only.
 */
function annotate(
  text: string,
  annotations: Annotation[],
  active: string | null,
  onPick: (match: string | null) => void,
): ReactNode[] {
  const found = annotations
    .map((a) => ({ a, index: text.indexOf(a.match) }))
    .filter((hit) => hit.index >= 0)
    .sort((x, y) => x.index - y.index);

  const out: ReactNode[] = [];
  let cursor = 0;
  for (const { a, index } of found) {
    if (index < cursor) continue;
    if (index > cursor) out.push(text.slice(cursor, index));
    const on = active === a.match;
    const color = TONE_VAR[a.tone ?? "info"];
    out.push(
      <button
        key={a.match}
        type="button"
        aria-pressed={on}
        onClick={() => onPick(on ? null : a.match)}
        className="cursor-pointer rounded-sm border-b-2 border-dashed px-0.5 text-left font-semibold"
        style={{
          color,
          borderColor: color,
          background: on ? `color-mix(in oklab, ${color} 16%, transparent)` : undefined,
        }}
      >
        {a.match}
      </button>,
    );
    cursor = index + a.match.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** An HTTP message as it goes on the wire, with clickable annotations. */
export function Wire({
  label,
  message,
  extraHeaders = [],
}: {
  label: string;
  message: WireMessage;
  /** Injected live, e.g. the Authorization header the signer just produced. */
  extraHeaders?: Array<[string, string]>;
}) {
  const { t } = useLang();
  const [active, setActive] = useState<string | null>(null);
  const text = useMemo(() => wireText(message, extraHeaders), [message, extraHeaders]);
  const annotations = message.annotations ?? [];
  const picked = annotations.find((a) => a.match === active);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--sunk)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-1.5 font-mono text-xs text-[var(--muted)]">
        <span>{label}</span>
        {annotations.length > 0 && (
          <span>
            {t({
              en: `${annotations.length} annotated: click to open`,
              ja: `注釈 ${annotations.length} 件 (クリックで表示)`,
            })}
          </span>
        )}
      </div>
      <pre
        tabIndex={0}
        aria-label={label}
        className="scroll-x px-4 py-3 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {annotate(text, annotations, active, setActive)}
      </pre>
      {picked && (
        <p
          aria-live="polite"
          className="border-t-2 bg-[var(--surface)] px-4 py-2 text-sm"
          style={{ borderColor: TONE_VAR[picked.tone ?? "info"] }}
        >
          {rich(t(picked.note))}
        </p>
      )}
    </div>
  );
}
