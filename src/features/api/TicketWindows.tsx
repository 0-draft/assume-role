import { useState } from "react";
import { Segmented } from "@/components/ui";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { OpBadges } from "./Badges";
import { OpDetail } from "./OpDetail";
import { FAMILIES, HOLDINGS, OPS, opById, type Holding, type OpId } from "./ops";

/**
 * The picker and the eleven windows. Choosing what you hold lights up the
 * windows that will serve you; choosing a window prints its pass below.
 */
export function TicketWindows() {
  const { t } = useLang();
  const [holding, setHolding] = useState<Holding>("role-session");
  const [selected, setSelected] = useState<OpId>("AssumeRole");
  const h = HOLDINGS.find((x) => x.id === holding)!;

  const pick = (next: Holding) => {
    setHolding(next);
    setSelected(HOLDINGS.find((x) => x.id === next)!.ops[0]);
  };

  return (
    <div className="space-y-6">
      <Segmented
        label={{ en: "What are you holding?", ja: "手元にあるのは?" }}
        options={HOLDINGS.map((x) => ({ value: x.id, label: x.label }))}
        value={holding}
        onChange={pick}
        color="var(--caller)"
      />
      <p className="prose-col rounded-xl bg-[var(--sunk)] px-4 py-3" aria-live="polite">
        {rich(t(h.why))}
      </p>

      <div className="space-y-5">
        {FAMILIES.map((f) => (
          <div key={f.id} className="grid gap-3 lg:grid-cols-[14rem_1fr]">
            <div className="border-l-4 pl-3" style={{ borderColor: f.color }}>
              <h3 className="font-display text-lg leading-tight font-bold">
                {t(f.label)}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{t(f.blurb)}</p>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {OPS.filter((o) => o.family === f.id).map((o) => {
                const match = h.ops.includes(o.id);
                const on = o.id === selected;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      data-match={match}
                      onClick={() => setSelected(o.id)}
                      className="relative flex h-full min-h-[4.75rem] w-full flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow]"
                      style={{
                        borderColor: on || match ? f.color : "var(--line)",
                        borderStyle: match || on ? "solid" : "dashed",
                        background: match
                          ? `color-mix(in oklab, ${f.color} 13%, var(--surface))`
                          : "var(--surface)",
                        boxShadow: on
                          ? `0 0 0 3px color-mix(in oklab, ${f.color} 35%, transparent)`
                          : "none",
                      }}
                    >
                      <span
                        className="font-mono text-[0.85rem] font-semibold [overflow-wrap:anywhere]"
                        style={{ color: match ? "var(--ink)" : "var(--muted)" }}
                      >
                        {o.id}
                      </span>
                      <OpBadges op={o} />
                      {match && (
                        <span
                          aria-hidden
                          className="absolute top-2 right-2 size-2.5 rounded-full"
                          style={{ background: f.color }}
                        />
                      )}
                      {match && (
                        <span className="sr-only">
                          {t({ en: "(fits what you hold)", ja: "(手元のもので呼べる)" })}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <OpDetail key={selected} op={opById(selected)} />
    </div>
  );
}
