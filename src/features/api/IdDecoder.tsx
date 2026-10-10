import { useId, useState } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { decodeId, type IdKind } from "./prefix";

const PRESETS = [
  "AKIAI44QH8DHBEXAMPLE",
  "ASIAIOSFODNN7EXAMPLE",
  "AROA123EXAMPLE123:alice-cli",
  "AIDACKCEVSQ6C2EXAMPLE",
  "123456789012:Bob",
];

const KIND_COLOR: Record<IdKind, string> = {
  "long-term-key": "var(--deny)",
  "temp-key": "var(--sts)",
  principal: "var(--role)",
  other: "var(--muted)",
};

const KIND_NOTE: Record<IdKind, L> = {
  "long-term-key": {
    en: "A long-term key of an IAM user or the root user. It never expires on its own. `GetAccessKeyInfo` returns its account; the credential report tells you which user.",
    ja: "IAM ユーザーかルートの長期キーです。自動では失効しません。`GetAccessKeyInfo` で持ち主のアカウントがわかり、どのユーザーかは認証情報レポートで調べます。",
  },
  "temp-key": {
    en: "Printed by STS. On its own it is useless: it only works together with its secret key and session token. `GetAccessKeyInfo` returns its account; the STS events in CloudTrail tell you who received it.",
    ja: "STS が発行したキーです。シークレットキーとセッショントークンとセットでないと使えません。`GetAccessKeyInfo` で持ち主のアカウントがわかり、誰が受け取ったかは CloudTrail の STS イベントで追えます。",
  },
  principal: {
    en: "The unique ID of a principal, not a key, so `GetAccessKeyInfo` does not apply. Trust policies store these IDs, which is why deleting and recreating a role breaks them.",
    ja: "プリンシパルの一意 ID です。キーではないので `GetAccessKeyInfo` の対象外です。信頼ポリシーは内部でこの ID を保存するため、ロールを削除して作り直すと一致しなくなります。",
  },
  other: {
    en: "Not an access key, so `GetAccessKeyInfo` does not apply.",
    ja: "アクセスキーではないので `GetAccessKeyInfo` の対象外です。",
  },
};

/** Type an identifier, see what its first four letters say. */
export function IdDecoder() {
  const { t } = useLang();
  const id = useId();
  const [value, setValue] = useState(PRESETS[1]);
  const d = decodeId(value);
  const trimmed = value.trim();

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-semibold text-[var(--muted)]"
        >
          {t({
            en: "An access key ID, unique ID or aws:userid value",
            ja: "アクセスキー ID、一意 ID、または aws:userid の値",
          })}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-lg border-2 border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-base focus:border-[var(--sts)]"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue(p)}
              aria-pressed={p === value}
              className="min-h-9 rounded-md border border-[var(--line)] px-2 font-mono text-xs aria-pressed:border-[var(--sts)] aria-pressed:bg-[var(--sunk)]"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <output
        htmlFor={id}
        aria-live="polite"
        className="block rounded-xl border border-[var(--line)] bg-[var(--sunk)] p-4"
      >
        {d.status === "empty" &&
          t({ en: "Type or pick an ID.", ja: "ID を入力するか選んでください。" })}
        {d.status === "short" &&
          t({ en: "Need at least 4 characters.", ja: "4 文字以上必要です。" })}
        {d.status === "unknown" && (
          <span>
            {rich(
              t({
                en: `\`${d.prefix}\` is not a documented prefix. AWS notes prefixes may vary with when an ID was created.`,
                ja: `\`${d.prefix}\` はドキュメントにある接頭辞ではありません。AWS は、作成時期によって接頭辞が異なることがあると注記しています。`,
              }),
            )}
          </span>
        )}
        {d.status === "account" && (
          <span className="block space-y-1">
            <span className="block font-display text-xl font-bold">
              {d.name
                ? t({
                    en: "aws:userid of a federated user",
                    ja: "フェデレーションユーザーの aws:userid",
                  })
                : t({ en: "A 12-digit account ID", ja: "12 桁のアカウント ID" })}
            </span>
            <span className="block">
              {rich(
                d.name
                  ? t({
                      en: `Account \`${d.account}\`, name \`${d.name}\`. This is the shape \`GetFederationToken\` sessions take.`,
                      ja: `アカウントは \`${d.account}\`、名前は \`${d.name}\` です。\`GetFederationToken\` のセッションはこの形になります。`,
                    })
                  : t({
                      en: "For the root user, `aws:userid` is just this account ID.",
                      ja: "ルートユーザーの `aws:userid` は、このアカウント ID そのものです。",
                    }),
              )}
            </span>
          </span>
        )}
        {d.status === "match" && (
          <span className="block space-y-2">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-lg [overflow-wrap:anywhere]">
                <span
                  className="rounded px-1 font-bold text-[var(--on-color)]"
                  style={{ background: KIND_COLOR[d.entry.kind] }}
                >
                  {trimmed.slice(0, 4)}
                </span>
                <span className="text-[var(--muted)]">{trimmed.slice(4)}</span>
              </span>
              <span className="font-display text-xl font-bold">{t(d.entry.label)}</span>
            </span>
            {d.session && d.entry.prefix === "AROA" && (
              <span className="block">
                {rich(
                  t({
                    en: `This is the \`aws:userid\` of a role session: role ID, a colon, then the session name \`${d.session}\`.`,
                    ja: `ロールセッションの \`aws:userid\` です。ロール ID、コロン、セッション名 \`${d.session}\` の順に並びます。`,
                  }),
                )}
              </span>
            )}
            <span className="block">{rich(t(KIND_NOTE[d.entry.kind]))}</span>
          </span>
        )}
      </output>
    </div>
  );
}
