import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
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
  { en: "Duration min / default / max", ja: "期間 最短 / デフォルト / 上限" },
  { en: "MFA", ja: "MFA" },
  { en: "Session policies", ja: "セッションポリシー" },
  { en: "Session tags", ja: "セッションタグ" },
  { en: "Returns", ja: "返り値" },
];

/** All eleven operations side by side. Scrolls inside itself on phones. */
export function Matrix() {
  const { t } = useLang();
  return (
    <div className="scroll-x rounded-xl border border-[var(--line)]" tabIndex={0}>
      <table className="w-full min-w-[1080px] border-collapse text-left text-[0.85rem]">
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
                <td className="px-3 py-2 tabular-nums">{t(o.matrix.duration)}</td>
                <td className="px-3 py-2">{t(MFA[o.id] ?? NO)}</td>
                <td className="px-3 py-2">{t(POLICY[o.id] ?? NO)}</td>
                <td className="px-3 py-2">{t(TAGS[o.id] ?? NO)}</td>
                <td className="px-3 py-2 font-mono text-[0.75rem]">
                  {o.returns.filter((r) => !r.startsWith("PackedPolicySize")).join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
