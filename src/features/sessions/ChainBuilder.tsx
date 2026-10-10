import { useId, useState } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { Segmented } from "@/components/ui";
import { evaluateChain, type HopError, type HopResult, type Origin } from "./model";
import {
  firstHop,
  fmtDuration,
  laterHop,
  ROLE_MAX,
  DURATIONS,
  ROLES,
  toHops,
  type HopUi,
} from "./chain";

const ORIGINS: { value: Origin; label: L; who: L }[] = [
  {
    value: "iam-user",
    label: { en: "IAM user keys", ja: "IAM ユーザーのキー" },
    who: { en: "alice (AKIA… keys)", ja: "alice (AKIA… キー)" },
  },
  {
    value: "federation",
    label: { en: "SAML / OIDC sign-in", ja: "SAML / OIDC サインイン" },
    who: { en: "IdP token or assertion", ja: "IdP のトークン / アサーション" },
  },
  {
    value: "service-role",
    label: { en: "EC2 / Lambda role", ja: "EC2 / Lambda のロール" },
    who: { en: "service role credentials", ja: "サービスロールの認証情報" },
  },
  {
    value: "role-session",
    label: { en: "Existing role session", ja: "既存のロールセッション" },
    who: { en: "ASIA… keys from a role", ja: "ロールの ASIA… キー" },
  },
];

const ERRORS: Record<HopError, L> = {
  "duration-below-min": {
    en: "DurationSeconds below 900 is rejected.",
    ja: "DurationSeconds が 900 未満なので拒否されます。",
  },
  "duration-over-role-max": {
    en: "Asked for more than the role's MaxSessionDuration, so the call fails.",
    ja: "ロールの MaxSessionDuration を超えているので、呼び出しが失敗します。",
  },
  "duration-over-chain-cap": {
    en: "Role chaining is capped at 1 hour. Asking for more fails the call; it is not silently trimmed.",
    ja: "ロールチェーンは 1 時間が上限です。それ以上を要求すると黙って切り詰められるのではなく、呼び出し自体が失敗します。",
  },
  "transitive-tag-override": {
    en: "Project was inherited as a transitive tag. Passing the same key again fails.",
    ja: "Project は推移タグとして引き継がれています。同じキーを渡し直すと失敗します。",
  },
  "source-identity-change": {
    en: "SourceIdentity is immutable through the chain. A different value is denied.",
    ja: "SourceIdentity はチェーンを通して変更できません。別の値を渡すと拒否されます。",
  },
};

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[var(--sts)]"
      />
      <span>{children}</span>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <label htmlFor={id} className="text-[var(--muted)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 font-mono"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {fmtDuration(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pass({ r, index }: { r: HopResult; index: number }) {
  const { t } = useLang();
  const tags = Object.entries(r.principalTags);
  const failed = r.error !== null;
  return (
    <div
      className="guilloche relative flex overflow-hidden rounded-xl border-2 shadow-[var(--shadow)] transition-opacity"
      style={{
        borderColor: failed ? "var(--deny)" : "var(--role)",
        filter: r.blocked ? "grayscale(1)" : undefined,
        borderStyle: r.blocked ? "dashed" : "solid",
      }}
    >
      <div className="min-w-0 flex-1 p-3">
        <div className="text-[0.7rem] text-[var(--muted)]">
          {t({ en: `Hop ${index + 1}`, ja: `${index + 1} 段目` })}{" "}
          <span className="font-mono">{r.operation}</span>
        </div>
        <div className="font-mono text-sm font-semibold break-all">
          assumed-role/<span className="text-[var(--role)]">{r.role}</span>
        </div>
        <div className="mt-2 text-[0.7rem] text-[var(--muted)]">aws:PrincipalTag</div>
        <div className="mt-0.5 flex min-h-6 flex-wrap gap-1">
          {r.blocked ? (
            <span className="text-xs text-[var(--muted)]">
              {t({ en: "never issued", ja: "発行されない" })}
            </span>
          ) : tags.length === 0 ? (
            <span className="text-xs text-[var(--muted)]">
              {t({ en: "none", ja: "なし" })}
            </span>
          ) : (
            tags.map(([k, v]) => {
              const carries = r.transitiveKeys.includes(k);
              return (
                <span
                  key={k}
                  className="rounded-md border px-1.5 font-mono text-[0.7rem]"
                  style={{
                    borderColor: carries ? "var(--sts)" : "var(--line)",
                    background: carries
                      ? "color-mix(in oklab, var(--sts) 12%, transparent)"
                      : "var(--surface)",
                  }}
                  title={carries ? t({ en: "transitive", ja: "推移タグ" }) : undefined}
                >
                  {k}={v}
                  {carries && (
                    <span className="ml-1 text-[var(--sts)]">
                      <span aria-hidden>↪</span>
                      <span className="sr-only">
                        {t({ en: " (transitive)", ja: " (推移)" })}
                      </span>
                    </span>
                  )}
                </span>
              );
            })
          )}
        </div>
        <div className="mt-2 text-[0.7rem] text-[var(--muted)]">aws:SourceIdentity</div>
        <div className="font-mono text-xs">
          {r.blocked ? "–" : (r.sourceIdentity ?? t({ en: "not set", ja: "未設定" }))}
        </div>
      </div>
      <div className="perforated w-2 shrink-0" aria-hidden />
      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 p-2 text-center">
        <div className="text-[0.62rem] leading-tight text-[var(--muted)]">
          {t({ en: "asked", ja: "要求" })}
        </div>
        <div
          className="font-display text-lg leading-none font-bold tabular-nums"
          style={{ color: failed ? "var(--deny)" : "var(--ink)" }}
        >
          {fmtDuration(r.requested)}
        </div>
        <div className="text-[0.62rem] leading-tight text-[var(--muted)]">
          {t({ en: "max", ja: "上限" })} {fmtDuration(r.maxAllowed)}
        </div>
        {r.chained && (
          <span className="mt-1 rounded-full bg-[var(--sunk)] px-1.5 text-[0.6rem] font-semibold">
            {t({ en: "chained", ja: "チェーン" })}
          </span>
        )}
      </div>
      {failed && (
        <span
          className="stamp-in pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-[3px] border-[var(--deny)] px-2 py-0.5 font-display text-xl font-bold text-[var(--deny)]"
          style={{ background: "color-mix(in oklab, var(--surface) 75%, transparent)" }}
        >
          {t({ en: "Rejected", ja: "拒否" })}
        </span>
      )}
    </div>
  );
}

export function ChainBuilder() {
  const { t } = useLang();
  const [origin, setOrigin] = useState<Origin>("iam-user");
  const [hops, setHops] = useState<HopUi[]>([firstHop, laterHop]);
  const results = evaluateChain(origin, toHops(hops));
  const failure = results.find((r) => r.error);
  const originCopy = ORIGINS.find((o) => o.value === origin)!;

  const patch = (i: number, p: Partial<HopUi>) =>
    setHops((hs) => hs.map((h, n) => (n === i ? { ...h, ...p } : h)));

  return (
    <div className="space-y-5">
      <Segmented
        label={{ en: "Who starts the chain?", ja: "チェーンの出発点は?" }}
        options={ORIGINS.map((o) => ({ value: o.value, label: o.label }))}
        value={origin}
        onChange={setOrigin}
        color="var(--caller)"
      />

      <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <li className="flex shrink-0 items-center gap-2 lg:w-36 lg:self-start lg:pt-16">
          <span
            className="rounded-xl border-2 px-3 py-2 text-center text-xs font-semibold"
            style={{
              borderColor: "var(--caller)",
              background: "color-mix(in oklab, var(--caller) 10%, var(--surface))",
            }}
          >
            {t(originCopy.who)}
          </span>
          <span aria-hidden className="text-[var(--muted)] lg:rotate-0">
            <span className="lg:hidden">↓</span>
            <span className="hidden lg:inline">→</span>
          </span>
        </li>
        {results.map((r, i) => (
          <li key={i} className="flex min-w-0 flex-1 flex-col gap-2">
            <Pass r={r} index={i} />
            <div className="space-y-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
              <Select
                label={t({ en: "Role max session", ja: "ロールの最大セッション時間" })}
                value={hops[i].maxSessionDuration}
                options={ROLE_MAX}
                onChange={(v) => patch(i, { maxSessionDuration: v })}
              />
              <Select
                label="DurationSeconds"
                value={hops[i].requested}
                options={DURATIONS}
                onChange={(v) => patch(i, { requested: v })}
              />
              {i === 0 ? (
                <>
                  <Check
                    checked={hops[i].project}
                    onChange={(v) => patch(i, { project: v })}
                  >
                    {t({ en: "Tag ", ja: "タグ " })}
                    <code className="font-mono">Project=apollo</code>
                    {t({ en: ", transitive", ja: " (推移)" })}
                  </Check>
                  <Check
                    checked={hops[i].costCenter}
                    onChange={(v) => patch(i, { costCenter: v })}
                  >
                    {t({ en: "Tag ", ja: "タグ " })}
                    <code className="font-mono">CostCenter=42</code>
                    {t({ en: ", not transitive", ja: " (推移なし)" })}
                  </Check>
                  <Check
                    checked={hops[i].sourceIdentity}
                    onChange={(v) => patch(i, { sourceIdentity: v })}
                  >
                    SourceIdentity <code className="font-mono">alice@example.com</code>
                  </Check>
                </>
              ) : (
                <>
                  <Check
                    checked={hops[i].project}
                    onChange={(v) => patch(i, { project: v })}
                  >
                    {t({ en: "Pass ", ja: "" })}
                    <code className="font-mono">Project=zeus</code>
                    {t({ en: " again", ja: " を渡し直す" })}
                  </Check>
                  <Check
                    checked={hops[i].sourceIdentity}
                    onChange={(v) => patch(i, { sourceIdentity: v })}
                  >
                    SourceIdentity <code className="font-mono">bob@example.com</code>
                  </Check>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-disabled={hops.length >= ROLES.length}
          onClick={() => hops.length < ROLES.length && setHops((h) => [...h, laterHop])}
          className="min-h-10 rounded-lg bg-[var(--sts)] px-3 text-sm font-bold text-[var(--on-color)] aria-disabled:opacity-40"
        >
          {t({ en: "Add a hop", ja: "1 段追加" })}
        </button>
        <button
          type="button"
          aria-disabled={hops.length <= 1}
          onClick={() => hops.length > 1 && setHops((h) => h.slice(0, -1))}
          className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold aria-disabled:opacity-40"
        >
          {t({ en: "Remove last hop", ja: "最後の段を削除" })}
        </button>
        <button
          type="button"
          onClick={() => {
            setOrigin("iam-user");
            setHops([firstHop, laterHop]);
          }}
          className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold"
        >
          {t({ en: "Reset", ja: "リセット" })}
        </button>
      </div>

      <p aria-live="polite" className="prose-col min-h-[3em] text-sm">
        {failure ? (
          <span className="text-[var(--deny)]">
            <strong>
              {t({ en: `${failure.role} fails: `, ja: `${failure.role} で失敗: ` })}
            </strong>
            {t(ERRORS[failure.error!])}
          </span>
        ) : (
          t({
            en: `All ${results.length} hops succeed. Final session: ${results[results.length - 1].role}, valid for ${fmtDuration(results[results.length - 1].requested)}.`,
            ja: `${results.length} 段すべて成功。最後のセッションは ${results[results.length - 1].role}、有効期間 ${fmtDuration(results[results.length - 1].requested)}。`,
          })
        )}
      </p>
      {origin === "service-role" && (
        <p className="prose-col text-xs text-[var(--muted)]">
          {t({
            en: "The EC2 or Lambda service assuming your role is not chaining, and the role's MaxSessionDuration does not limit it. Your code then using those credentials to assume another role is a role session assuming a role, which is chaining by AWS's definition; AWS does not spell this case out separately.",
            ja: "EC2 や Lambda のサービスがロールを引き受ける部分はチェーンではなく、ロールの MaxSessionDuration にも縛られません。その認証情報を使ってコードが別のロールを引き受けるのは「ロールセッションがロールを引き受ける」ことなので、AWS の定義上はチェーンです。ただしこのケースを個別に明記したドキュメントはありません。",
          })}
        </p>
      )}
    </div>
  );
}
