import { useId, useState } from "react";
import { useLang } from "@/i18n/useLang";
import { Code } from "@/components/ui";
import { LIMITS, estimateToken, type TokenInput } from "./model";

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-xs tabular-nums">
          {value}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--sts)]"
      />
    </div>
  );
}

function LimitBar({ label, used, max }: { label: string; used: number; max: number }) {
  const ok = used <= max;
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs">
        <span>{label}</span>
        <span
          className="font-mono tabular-nums"
          style={{ color: ok ? "var(--muted)" : "var(--deny)" }}
        >
          {used} / {max}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--sunk)]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.min(100, (used / max) * 100)}%`,
            background: ok ? "var(--resource)" : "var(--deny)",
          }}
        />
      </div>
    </div>
  );
}

const START: TokenInput = {
  tagCount: 5,
  tagChars: 24,
  inlinePolicyChars: 400,
  managedArns: 1,
  minimumSize: 0,
};

export function TokenMeter() {
  const { t } = useLang();
  const [input, setInput] = useState(START);
  const e = estimateToken(input);
  const set = (p: Partial<TokenInput>) => setInput((i) => ({ ...i, ...p }));
  const scale = Math.max(LIMITS.tokenBytes, e.bytes);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const limitAt = (LIMITS.tokenBytes / scale) * 100;
  const segs = [
    {
      key: "base",
      n: e.segments.base,
      color: "var(--muted)",
      label: t({ en: "credentials and session info", ja: "認証情報とセッション情報" }),
    },
    {
      key: "tags",
      n: e.segments.tags,
      color: "var(--caller)",
      label: t({ en: "session tags", ja: "セッションタグ" }),
    },
    {
      key: "policy",
      n: e.segments.policy,
      color: "var(--role)",
      label: t({ en: "session policies", ja: "セッションポリシー" }),
    },
    {
      key: "padding",
      n: e.segments.padding,
      color: "var(--sts)",
      label: "MinimumSessionTokenSize",
    },
  ];
  const error = !e.policyPlaintextOk ? "plaintext" : e.tooLarge ? "packed" : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-4">
        <Slider
          label={t({ en: "Session tags", ja: "セッションタグ数" })}
          value={input.tagCount}
          min={0}
          max={LIMITS.tags}
          onChange={(v) => set({ tagCount: v })}
        />
        <Slider
          label={t({
            en: "Characters per tag (key + value)",
            ja: "タグ 1 つの文字数 (キー + 値)",
          })}
          value={input.tagChars}
          min={2}
          max={LIMITS.tagKey + LIMITS.tagValue}
          onChange={(v) => set({ tagChars: v })}
        />
        <Slider
          label={t({ en: "Inline session policy", ja: "インラインセッションポリシー" })}
          value={input.inlinePolicyChars}
          min={0}
          max={2400}
          step={20}
          unit={t({ en: " chars", ja: " 文字" })}
          onChange={(v) => set({ inlinePolicyChars: v })}
        />
        <Slider
          label={t({ en: "Managed policy ARNs", ja: "マネージドポリシー ARN" })}
          value={input.managedArns}
          min={0}
          max={LIMITS.managedArns}
          onChange={(v) => set({ managedArns: v })}
        />
        <Slider
          label="MinimumSessionTokenSize"
          value={input.minimumSize}
          min={0}
          max={LIMITS.minimumSessionTokenSize}
          step={256}
          unit=" B"
          onChange={(v) => set({ minimumSize: v })}
        />
      </div>

      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-semibold">
            {t({
              en: "Documented limits, checked exactly",
              ja: "文書化された上限 (厳密)",
            })}
          </div>
          <LimitBar
            label={t({
              en: "Policy plaintext (inline + ARN characters)",
              ja: "ポリシーの平文 (インライン + ARN の文字数)",
            })}
            used={e.policyPlaintext}
            max={LIMITS.policyPlaintext}
          />
          <LimitBar
            label={t({ en: "Session tags", ja: "セッションタグ" })}
            used={input.tagCount}
            max={LIMITS.tags}
          />
          <LimitBar
            label={t({ en: "Managed policy ARNs", ja: "マネージドポリシー ARN" })}
            used={input.managedArns}
            max={LIMITS.managedArns}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">
              {t({ en: "Session token budget", ja: "セッショントークンの予算" })}{" "}
              <span className="font-normal text-[var(--muted)]">
                {t({ en: "(illustration)", ja: "(イメージ)" })}
              </span>
            </span>
            <span
              className="font-display text-2xl font-bold tabular-nums"
              style={{ color: e.tooLarge ? "var(--deny)" : "var(--ink)" }}
            >
              {e.utilization}%
            </span>
          </div>
          <div className="relative mt-2 h-9 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--sunk)]">
            <div className="flex h-full">
              {segs.map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${s.n} B`}
                  className="h-full transition-[width]"
                  style={{
                    width: pct(s.n),
                    background:
                      s.key === "padding"
                        ? `repeating-linear-gradient(45deg, ${s.color} 0 4px, transparent 4px 8px)`
                        : s.color,
                    opacity: s.key === "base" ? 0.55 : 0.9,
                  }}
                />
              ))}
            </div>
            <div
              className="absolute top-0 bottom-0 border-l-2 border-dashed border-[var(--deny)]"
              style={{ left: `${limitAt}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[0.68rem] text-[var(--muted)]">
            <span>0 B</span>
            <span>4096 B</span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {segs.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block size-3 rounded-sm"
                  style={{ background: s.color, opacity: s.key === "base" ? 0.55 : 0.9 }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        {error ? (
          <p
            className="rounded-lg border-2 border-[var(--deny)] px-3 py-2 text-sm"
            aria-live="polite"
          >
            <strong className="font-mono text-[var(--deny)]">
              {error === "packed"
                ? "PackedPolicyTooLarge"
                : t({ en: "Rejected", ja: "拒否" })}
            </strong>{" "}
            {error === "packed"
              ? t({
                  en: "Every individual limit can be met and the token can still be too big: tags and policies share one budget.",
                  ja: "個々の上限をすべて守っていても、タグとポリシーは同じ予算を食い合うので、トークンが大きすぎて失敗することがあります。",
                })
              : t({
                  en: "Inline policy plus ARN characters must stay within 2048.",
                  ja: "インラインポリシーと ARN の文字数の合計は 2048 以内にする必要があります。",
                })}
          </p>
        ) : (
          <Code
            label={t({
              en: "AssumeRole response (excerpt)",
              ja: "AssumeRole のレスポンス (抜粋)",
            })}
          >
            {`"SessionTokenSize": ${e.bytes},\n"SessionTokenUtilization": ${e.utilization},\n"PackedPolicySize": ${e.utilization}`}
          </Code>
        )}
        <p className="text-xs text-[var(--muted)]">
          {t({
            en: "AWS documents the 4096-byte token limit and the input limits, but not how tags and policies are packed into the token. The bar's byte weights are invented to show the shape of the trade-off; read SessionTokenUtilization from a real response to know your number. PackedPolicySize is deprecated and now reports the same value.",
            ja: "4096 バイトのトークン上限と入力側の上限は文書化されていますが、タグやポリシーをトークンにどう詰めるかは公開されていません。このバーのバイト数は傾向を見せるための仮の値です。実際の値は本物のレスポンスの SessionTokenUtilization で確認してください。PackedPolicySize は非推奨で、現在は同じ値を返します。",
          })}
        </p>
      </div>
    </div>
  );
}
