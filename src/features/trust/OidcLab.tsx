import { useId, useState } from "react";
import { Code, Figure, Segmented } from "@/components/ui";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import {
  evaluateOidc,
  policyJson,
  PRESETS,
  TOKENS,
  type Claims,
  type Operator,
  type TrustCondition,
  type Verdict,
} from "./oidc";

const VERDICT: Record<Verdict, { color: string; label: L }> = {
  allowed: {
    color: "var(--resource)",
    label: { en: "Credentials issued", ja: "認証情報を発行" },
  },
  denied: { color: "var(--deny)", label: { en: "AccessDenied", ja: "AccessDenied" } },
  "bad-token": {
    color: "var(--deny)",
    label: { en: "InvalidIdentityToken", ja: "InvalidIdentityToken" },
  },
  "rejected-save": {
    color: "var(--deny)",
    label: { en: "IAM won't save this policy", ja: "IAM が保存を拒否" },
  },
};

const CLAIM_ORDER: (keyof Claims)[] = [
  "iss",
  "aud",
  "sub",
  "repository",
  "repository_owner",
  "ref",
  "ref_type",
  "event_name",
  "environment",
  "workflow_ref",
];

function Jwt({ claims }: { claims: Claims }) {
  const { t } = useLang();
  return (
    <div className="guilloche overflow-hidden rounded-xl border-2 border-[var(--idp)]">
      <div className="flex items-center justify-between gap-2 bg-[var(--idp)] px-3 py-1.5 text-xs font-bold text-[var(--on-color)]">
        <span>
          {t({
            en: "OIDC token from GitHub (decoded)",
            ja: "GitHub の OIDC トークン (デコード済み)",
          })}
        </span>
        <span className="font-mono">RS256</span>
      </div>
      <dl
        tabIndex={0}
        className="scroll-x px-3 py-2 font-mono text-[0.76rem] leading-relaxed"
      >
        {CLAIM_ORDER.filter((k) => claims[k] !== undefined).map((k) => (
          <div key={k} className="flex gap-2">
            <dt className="w-[7.5rem] shrink-0 break-all text-[var(--muted)] sm:w-32">
              {k}
            </dt>
            <dd
              className={
                k === "sub" || k === "aud"
                  ? "min-w-0 rounded bg-[color-mix(in_oklab,var(--idp)_16%,transparent)] px-1 font-semibold break-all"
                  : "min-w-0 break-all"
              }
            >
              {claims[k]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function OidcLab() {
  const { t } = useLang();
  const ids = useId();
  const [tokenId, setTokenId] = useState("main");
  const [presetId, setPresetId] = useState("exact");
  const [cond, setCond] = useState<TrustCondition>(PRESETS[0].cond);

  const tok = TOKENS.find((x) => x.id === tokenId) ?? TOKENS[0];
  const r = evaluateOidc(cond, tok.claims);
  const v = VERDICT[r.verdict];

  const pickPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) setCond(p.cond);
  };

  const editSub = (patch: Partial<{ op: Operator; value: string }>) => {
    setPresetId("custom");
    setCond((c) => ({
      ...c,
      sub: { op: c.sub?.op ?? "StringLike", value: c.sub?.value ?? "", ...patch },
    }));
  };

  return (
    <Figure
      title={{
        en: "Who can assume your GitHub deploy role?",
        ja: "その GitHub デプロイ用ロール、誰が引き受けられる?",
      }}
      hint={{
        en: "Pick a token, then pick or edit the trust policy's sub condition. The grid at the bottom replays every token against your policy.",
        ja: "トークンを選び、信頼ポリシーの sub 条件を選ぶか編集してください。下のグリッドは全トークンをこのポリシーで評価し直した結果です。",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-[var(--muted)]">
              {t({ en: "Token presented to STS", ja: "STS に提示されるトークン" })}
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {TOKENS.map((x) => {
                const on = x.id === tokenId;
                return (
                  <label
                    key={x.id}
                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--sts)]"
                    style={{
                      borderColor: on ? "var(--idp)" : "var(--line)",
                      background: on
                        ? "color-mix(in oklab, var(--idp) 12%, var(--surface))"
                        : "var(--surface)",
                    }}
                  >
                    <input
                      type="radio"
                      name={`${ids}-tok`}
                      checked={on}
                      onChange={() => setTokenId(x.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: x.mine ? "var(--caller)" : "var(--deny)" }}
                    />
                    <span className="font-medium">{t(x.label)}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-[var(--caller)]" />
                {t({
                  en: "your repo example-org/infra",
                  ja: "自分のリポジトリ example-org/infra",
                })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-[var(--deny)]" />
                {t({ en: "someone else's repo", ja: "他人のリポジトリ" })}
              </span>
            </p>
          </fieldset>
          <Jwt claims={tok.claims} />
        </div>

        <div className="min-w-0 space-y-4">
          <Segmented
            label={{ en: "Trust policy sub condition", ja: "信頼ポリシーの sub 条件" }}
            value={presetId}
            onChange={pickPreset}
            color="var(--role)"
            options={[
              ...PRESETS.map((p) => ({ value: p.id, label: p.label })),
              ...(presetId === "custom"
                ? [{ value: "custom", label: { en: "Custom", ja: "カスタム" } }]
                : []),
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-[var(--muted)]">
                {t({ en: "Operator", ja: "演算子" })}
              </span>
              <select
                value={cond.sub?.op ?? "StringLike"}
                onChange={(e) => editSub({ op: e.target.value as Operator })}
                disabled={!cond.sub}
                className="min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-sm disabled:opacity-50"
              >
                <option value="StringEquals">StringEquals</option>
                <option value="StringLike">StringLike</option>
              </select>
            </label>
            <label className="min-w-0 text-sm">
              <span className="mb-1 block font-semibold text-[var(--muted)]">
                token.actions.githubusercontent.com:sub
              </span>
              <input
                value={cond.sub?.value ?? ""}
                placeholder={t({ en: "(no sub condition)", ja: "(sub 条件なし)" })}
                onChange={(e) => editSub({ value: e.target.value })}
                spellCheck={false}
                className="min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-sm"
              />
            </label>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {rich(
              t({
                en: "In `StringLike`, `*` matches any run of characters and `?` exactly one. Matching is case-sensitive and covers the whole value.",
                ja: "`StringLike` では `*` が任意の文字列、`?` がちょうど 1 文字に一致します。大文字小文字を区別し、値全体で一致判定します。",
              }),
            )}
          </p>

          <div
            className="rounded-xl border-2 px-4 py-3"
            style={{
              borderColor: v.color,
              background: `color-mix(in oklab, ${v.color} 9%, var(--surface))`,
            }}
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-bold" style={{ color: v.color }}>
                {t(v.label)}
              </span>
              {r.worldOpen && r.verdict !== "rejected-save" && (
                <span className="rounded-full bg-[var(--deny)] px-2 py-0.5 text-xs font-bold text-[var(--on-color)]">
                  {t({
                    en: "Open to every GitHub repo",
                    ja: "全 GitHub リポジトリに開放",
                  })}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm">{rich(t(r.why))}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="mb-2 text-sm font-semibold text-[var(--muted)]">
          {t({
            en: "This policy against every token",
            ja: "このポリシーで全トークンを評価すると",
          })}
        </h4>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {TOKENS.map((x) => {
            const rr = evaluateOidc(cond, x.claims);
            const ok = rr.verdict === "allowed";
            const bad = ok !== x.mine && rr.verdict !== "rejected-save";
            return (
              <li
                key={x.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                style={{
                  borderColor: bad && ok ? "var(--deny)" : "var(--line)",
                  borderWidth: bad && ok ? 2 : 1,
                }}
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: x.mine ? "var(--caller)" : "var(--deny)" }}
                  />
                  <span className="min-w-0">{t(x.label)}</span>
                </span>
                <span
                  className="shrink-0 font-mono text-xs font-bold"
                  style={{ color: ok ? "var(--resource)" : "var(--muted)" }}
                >
                  {rr.verdict === "rejected-save"
                    ? t({ en: "n/a", ja: "対象外" })
                    : ok
                      ? t({ en: "allowed", ja: "許可" })
                      : t({ en: "denied", ja: "拒否" })}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6">
        <Code label="trust-policy.json">{policyJson(cond)}</Code>
      </div>
    </Figure>
  );
}
