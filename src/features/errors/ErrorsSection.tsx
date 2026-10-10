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
        ja: "STS のエラーは短く、似た文言も多いです。メッセージを貼り付けるか一覧から選ぶと、何が起きていて、どこを見ればいいかがわかります。",
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
                  <span
                    className={`min-w-0 break-words ${e.kind === "symptom" ? "text-[0.85rem] font-semibold" : "font-mono text-[0.8rem] font-semibold"}`}
                  >
                    {e.code}
                  </span>
                  <Badge error={e} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Callout kind="note">
        {{
          en: "SDK exception classes add an `Exception` suffix (`RegionDisabledException`); the wire error code in the API Reference omits it (`RegionDisabled`). Search for both.",
          ja: "SDK の例外クラスには `Exception` が付きます (`RegionDisabledException`)。API リファレンスに載っているワイヤ上のエラーコードには付きません (`RegionDisabled`)。調べるときは両方で検索してください。",
        }}
      </Callout>
      <P>
        {{
          en: "A failed cross-account `AssumeRole` is logged only in the caller's account, never in the role's account. If you own the role and cannot find the failure in your CloudTrail, that is why.",
          ja: "失敗したクロスアカウントの `AssumeRole` は呼び出し側のアカウントにしか記録されず、ロール側には残りません。ロールの持ち主が自分の CloudTrail で失敗を見つけられないのはこのためです。",
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

function Badge({ error }: { error: StsError }) {
  const { t } = useLang();
  if (error.kind === "symptom")
    return (
      <span className="shrink-0 rounded-full border border-dashed border-[var(--muted)] px-2 text-xs font-semibold text-[var(--muted)]">
        {t({ en: "symptom", ja: "症状" })}
      </span>
    );
  if (error.origin)
    return (
      <span className="shrink-0 rounded-full border border-[var(--line)] px-2 text-xs font-semibold text-[var(--muted)]">
        {t(error.origin)}
      </span>
    );
  if (error.http !== null)
    return (
      <span className="shrink-0 font-mono text-xs text-[var(--muted)] tabular-nums">
        {error.http}
      </span>
    );
  return null;
}

function Diagnosis({ error }: { error: StsError }) {
  const { t } = useLang();
  const nav = NAV.find((n) => n.id === error.chapter);
  const symptom = error.kind === "symptom";
  return (
    <div>
      <div className="guilloche relative grid grid-cols-[1fr_auto_auto] overflow-hidden rounded-2xl border-2 border-[var(--deny)] shadow-[var(--shadow)]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="text-xs font-semibold text-[var(--deny)]">
            {symptom
              ? t({
                  en: "Known failure, no error code of its own",
                  ja: "専用のエラーコードがない既知の失敗",
                })
              : error.origin
                ? t({
                    en: "Refused by another service, caused by STS",
                    ja: "原因は STS、拒否したのは別サービス",
                  })
                : t({ en: "Request refused", ja: "リクエスト不受理" })}
          </div>
          <div
            className={`mt-1 break-words text-[var(--deny)] ${symptom ? "font-display text-2xl font-bold" : "font-mono text-xl font-semibold sm:text-2xl"}`}
          >
            {error.code}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--muted)]">
              {t({ en: "Returned by", ja: "返す API" })}
            </span>
            {error.apis.map((a) => (
              <code key={a} className="chip">
                {a}
              </code>
            ))}
          </div>
        </div>
        <div className="perforated w-3" aria-hidden />
        <div className="flex w-24 flex-col items-center justify-center gap-0.5 border-l border-[var(--line)] bg-[var(--sunk)] px-2 text-center sm:w-28">
          <span className="text-[0.7rem] text-[var(--muted)]">HTTP</span>
          <span className="font-mono text-2xl font-semibold text-[var(--deny)] tabular-nums">
            {error.http ?? "—"}
          </span>
          {error.origin && (
            <span className="text-[0.7rem] text-[var(--muted)]">{t(error.origin)}</span>
          )}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute top-3 right-32 hidden rotate-[-8deg] rounded-md border-[3px] border-[var(--deny)] px-2 font-display text-lg font-bold text-[var(--deny)] opacity-80 sm:block"
        >
          {t({ en: "Refused", ja: "不受理" })}
        </span>
      </div>
      <ol className="mt-5 grid gap-7 md:grid-cols-3 md:gap-6">
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
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                className="absolute -bottom-[1.45rem] left-1/2 size-4 -translate-x-1/2 text-[var(--muted)] md:top-1/2 md:-right-[1.2rem] md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2 md:-rotate-90"
              >
                <path
                  d="M6 1v9M2 6l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
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
