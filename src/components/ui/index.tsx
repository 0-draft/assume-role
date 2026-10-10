import { useId, useState, type ReactNode } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { actorVar, type Actor } from "@/lib/actor";
import { rich } from "@/lib/rich";

/**
 * One chapter of the page. `kicker` is the chapter number, which is real
 * sequence information: the chapters build on each other.
 */
export function Section({
  id,
  index,
  title,
  lede,
  children,
}: {
  id: string;
  index: number;
  title: L;
  lede: L;
  children: ReactNode;
}) {
  const { t } = useLang();
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-t border-[var(--line)] py-16 sm:py-24"
    >
      <header className="mb-10 grid gap-4 sm:grid-cols-[4.5rem_1fr]">
        <span
          aria-hidden
          className="font-display text-5xl leading-none font-bold text-[var(--sts)] tabular-nums sm:text-6xl"
        >
          {String(index).padStart(2, "0")}
        </span>
        <div>
          <h2
            id={`${id}-title`}
            className="text-3xl leading-tight font-bold sm:text-[2.6rem]"
          >
            {t(title)}
          </h2>
          <p className="prose-col mt-3 text-lg text-[var(--muted)]">{t(lede)}</p>
        </div>
      </header>
      <div className="space-y-10">{children}</div>
    </section>
  );
}

/** A paragraph of bilingual prose. Inline markup goes through `rich`. */
export function P({ children, className = "" }: { children: L; className?: string }) {
  const { t } = useLang();
  return <p className={`prose-col ${className}`}>{rich(t(children))}</p>;
}

/** Framed interactive figure with a caption that says what to do with it. */
export function Figure({
  title,
  hint,
  children,
  wide = true,
}: {
  title: L;
  hint?: L;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useLang();
  return (
    <figure
      className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] sm:p-6 ${wide ? "" : "prose-col"}`}
    >
      <figcaption className="mb-4">
        <span className="font-display text-xl font-bold">{t(title)}</span>
        {hint && (
          <span className="mt-1 block text-sm text-[var(--muted)]">{t(hint)}</span>
        )}
      </figcaption>
      {children}
    </figure>
  );
}

export type CalloutKind = "note" | "warn" | "new";

const CALLOUT: Record<CalloutKind, { color: string; label: L }> = {
  note: { color: "var(--role)", label: { en: "Note", ja: "メモ" } },
  warn: { color: "var(--deny)", label: { en: "Pitfall", ja: "落とし穴" } },
  new: { color: "var(--sts)", label: { en: "Changed recently", ja: "最近の変更" } },
};

export function Callout({
  kind = "note",
  children,
}: {
  kind?: CalloutKind;
  children: L;
}) {
  const { t } = useLang();
  const c = CALLOUT[kind];
  // Three different paper objects, not one tinted box in three colours:
  // a margin note, a rejection slip with a stamp, an amendment slip.
  if (kind === "note")
    return (
      <aside className="prose-col border-l-2 py-1 pl-4" style={{ borderColor: c.color }}>
        <strong className="mr-2" style={{ color: c.color }}>
          {t(c.label)}
        </strong>
        {rich(t(children))}
      </aside>
    );
  if (kind === "warn")
    return (
      <aside
        className="prose-col relative mt-3 rounded-lg border-2 border-dashed bg-[var(--surface)] px-4 pt-5 pb-3"
        style={{ borderColor: `color-mix(in oklab, ${c.color} 55%, transparent)` }}
      >
        <strong
          className="absolute -top-3 left-3 -rotate-2 rounded-md border-2 bg-[var(--surface)] px-2 font-display text-sm leading-6"
          style={{ color: c.color, borderColor: c.color }}
        >
          {t(c.label)}
        </strong>
        {rich(t(children))}
      </aside>
    );
  return (
    <aside className="guilloche prose-col relative overflow-hidden rounded-lg border border-[var(--line)] px-4 pt-4 pb-3">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{
          backgroundImage: `radial-gradient(circle, var(--paper) 2px, transparent 2.5px)`,
          backgroundSize: "10px 6px",
          backgroundPosition: "center -3px",
        }}
      />
      <strong
        className="mr-2 inline-flex items-center gap-1.5"
        style={{ color: c.color }}
      >
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ background: c.color }}
        />
        {t(c.label)}
      </strong>
      {rich(t(children))}
    </aside>
  );
}

/** Segmented control. Radio semantics, so arrow keys move the selection. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  color = "var(--sts)",
}: {
  label: L;
  options: { value: T; label: L; hint?: L }[];
  value: T;
  onChange: (v: T) => void;
  color?: string;
}) {
  const { t } = useLang();
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-[var(--muted)]">
        {t(label)}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              title={o.hint ? t(o.hint) : undefined}
              className="relative min-h-10 cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--sts)]"
              style={{
                borderColor: on ? color : "var(--line)",
                background: on
                  ? `color-mix(in oklab, ${color} 14%, var(--surface))`
                  : "var(--surface)",
                color: on ? "var(--ink)" : "var(--muted)",
              }}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {t(o.label)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Disclosure for long reference material: closed by default, keyboard native. */
export function More({ summary, children }: { summary: L; children: ReactNode }) {
  const { t } = useLang();
  return (
    <details className="group rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <summary className="cursor-pointer font-semibold marker:text-[var(--sts)]">
        {rich(t(summary))}
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/** Link to a primary source. Every non-obvious claim on the site cites one. */
export function Src({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--sts)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {children}
    </a>
  );
}

/** Code / payload block with a copy button. */
export function Code({ children, label }: { children: string; label?: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="relative rounded-xl border border-[var(--line)] bg-[var(--sunk)]">
      {label && (
        <div className="border-b border-[var(--line)] px-4 py-1.5 font-mono text-xs text-[var(--muted)]">
          {label}
        </div>
      )}
      <pre
        tabIndex={0}
        aria-label={label}
        className="scroll-x px-4 py-3 font-mono text-[0.82rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-1.5 right-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]"
      >
        {copied ? t({ en: "Copied", ja: "コピー済み" }) : t({ en: "Copy", ja: "コピー" })}
      </button>
    </div>
  );
}

/** A small actor badge: colour plus a text label, never colour alone. */
export function ActorTag({ actor, children }: { actor: Actor; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{
        borderColor: actorVar(actor),
        color: actorVar(actor),
        background: `color-mix(in oklab, ${actorVar(actor)} 10%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ background: actorVar(actor) }}
      />
      {children}
    </span>
  );
}
