import { useId, useMemo, useState } from "react";
import { Callout, Figure, P, Section, Src } from "@/components/ui";
import { NAV, chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import type { L } from "@/i18n/lang";
import { rich } from "@/lib/rich";
import { ERRORS, type StsError } from "./data";
import { matchError } from "./match";

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "AccessDenied",
    text: "An error occurred (AccessDenied) when calling the AssumeRole operation: User: arn:aws:iam::111122223333:user/alice is not authorized to perform: sts:AssumeRole on resource: arn:aws:iam::444455556666:role/deploy",
  },
  {
    label: "ExpiredToken",
    text: "An error occurred (ExpiredToken) when calling the ListBuckets operation: The security token included in the request is expired",
  },
  {
    label: "InvalidIdentityToken",
    text: "An error occurred (InvalidIdentityToken) when calling the AssumeRoleWithWebIdentity operation: No OpenIDConnect provider found in your account for https://token.actions.githubusercontent.com",
  },
  {
    label: "AuthFailure",
    text: "An error occurred (AuthFailure) when calling the DescribeInstances operation: AWS was not able to validate the provided access credentials",
  },
  {
    label: "Rate exceeded",
    text: "An error occurred (Throttling) when calling the AssumeRole operation (reached max retries: 4): Rate exceeded",
  },
];

export function ErrorsSection() {
  const { t } = useLang();
  const inputId = useId();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string>(ERRORS[0].id);

  const matches = useMemo(() => matchError(text), [text]);
  const typing = text.trim().length > 0;
  const current: StsError | undefined = typing
    ? matches[0]
    : ERRORS.find((e) => e.id === picked);

  return (
    <Section
      id="errors"
      index={chapter("errors")}
      title={{ en: "Decode the error you just got", ja: "いま出たエラーを読み解く" }}
      lede={{
        en: "STS errors are terse and several share the same words. Paste one in, or pick it from the list, and see what actually went wrong and where to look.",
        ja: "STS のエラーは短く、似た文言も多い。貼り付けるか一覧から選ぶと、何が起きていて、どこを見ればいいかがわかります。",
      }}
    >
      <Figure
        title={{ en: "Error decoder", ja: "エラーデコーダー" }}
        hint={{
          en: "Paste the full message from the CLI or SDK. Matching runs in your browser; nothing is sent anywhere.",
          ja: "CLI や SDK のメッセージを丸ごと貼り付けてください。照合はブラウザ内で行い、どこにも送信しません。",
        }}
      >
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-semibold text-[var(--muted)]"
        >
          {t({ en: "Error message", ja: "エラーメッセージ" })}
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="An error occurred (…) when calling the AssumeRole operation: …"
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--sunk)] px-3 py-2 font-mono text-[0.82rem] placeholder:text-[var(--muted)]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">{t({ en: "Try:", ja: "例:" })}</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setText(s.text)}
              className="min-h-9 rounded-lg border border-[var(--line)] px-2.5 font-mono text-xs hover:border-[var(--deny)]"
            >
              {s.label}
            </button>
          ))}
          {typing && (
            <button
              type="button"
              onClick={() => setText("")}
              className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-[var(--muted)] underline"
            >
              {t({ en: "Clear", ja: "クリア" })}
            </button>
          )}
        </div>

        <div className="mt-6" aria-live="polite">
          {current ? (
            <Diagnosis error={current} />
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-[var(--muted)]">
              {t({
                en: "No documented STS error matches that text. Check the error code in parentheses, or pick one from the list below.",
                ja: "該当する STS のエラーが見つかりません。括弧内のエラーコードを確認するか、下の一覧から選んでください。",
              })}
            </p>
          )}
          {typing && matches.length > 1 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {t({ en: "Also possible: ", ja: "ほかの候補: " })}
              {matches.slice(1, 4).map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ", "}
                  <code className="chip">{m.code}</code>
                </span>
              ))}
            </p>
          )}
        </div>
      </Figure>

      <div>
        <h3 className="mb-3 font-display text-xl font-bold">
          {t({ en: "Every error, by code", ja: "エラーコード一覧" })}
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ERRORS.map((e) => {
            const on = !typing && e.id === picked;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setText("");
                    setPicked(e.id);
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left"
                  style={{
                    borderColor: on ? "var(--deny)" : "var(--line)",
                    background: on
                      ? "color-mix(in oklab, var(--deny) 10%, var(--surface))"
                      : "var(--surface)",
                  }}
                >
                  <span className="min-w-0 font-mono text-[0.8rem] font-semibold break-words">
                    {e.code}
                  </span>
                  {e.http !== null && (
                    <span className="shrink-0 font-mono text-xs text-[var(--muted)] tabular-nums">
                      {e.http}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Callout kind="note">
        {{
          en: "SDK exception classes add an `Exception` suffix (`RegionDisabledException`); the wire error code in the API Reference omits it (`RegionDisabled`). Search for both.",
          ja: "SDK の例外クラスには `Exception` が付く (`RegionDisabledException`)。API リファレンスのワイヤ上のエラーコードには付かない (`RegionDisabled`)。両方で検索しよう。",
        }}
      </Callout>
      <P>
        {{
          en: "A failed cross-account `AssumeRole` is logged only in the caller's account, never in the role's account. If you own the role and cannot find the failure in your CloudTrail, that is why.",
          ja: "失敗したクロスアカウントの `AssumeRole` は呼び出し側アカウントにしか記録されず、ロール側には残らない。ロールの持ち主が自分の CloudTrail で失敗を見つけられないのはこのため。",
        }}
      </P>
    </Section>
  );
}

const STEPS: { key: "symptom" | "cause" | "fix"; label: L; color: string }[] = [
  {
    key: "symptom",
    label: { en: "What you see", ja: "見えている症状" },
    color: "var(--deny)",
  },
  { key: "cause", label: { en: "Why it happens", ja: "原因" }, color: "var(--caller)" },
  { key: "fix", label: { en: "What to do", ja: "対処" }, color: "var(--resource)" },
];

function Diagnosis({ error }: { error: StsError }) {
  const { t } = useLang();
  const nav = NAV.find((n) => n.id === error.chapter);
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xl font-semibold break-all text-[var(--deny)]">
          {error.code}
        </span>
        {error.http !== null && (
          <span className="rounded-md border border-[var(--line)] px-1.5 font-mono text-xs">
            HTTP {error.http}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        <span className="text-[var(--muted)]">
          {t({ en: "Returned by", ja: "返す API" })}
        </span>
        {error.apis.map((a) => (
          <code key={a} className="chip">
            {a}
          </code>
        ))}
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className="relative rounded-xl border-2 bg-[var(--surface)] p-3"
            style={{ borderColor: s.color }}
          >
            <div
              className="mb-1 flex items-center gap-2 text-sm font-bold"
              style={{ color: s.color }}
            >
              <span
                aria-hidden
                className="inline-grid size-6 place-items-center rounded-full text-xs text-[var(--on-color)]"
                style={{ background: s.color }}
              >
                {i + 1}
              </span>
              {t(s.label)}
            </div>
            <p
              className={`text-[0.9rem] ${s.key === "symptom" ? "font-mono text-[0.78rem] break-words" : ""}`}
            >
              {rich(t(error[s.key]))}
            </p>
            {i < 2 && (
              <span
                aria-hidden
                className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-lg text-[var(--muted)] md:top-1/2 md:-right-3 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2"
              >
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">›</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {nav && (
          <a
            href={`#${nav.id}`}
            className="font-semibold text-[var(--sts)] underline underline-offset-2"
          >
            {t({ en: "How this works: ", ja: "仕組みの解説: " })}
            {t(nav.label)}
          </a>
        )}
        <Src href={error.source}>{t({ en: "Source", ja: "出典" })}</Src>
      </div>
    </div>
  );
}
