import { useId, useState } from "react";
import { useLang } from "@/i18n/useLang";
import { Figure, Segmented } from "@/components/ui";
import { canDeactivate, filterRegions, REGIONS, type RegionFilter } from "./regions";

export function DepartureBoard() {
  const { t } = useLang();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RegionFilter>("all");
  const rows = filterRegions(query, filter);

  const th =
    "px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-[var(--sts)]";
  const td = "px-3 py-1.5 whitespace-nowrap";

  return (
    <Figure
      title={{
        en: "Every Regional window, on one board",
        ja: "全リージョンの窓口を一枚のボードに",
      }}
      hint={{
        en: "All 34 commercial Regions as of 2026-10-10. Type to filter by code or name.",
        ja: "2026-10-10 時点の商用 34 リージョン。コードや名前で絞り込めます。",
      }}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-semibold text-[var(--muted)]"
          >
            {t({ en: "Search", ja: "検索" })}
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({
              en: "tokyo, eu-, ap-southeast…",
              ja: "東京、eu-、ap-southeast…",
            })}
            className="min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-sm"
          />
        </div>
        <Segmented
          label={{ en: "Show", ja: "表示" }}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: { en: "All", ja: "すべて" } },
            {
              value: "default",
              label: { en: "Enabled by default", ja: "デフォルト有効" },
            },
            { value: "optin", label: { en: "Opt-in", ja: "オプトイン" } },
            { value: "fips", label: { en: "Has FIPS", ja: "FIPS あり" } },
          ]}
        />
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label={t({
          en: "STS endpoints by Region",
          ja: "リージョン別 STS エンドポイント",
        })}
        className="scroll-x mt-4 max-h-[32rem] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--sunk)]"
      >
        <table className="w-full border-collapse font-mono text-[0.8rem]">
          <caption className="sr-only">
            {t({
              en: "STS endpoints per commercial Region",
              ja: "商用リージョンごとの STS エンドポイント",
            })}
          </caption>
          <thead className="sticky top-0 z-10 bg-[var(--sunk)]">
            <tr className="border-b-2 border-[var(--line)]">
              <th scope="col" className={`${th} sticky left-0 bg-[var(--sunk)]`}>
                {t({ en: "Region", ja: "リージョン" })}
              </th>
              <th scope="col" className={th}>
                {t({ en: "Name", ja: "名前" })}
              </th>
              <th scope="col" className={th}>
                {t({ en: "Type", ja: "種別" })}
              </th>
              <th scope="col" className={th}>
                {t({ en: "Regional", ja: "リージョナル" })}
              </th>
              <th scope="col" className={th}>
                {t({ en: "Dual-stack", ja: "デュアルスタック" })}
              </th>
              <th scope="col" className={th}>
                FIPS
              </th>
              <th scope="col" className={th}>
                {t({ en: "Can switch STS off", ja: "STS を無効化できる" })}
              </th>
              <th scope="col" className={th}>
                {t({ en: "VPC endpoint in IAM list", ja: "IAM の VPCE 一覧" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-[var(--line)] last:border-0">
                <th
                  scope="row"
                  className={`${td} sticky left-0 bg-[var(--sunk)] text-left font-semibold`}
                >
                  {r.code}
                </th>
                <td className={`${td} font-sans`}>
                  {t(r.name)}
                  {r.missingFromIamTable && (
                    <span
                      className="ml-1 text-[var(--muted)]"
                      title={t({
                        en: "Missing from the IAM STS Regions table; listed in the General Reference",
                        ja: "IAM の STS リージョン表には未掲載 (General Reference には掲載)",
                      })}
                    >
                      *
                    </span>
                  )}
                </td>
                <td className={td}>
                  <span
                    className="rounded px-1.5 py-0.5 font-sans text-xs font-semibold"
                    style={{
                      color: r.optIn ? "var(--caller)" : "var(--role)",
                      background: `color-mix(in oklab, ${r.optIn ? "var(--caller)" : "var(--role)"} 12%, transparent)`,
                    }}
                  >
                    {r.optIn
                      ? t({ en: "opt-in", ja: "オプトイン" })
                      : t({ en: "default", ja: "デフォルト" })}
                  </span>
                </td>
                <td className={td}>sts.{r.code}.amazonaws.com</td>
                <td className={td}>sts.{r.code}.api.aws</td>
                <td className={td}>
                  {r.fips ? (
                    `sts-fips.${r.code}.amazonaws.com`
                  ) : (
                    <span className="text-[var(--muted)]">
                      {t({ en: "none", ja: "なし" })}
                    </span>
                  )}
                </td>
                <td className={`${td} font-sans`}>
                  {canDeactivate(r)
                    ? t({ en: "Yes", ja: "はい" })
                    : r.optIn
                      ? t({
                          en: "No, always on once enabled",
                          ja: "不可 (有効化したら常時オン)",
                        })
                      : t({ en: "No", ja: "不可" })}
                </td>
                <td className={`${td} font-sans`}>
                  {r.vpceListed
                    ? t({ en: "Listed", ja: "掲載" })
                    : t({ en: "Not listed (unverified)", ja: "未掲載 (未検証)" })}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center font-sans text-[var(--muted)]"
                >
                  {t({
                    en: "No Region matches. Try a code like eu- or a city name.",
                    ja: "該当なし。eu- のようなコードか都市名で探してください。",
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {t({
          en: `${rows.length} of ${REGIONS.length} shown. * Taipei and New Zealand are missing from the IAM table but present in the General Reference. "Not listed" may only mean the IAM page is stale: check with aws ec2 describe-vpc-endpoint-services.`,
          ja: `${REGIONS.length} 件中 ${rows.length} 件を表示。* 台北とニュージーランドは IAM の表に載っていないが General Reference には載っている。「未掲載」は IAM のページが古いだけの可能性あり。aws ec2 describe-vpc-endpoint-services で確認を。`,
        })}
      </p>
    </Figure>
  );
}
