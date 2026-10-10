import { useState, type ReactNode } from "react";
import { Figure, Segmented } from "@/components/ui";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { evaluateGates, type Account, type GateState, type Naming } from "./gates";

const YES_NO: { value: "yes" | "no"; label: L }[] = [
  { value: "yes", label: { en: "Allows", ja: "許可あり" } },
  { value: "no", label: { en: "Silent", ja: "記述なし" } },
];

const STATE: Record<GateState, { color: string; label: L; mark: string }> = {
  pass: { color: "var(--resource)", label: { en: "open", ja: "通過" }, mark: "✓" },
  fail: { color: "var(--deny)", label: { en: "closed", ja: "通れない" }, mark: "✕" },
  skip: { color: "var(--muted)", label: { en: "not needed", ja: "不要" }, mark: "–" },
};

function Gate({
  n,
  title,
  sub,
  state,
}: {
  n: number;
  title: L;
  sub: L;
  state: GateState;
}) {
  const { t } = useLang();
  const s = STATE[state];
  return (
    <div
      className="relative flex-1 rounded-xl border-2 px-3 py-3 transition-colors"
      style={{
        borderColor: s.color,
        borderStyle: state === "skip" ? "dashed" : "solid",
        background: `color-mix(in oklab, ${s.color} 8%, var(--surface))`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-[var(--muted)]">
            {t({ en: `Gate ${n}`, ja: `ゲート ${n}` })}
          </div>
          <div className="leading-snug font-bold">{t(title)}</div>
        </div>
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full text-base font-bold text-[var(--on-color)]"
          style={{ background: s.color }}
        >
          {s.mark}
        </span>
      </div>
      <div className="mt-1 font-mono text-[0.72rem] break-words text-[var(--muted)]">
        {t(sub)}
      </div>
      <div className="mt-2 text-sm font-semibold" style={{ color: s.color }}>
        {t(s.label)}
      </div>
    </div>
  );
}

function Arrow({ ok }: { ok: boolean }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center text-xl sm:w-8"
      style={{ color: ok ? "var(--sts)" : "var(--line)" }}
    >
      <span className="rotate-90 sm:rotate-0">➜</span>
    </div>
  );
}

function Box({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div
      className="rounded-xl border-2 px-3 py-3 text-center sm:w-36"
      style={{
        borderColor: color,
        background: `color-mix(in oklab, ${color} 10%, var(--surface))`,
      }}
    >
      {children}
    </div>
  );
}

export function GatesLab() {
  const { t } = useLang();
  const [account, setAccount] = useState<Account>("same");
  const [naming, setNaming] = useState<Naming>("direct");
  const [identity, setIdentity] = useState<"yes" | "no">("no");
  const [trust, setTrust] = useState<"yes" | "no">("yes");

  const effNaming: Naming = account === "cross" && naming === "self" ? "direct" : naming;
  const r = evaluateGates({
    account,
    naming: effNaming,
    identityAllows: identity === "yes",
    trustAllows: trust === "yes",
  });

  const caller =
    effNaming === "self"
      ? "role/BatchWorker"
      : account === "same"
        ? "111122223333 user/alice"
        : "444455556666 user/alice";
  const trustSub: L =
    effNaming === "self"
      ? {
          en: "Principal: role/BatchWorker (itself)",
          ja: "Principal: role/BatchWorker (自分自身)",
        }
      : effNaming === "root"
        ? {
            en: `Principal: arn:aws:iam::${account === "same" ? "111122223333" : "444455556666"}:root`,
            ja: `Principal: arn:aws:iam::${account === "same" ? "111122223333" : "444455556666"}:root`,
          }
        : { en: `Principal: ${caller}`, ja: `Principal: ${caller}` };

  const namingOptions: { value: Naming; label: L }[] = [
    { value: "direct", label: { en: "The user by ARN", ja: "ユーザーを ARN で名指し" } },
    {
      value: "root",
      label: { en: "The whole account (:root)", ja: "アカウント全体 (:root)" },
    },
    ...(account === "same"
      ? [{ value: "self" as const, label: { en: "The role itself", ja: "ロール自身" } }]
      : []),
  ];

  return (
    <Figure
      title={{
        en: "Two gates in front of every role",
        ja: "すべてのロールの前にある 2 つのゲート",
      }}
      hint={{
        en: "Flip the switches. The role lives in account 111122223333.",
        ja: "スイッチを切り替えてみてください。ロールはアカウント 111122223333 にあります。",
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented<Account>
          label={{ en: "Caller's account", ja: "呼び出し元のアカウント" }}
          value={account}
          onChange={setAccount}
          color="var(--caller)"
          options={[
            { value: "same", label: { en: "Same account", ja: "同じアカウント" } },
            { value: "cross", label: { en: "Another account", ja: "別アカウント" } },
          ]}
        />
        <Segmented<Naming>
          label={{ en: "Trust policy names…", ja: "信頼ポリシーが指定するのは…" }}
          value={effNaming}
          onChange={setNaming}
          color="var(--role)"
          options={namingOptions}
        />
        <Segmented
          label={{
            en: "Caller's identity policy on sts:AssumeRole",
            ja: "呼び出し元 ID ポリシーの sts:AssumeRole",
          }}
          value={identity}
          onChange={setIdentity}
          color="var(--caller)"
          options={YES_NO}
        />
        <Segmented
          label={{
            en: "Role's trust policy for this caller",
            ja: "ロールの信頼ポリシー (この呼び出し元)",
          }}
          value={trust}
          onChange={setTrust}
          color="var(--role)"
          options={YES_NO}
        />
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Box color="var(--caller)">
          <div className="text-xs font-semibold text-[var(--muted)]">
            {t({ en: "Caller", ja: "呼び出し元" })}
          </div>
          <div className="font-mono text-[0.75rem] break-words">{caller}</div>
        </Box>
        <Arrow ok />
        <Gate
          n={1}
          title={{ en: "Caller's identity policy", ja: "呼び出し元の ID ポリシー" }}
          sub={{
            en: "Allow sts:AssumeRole on role/…",
            ja: "Allow sts:AssumeRole on role/…",
          }}
          state={r.identity}
        />
        <Arrow ok={r.identity !== "fail"} />
        <Gate
          n={2}
          title={{ en: "Role's trust policy", ja: "ロールの信頼ポリシー" }}
          sub={trustSub}
          state={r.trust}
        />
        <Arrow ok={r.allowed} />
        <Box color={r.allowed ? "var(--sts)" : "var(--deny)"}>
          <div className="text-xs font-semibold text-[var(--muted)]">
            {t({ en: "Result", ja: "結果" })}
          </div>
          {/* Drawn as a rubber stamp: issued or rejected at the window. */}
          <div
            className="mt-1 inline-block -rotate-3 rounded-md border-2 px-2 py-0.5 text-sm font-bold whitespace-nowrap"
            style={{
              color: r.allowed ? "var(--sts)" : "var(--deny)",
              borderColor: r.allowed ? "var(--sts)" : "var(--deny)",
            }}
          >
            {r.allowed ? (
              t({ en: "Session issued", ja: "セッション発行" })
            ) : (
              <span className="font-mono">AccessDenied</span>
            )}
          </div>
        </Box>
      </div>

      <p className="prose-col mt-4" aria-live="polite">
        {rich(t(r.why))}
      </p>
    </Figure>
  );
}
