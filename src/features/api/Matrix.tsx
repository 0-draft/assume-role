import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { DURATIONS, formatDuration, logPos } from "./duration";
import { FAMILIES, OPS, type OpId } from "./ops";

const YES: L = { en: "Yes", ja: "あり" };
const NO: L = { en: "No", ja: "なし" };

const MFA: Partial<Record<OpId, L>> = { AssumeRole: YES, GetSessionToken: YES };

const POLICY: Partial<Record<OpId, L>> = {
  AssumeRole: YES,
  AssumeRoleWithSAML: YES,
  AssumeRoleWithWebIdentity: YES,
  GetFederationToken: { en: "Needed in practice", ja: "事実上必須" },
  AssumeRoot: { en: "Task policy only", ja: "タスクポリシーのみ" },
  GetDelegatedAccessToken: { en: "Partner template", ja: "パートナーのテンプレート" },
};

const TAGS: Partial<Record<OpId, L>> = {
  AssumeRole: { en: "Up to 50, transitive", ja: "最大 50、引き継ぎ可" },
  AssumeRoleWithSAML: { en: "From attributes", ja: "属性から" },
  AssumeRoleWithWebIdentity: { en: "From token claim", ja: "クレームから" },
  GetFederationToken: { en: "Up to 50", ja: "最大 50" },
  GetWebIdentityToken: { en: "As JWT claims", ja: "JWT クレームとして" },
};

const HEAD: L[] = [
  { en: "Operation", ja: "オペレーション" },
  { en: "Typical caller", ja: "主な呼び出し元" },
  { en: "Request auth", ja: "リクエスト認証" },
  { en: "Callable with temp creds", ja: "一時認証情報から" },
  { en: "Duration (log scale)", ja: "有効期間 (対数目盛)" },
  { en: "MFA", ja: "MFA" },
  { en: "Session policies", ja: "セッションポリシー" },
  { en: "Session tags", ja: "セッションタグ" },
  { en: "Returns", ja: "返り値" },
];

/**
 * Each duration as a tiny log-scale bar plus its numbers on one line, so the
 * column stays narrow instead of wrapping a sentence over five lines.
 */
function Durations({ op }: { op: OpId }) {
  const { t, lang } = useLang();
  const rows = DURATIONS.filter((d) => d.op === op);
  if (rows.length === 0)
    return (
      <span className="text-[var(--muted)]">
        {t({ en: "No credentials issued", ja: "認証情報は出ない" })}
      </span>
    );
  return (
    <span className="flex flex-col gap-1.5">
      {rows.map((d, i) => (
        <span key={i} className="block">
          <span
            className="relative block h-1.5 w-28 rounded-full bg-[var(--sunk)]"
            aria-hidden
          >
            <span
              className="absolute inset-y-0 rounded-full bg-[var(--sts)]"
              style={{
                left: `${logPos(d.min) * 100}%`,
                width: `max(4px, ${(logPos(d.max) - logPos(d.min)) * 100}%)`,
              }}
            />
          </span>
          <span className="mt-0.5 block text-xs whitespace-nowrap tabular-nums">
            {d.variant && <span className="text-[var(--muted)]">{t(d.variant)}: </span>}
            {formatDuration(d.min, lang)}–{formatDuration(d.max, lang)}
            {d.def !== undefined && (
              <span className="text-[var(--muted)]">
                {t({ en: ", default ", ja: "、既定 " })}
                {formatDuration(d.def, lang)}
              </span>
            )}
          </span>
        </span>
      ))}
    </span>
  );
}

/** All eleven operations side by side. Scrolls inside itself on phones. */
export function Matrix() {
  const { t } = useLang();
  return (
    <div className="scroll-x rounded-xl border border-[var(--line)]" tabIndex={0}>
      <table className="w-full min-w-[1440px] border-collapse text-left text-[0.85rem]">
        <caption className="sr-only">
          {t({
            en: "Comparison of all 11 STS operations",
            ja: "STS 全 11 オペレーションの比較",
          })}
        </caption>
        <thead className="bg-[var(--sunk)]">
          <tr>
            {HEAD.map((h, i) => (
              <th
                key={h.en}
                scope="col"
                className={`border-b border-[var(--line)] px-3 py-2 align-bottom font-semibold ${i === 0 ? "sticky left-0 z-10 bg-[var(--sunk)]" : ""}`}
              >
                {t(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OPS.map((o) => {
            const color = FAMILIES.find((f) => f.id === o.family)!.color;
            return (
              <tr key={o.id} className="border-b border-[var(--line)] last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-l-4 bg-[var(--surface)] px-3 py-2 font-mono text-[0.8rem] font-semibold"
                  style={{ borderLeftColor: color }}
                >
                  {o.id}
                </th>
                <td className="px-3 py-2">{t(o.matrix.caller)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {o.auth === "sigv4" ? "SigV4" : t({ en: "Unsigned", ja: "署名なし" })}
                  {o.regionalOnly && (
                    <span className="block text-xs text-[var(--deny)]">
                      {t({ en: "Regional only", ja: "リージョナル限定" })}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{t(o.matrix.temp)}</td>
                <td className="px-3 py-2">
                  <Durations op={o.id} />
                </td>
                <td className="px-3 py-2">{t(MFA[o.id] ?? NO)}</td>
                <td className="px-3 py-2">{t(POLICY[o.id] ?? NO)}</td>
                <td className="px-3 py-2">{t(TAGS[o.id] ?? NO)}</td>
                <td className="min-w-[26rem] px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {o.returns
                      .filter((r) => !r.startsWith("PackedPolicySize"))
                      .map((r) => (
                        <code
                          key={r}
                          className="chip text-[0.72rem] whitespace-nowrap [overflow-wrap:normal]"
                        >
                          {r}
                        </code>
                      ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
