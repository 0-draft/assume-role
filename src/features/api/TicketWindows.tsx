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
                      className="relative flex h-full min-h-[4.75rem] w-full flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow,transform]"
                      style={{
                        borderColor: on
                          ? f.color
                          : match
                            ? `color-mix(in oklab, ${f.color} 45%, var(--line))`
                            : "var(--line)",
                        borderStyle: match || on ? "solid" : "dashed",
                        background: on
                          ? `color-mix(in oklab, ${f.color} 20%, var(--surface))`
                          : match
                            ? `color-mix(in oklab, ${f.color} 7%, var(--surface))`
                            : "var(--surface)",
                        // Selected: pressed into the counter, with a hard print shadow.
                        boxShadow: on ? `4px 4px 0 0 ${f.color}` : "none",
                        transform: on ? "translate(-2px, -2px)" : "none",
                      }}
                    >
                      <span
                        className="font-mono text-[0.85rem] font-semibold [overflow-wrap:anywhere]"
                        style={{ color: match || on ? "var(--ink)" : "var(--muted)" }}
                      >
                        {o.id}
                      </span>
                      <OpBadges op={o} />
                      {on && (
                        <span
                          className="mt-auto text-xs font-semibold"
                          style={{ color: f.color }}
                        >
                          {t({ en: "Pass printed below", ja: "下に券を発行中" })}
                        </span>
                      )}
                      {match && !on && (
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

      {/* The pass feeds out of the selected window. */}
      <div aria-hidden className="-my-3 flex justify-center">
        <span
          className="h-8 border-l-[3px] border-dashed"
          style={{
            borderColor: FAMILIES.find((f) => f.id === opById(selected).family)!.color,
          }}
        />
      </div>
      <OpDetail key={selected} op={opById(selected)} />
    </div>
  );
}
