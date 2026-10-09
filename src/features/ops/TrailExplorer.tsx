import { useState, type ReactNode } from "react";
import { Figure, Segmented } from "@/components/ui";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { FIELDS, SCENARIOS, type Json, type Scenario, type TrailRecord } from "./trail";

export function TrailExplorer() {
  const { t } = useLang();
  const [id, setId] = useState(SCENARIOS[0].id);
  const [field, setField] = useState<string | null>("userIdentity.type");
  const s = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];

  return (
    <Figure
      title={{
        en: "Where does the CloudTrail record land?",
        ja: "CloudTrail の記録はどこに残る?",
      }}
      hint={{
        en: "Pick a scenario, then tap any underlined field name in the record to see what it tells you.",
        ja: "シナリオを選び、記録の中の下線付きフィールド名をタップすると意味が出ます。",
      }}
    >
      <Segmented
        label={{ en: "Scenario", ja: "シナリオ" }}
        options={SCENARIOS.map((x) => ({ value: x.id, label: x.label }))}
        value={id}
        onChange={(v) => {
          setId(v);
          setField(null);
        }}
        color="var(--role)"
      />
      <p className="prose-col mt-4">{t(s.summary)}</p>
      <Accounts scenario={s} />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-4">
          {s.records.map((r, i) => (
            <RecordView
              key={`${s.id}-${i}`}
              record={r}
              scenario={s}
              selected={field}
              onSelect={setField}
            />
          ))}
        </div>
        <aside
          aria-live="polite"
          className="h-fit rounded-xl border border-[var(--line)] bg-[var(--sunk)] p-4 lg:sticky lg:top-20"
        >
          {field && FIELDS[field] ? (
            <>
              <div className="font-mono text-[0.8rem] font-semibold break-all text-[var(--role)]">
                {field}
              </div>
              <p className="mt-2 text-[0.92rem]">{rich(t(FIELDS[field]))}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {t({
                en: "Tap an underlined field in the record.",
                ja: "記録の下線付きフィールドをタップしてください。",
              })}
            </p>
          )}
        </aside>
      </div>
    </Figure>
  );
}

/** Two account cards, each showing whether it received a record and in which Region. */
function Accounts({ scenario }: { scenario: Scenario }) {
  const { t } = useLang();
  const same = scenario.callerAccount === scenario.roleAccount;
  const sides: { side: "caller" | "role"; label: string; id: string; color: string }[] =
    same
      ? [
          {
            side: "caller",
            label: t({ en: "Your account", ja: "あなたのアカウント" }),
            id: scenario.callerAccount,
            color: "var(--caller)",
          },
        ]
      : [
          {
            side: "caller",
            label: t({ en: "Caller", ja: "呼び出し側" }),
            id: scenario.callerAccount,
            color: "var(--caller)",
          },
          {
            side: "role",
            label: t({ en: "Role owner", ja: "ロールの持ち主" }),
            id: scenario.roleAccount,
            color: "var(--role)",
          },
        ];
  return (
    <div
      className={`mt-4 grid gap-3 ${same ? "" : "sm:grid-cols-[1fr_auto_1fr]"} items-stretch`}
    >
      {sides.map((a, i) => {
        const rec = scenario.records.find((r) => r.account === a.side || same);
        return (
          <div key={a.side} className="contents">
            {i === 1 && (
              <div
                aria-hidden
                className="hidden items-center justify-center text-2xl text-[var(--muted)] sm:flex"
              >
                ⇄
              </div>
            )}
            <div
              className="rounded-xl border-2 p-3"
              style={{
                borderColor: a.color,
                borderStyle: rec ? "solid" : "dashed",
                background: `color-mix(in oklab, ${a.color} 7%, var(--surface))`,
              }}
            >
              <div className="text-sm font-bold" style={{ color: a.color }}>
                {a.label}
              </div>
              <div className="font-mono text-[0.8rem]">{a.id}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {rec ? (
                  <>
                    <span
                      className="rounded-md px-1.5 py-0.5 text-xs font-bold text-[var(--on-color)]"
                      style={{ background: "var(--resource)" }}
                    >
                      {t({ en: "Logged", ja: "記録あり" })}
                    </span>
                    <span className="font-mono text-xs">CloudTrail {rec.region}</span>
                  </>
                ) : (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-xs font-bold text-[var(--on-color)]"
                    style={{ background: "var(--deny)" }}
                  >
                    {t({ en: "No record", ja: "記録なし" })}
                  </span>
                )}
              </div>
              {!rec && scenario.missingNote && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t(scenario.missingNote)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecordView({
  record,
  scenario,
  selected,
  onSelect,
}: {
  record: TrailRecord;
  scenario: Scenario;
  selected: string | null;
  onSelect: (p: string) => void;
}) {
  const { t } = useLang();
  const acct =
    record.account === "caller" ? scenario.callerAccount : scenario.roleAccount;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--sunk)]">
      <div className="border-b border-[var(--line)] px-4 py-1.5 font-mono text-xs text-[var(--muted)]">
        {t({ en: "Record in", ja: "記録先" })} {acct} / {record.region}
      </div>
      <pre className="scroll-x px-4 py-3 font-mono text-[0.78rem] leading-relaxed">
        <JsonNode
          value={record.body}
          path=""
          depth={0}
          selected={selected}
          onSelect={onSelect}
        />
      </pre>
    </div>
  );
}

function JsonNode({
  value,
  path,
  depth,
  selected,
  onSelect,
}: {
  value: Json;
  path: string;
  depth: number;
  selected: string | null;
  onSelect: (p: string) => void;
}): ReactNode {
  const pad = "  ".repeat(depth);
  if (value === null) return <span className="text-[var(--muted)]">null</span>;
  if (typeof value === "string")
    return <span className="text-[var(--resource)]">{JSON.stringify(value)}</span>;
  if (typeof value === "number" || typeof value === "boolean")
    return <span className="text-[var(--idp)]">{String(value)}</span>;
  if (Array.isArray(value)) return <span>{JSON.stringify(value)}</span>;
  const entries = Object.entries(value);
  return (
    <>
      {"{\n"}
      {entries.map(([k, v], i) => {
        const p = path ? `${path}.${k}` : k;
        const known = !!FIELDS[p];
        return (
          <span key={p}>
            {pad}
            {"  "}
            {known ? (
              <button
                type="button"
                onClick={() => onSelect(p)}
                aria-pressed={selected === p}
                className="rounded-sm font-semibold text-[var(--role)] underline decoration-dotted underline-offset-2 aria-pressed:bg-[color-mix(in_oklab,var(--role)_20%,transparent)] aria-pressed:decoration-solid"
              >
                {JSON.stringify(k)}
              </button>
            ) : (
              <span className="text-[var(--ink)]">{JSON.stringify(k)}</span>
            )}
            {": "}
            <JsonNode
              value={v}
              path={p}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
            {i < entries.length - 1 ? ",\n" : "\n"}
          </span>
        );
      })}
      {pad}
      {"}"}
    </>
  );
}
