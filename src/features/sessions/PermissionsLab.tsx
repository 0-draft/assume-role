import { useState } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { useNarrow } from "@/hooks/useNarrow";
import {
  ACTIONS,
  ALWAYS_PRESENT,
  DEFAULT_PERMS,
  LAYERS,
  evaluate,
  toggleAction,
  togglePresent,
  type LayerId,
  type Verdict,
} from "./model";

const LAYER_COPY: Record<LayerId, { name: L; where: L; absent: L }> = {
  deny: {
    name: { en: "Explicit deny", ja: "明示的な Deny" },
    where: { en: "in any policy below", ja: "下のどのポリシーでも" },
    absent: { en: "", ja: "" },
  },
  rcp: {
    name: { en: "RCP", ja: "RCP" },
    where: { en: "resource's organization", ja: "リソース側の組織" },
    absent: { en: "not in play", ja: "適用なし" },
  },
  scp: {
    name: { en: "SCP", ja: "SCP" },
    where: { en: "caller's organization", ja: "呼び出し側の組織" },
    absent: { en: "not in play", ja: "適用なし" },
  },
  identity: {
    name: { en: "Role identity policies", ja: "ロールの ID ポリシー" },
    where: { en: "attached to the role", ja: "ロールにアタッチ" },
    absent: { en: "", ja: "" },
  },
  boundary: {
    name: { en: "Permissions boundary", ja: "アクセス許可の境界" },
    where: { en: "set on the role", ja: "ロールに設定" },
    absent: { en: "no boundary", ja: "境界なし" },
  },
  session: {
    name: { en: "Session policy", ja: "セッションポリシー" },
    where: { en: "passed in the AssumeRole call", ja: "AssumeRole 呼び出しで渡す" },
    absent: { en: "none passed: default allow-all", ja: "渡さない: 既定で全許可" },
  },
};

const VERDICT_STYLE: Record<Verdict, { bg: string; border: string; opacity: number }> = {
  pass: {
    bg: "color-mix(in oklab, var(--resource) 14%, var(--surface))",
    border: "var(--resource)",
    opacity: 1,
  },
  absent: { bg: "transparent", border: "var(--line)", opacity: 1 },
  blocked: {
    bg: "color-mix(in oklab, var(--deny) 18%, var(--surface))",
    border: "var(--deny)",
    opacity: 1,
  },
  skipped: { bg: "var(--sunk)", border: "var(--line)", opacity: 0.4 },
};

function ActionHead({ action }: { action: string }) {
  const [svc, name] = action.split(":");
  return (
    <span className="block font-mono text-[0.7rem] leading-tight whitespace-nowrap">
      <span className="text-[var(--muted)]">{svc}:</span>
      <br />
      {name}
    </span>
  );
}

export function PermissionsLab() {
  const { t } = useLang();
  const [cfg, setCfg] = useState(DEFAULT_PERMS);
  const results = evaluate(cfg);
  const cols = `minmax(9.5rem, 1.4fr) repeat(${ACTIONS.length}, minmax(5.6rem, 1fr))`;
  const narrow = useNarrow();
  const [focus, setFocus] = useState<string>(ACTIONS[0]);

  const cellButton = (id: LayerId, action: string) => {
    const r = results.find((x) => x.action === action)!;
    const copy = LAYER_COPY[id];
    const present = ALWAYS_PRESENT.has(id) || cfg[id].present;
    const v = r.verdicts[id];
    const s = VERDICT_STYLE[v];
    const listed = cfg[id].actions.has(r.action);
    const isDeny = id === "deny";
    const symbol = !present ? "–" : isDeny ? (listed ? "✕" : "") : listed ? "✓" : "✕";
    const label = isDeny
      ? t({
          en: `${r.action}: ${listed ? "denied" : "not denied"}. Toggle explicit deny.`,
          ja: `${r.action}: ${listed ? "Deny あり" : "Deny なし"}。切り替える`,
        })
      : t({
          en: `${copy.name.en} ${listed ? "allows" : "does not allow"} ${r.action}. Toggle.`,
          ja: `${copy.name.ja} は ${r.action} を${listed ? "許可" : "許可しない"}。切り替える`,
        });
    return (
      <button
        type="button"
        disabled={!present}
        aria-pressed={listed}
        aria-label={label}
        onClick={() => setCfg((c) => toggleAction(c, id, r.action))}
        className="relative grid min-h-12 place-items-center rounded-lg border-2 text-base font-bold transition-colors disabled:cursor-not-allowed"
        style={{
          background: s.bg,
          borderColor: s.border,
          borderStyle: v === "absent" ? "dashed" : "solid",
          opacity: s.opacity,
          color:
            v === "blocked"
              ? "var(--deny)"
              : listed && !isDeny
                ? "var(--resource)"
                : "var(--muted)",
        }}
      >
        <span aria-hidden>{symbol}</span>
        {v === "blocked" && (
          <span className="absolute -bottom-px left-1/2 -translate-x-1/2 translate-y-1/2 rounded bg-[var(--deny)] px-1 text-[0.7rem] leading-tight font-bold whitespace-nowrap text-[var(--on-color)]">
            {t({ en: "stops here", ja: "ここで止まる" })}
          </span>
        )}
      </button>
    );
  };

  if (narrow) {
    const r = results.find((x) => x.action === focus)!;
    return (
      <div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-[var(--muted)]">
            {t({ en: "Follow one request", ja: "1 つのリクエストを追う" })}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={a === focus}
                onClick={() => setFocus(a)}
                className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-[0.75rem] aria-pressed:border-[var(--role)] aria-pressed:bg-[var(--sunk)] aria-pressed:font-bold"
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <ol className="mt-4 space-y-2">
          {LAYERS.map((id) => {
            const copy = LAYER_COPY[id];
            const fixed = ALWAYS_PRESENT.has(id);
            return (
              <li
                key={id}
                className="grid grid-cols-[1fr_4.5rem] items-center gap-3 rounded-lg border-l-4 bg-[var(--surface)] py-1.5 pr-1 pl-3"
                style={{ borderColor: id === "deny" ? "var(--deny)" : "var(--role)" }}
              >
                <div>
                  <div className="text-sm leading-tight font-bold">{t(copy.name)}</div>
                  <div className="text-[0.75rem] leading-tight text-[var(--muted)]">
                    {t(copy.where)}
                  </div>
                  {!fixed && (
                    <button
                      type="button"
                      aria-pressed={cfg[id].present}
                      onClick={() => setCfg((c) => togglePresent(c, id))}
                      className="mt-1 min-h-8 rounded-full border border-[var(--line)] px-2.5 text-[0.75rem] font-semibold aria-pressed:border-[var(--role)] aria-pressed:text-[var(--role)]"
                    >
                      {cfg[id].present
                        ? t({ en: "In play", ja: "適用中" })
                        : t({ en: "Off", ja: "オフ" })}
                    </button>
                  )}
                </div>
                <div className="grid pb-2">{cellButton(id, focus)}</div>
              </li>
            );
          })}
        </ol>
        <div
          className="mt-3 flex items-center justify-between rounded-lg px-3 py-2 font-bold"
          style={{
            background: r.allowed ? "var(--resource)" : "transparent",
            color: r.allowed ? "var(--on-color)" : "var(--deny)",
            border: r.allowed ? "none" : "2px solid var(--deny)",
          }}
        >
          <span className="font-mono text-sm">{focus}</span>
          <span>
            {r.allowed ? t({ en: "Allow", ja: "許可" }) : t({ en: "Deny", ja: "拒否" })}
          </span>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {t({
            en: "Tap a square to change what that policy allows for this action.",
            ja: "マスをタップすると、このアクションをそのポリシーが許可するかを切り替えられます。",
          })}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div tabIndex={0} className="scroll-x">
        <div
          role="table"
          aria-label={t({
            en: "Each row is a gate; each column is an API action",
            ja: "行がゲート、列が API アクション",
          })}
          className="grid min-w-[680px] gap-1.5"
          style={{ gridTemplateColumns: cols }}
        >
          <div role="row" className="contents">
            <div
              role="columnheader"
              className="self-end pb-1 text-xs text-[var(--muted)]"
            >
              {t({ en: "Requests from the session", ja: "セッションからのリクエスト" })}
            </div>
            {ACTIONS.map((a) => (
              <div
                role="columnheader"
                key={a}
                className="rounded-lg border border-[var(--line)] bg-[var(--sunk)] px-1.5 py-1.5 text-center"
              >
                <ActionHead action={a} />
              </div>
            ))}
          </div>

          {LAYERS.map((id) => {
            const copy = LAYER_COPY[id];
            const fixed = ALWAYS_PRESENT.has(id);
            const left = results.filter(
              (r) => r.verdicts[id] === "pass" || r.verdicts[id] === "absent",
            ).length;
            return (
              <div role="row" className="contents" key={id}>
                <div
                  role="rowheader"
                  className="flex flex-col justify-center rounded-lg border-l-4 py-1 pr-1 pl-2"
                  style={{ borderColor: id === "deny" ? "var(--deny)" : "var(--role)" }}
                >
                  <span className="text-sm leading-tight font-bold">{t(copy.name)}</span>
                  <span className="text-[0.7rem] leading-tight text-[var(--muted)]">
                    {t(copy.where)}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {!fixed && (
                      <button
                        type="button"
                        aria-pressed={cfg[id].present}
                        onClick={() => setCfg((c) => togglePresent(c, id))}
                        className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.68rem] font-semibold aria-pressed:border-[var(--role)] aria-pressed:text-[var(--role)]"
                      >
                        {cfg[id].present
                          ? t({ en: "In play", ja: "適用中" })
                          : t({ en: "Off", ja: "オフ" })}
                      </button>
                    )}
                    <span className="text-[0.68rem] text-[var(--muted)] tabular-nums">
                      {t({ en: `${left} get through`, ja: `${left} 件通過` })}
                    </span>
                  </span>
                </div>
                {results.map((r) => (
                  <div role="cell" key={r.action} className="grid">
                    {cellButton(id, r.action)}
                  </div>
                ))}
              </div>
            );
          })}

          <div role="row" className="contents">
            <div
              role="rowheader"
              className="flex items-center pl-2 font-display text-base font-bold"
            >
              {t({ en: "Effective", ja: "最終結果" })}
            </div>
            {results.map((r) => (
              <div
                role="cell"
                key={r.action}
                className="grid min-h-11 place-items-center rounded-lg text-sm font-bold"
                style={{
                  background: r.allowed ? "var(--resource)" : "transparent",
                  color: r.allowed ? "var(--on-color)" : "var(--deny)",
                  border: r.allowed ? "none" : "2px solid var(--deny)",
                }}
              >
                {r.allowed
                  ? t({ en: "Allow", ja: "許可" })
                  : t({ en: "Deny", ja: "拒否" })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        {t({
          en: "Click any square to change what that policy allows. Turn off the session policy and watch the default allow-all take its place: the session falls back to everything the role, boundary and SCP allow.",
          ja: "マスをクリックすると、そのポリシーが許可するかどうかを切り替えられます。セッションポリシーをオフにすると既定の全許可に置き換わり、ロール・境界・SCP が許す範囲すべてに戻ります。",
        })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCfg(DEFAULT_PERMS)}
          className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold"
        >
          {t({ en: "Reset", ja: "リセット" })}
        </button>
      </div>
    </div>
  );
}
