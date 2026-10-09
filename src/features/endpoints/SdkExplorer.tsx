import { useId, useState } from "react";
import { useLang } from "@/i18n/useLang";
import { Figure, More, Segmented } from "@/components/ui";
import { rich } from "@/lib/rich";
import { LEGACY_GLOBAL_REGIONS } from "./regions";
import { resolveSdk, toolById, TOOLS, type Mode } from "./sdk";

const REGION_CHOICES: { value: string; label: string }[] = [
  { value: "us-east-1", label: "us-east-1" },
  { value: "eu-west-1", label: "eu-west-1" },
  { value: "ap-northeast-1", label: "ap-northeast-1 (Tokyo)" },
  { value: "ap-northeast-2", label: "ap-northeast-2 (Seoul)" },
  { value: "ap-east-1", label: "ap-east-1 (Hong Kong, opt-in)" },
  { value: "aws-global", label: "aws-global (pseudo-Region)" },
  { value: "none", label: "— none configured —" },
];

export function SdkExplorer() {
  const { t } = useLang();
  const toolId = useId();
  const regionId = useId();
  const [tool, setTool] = useState("boto3-new");
  const [setting, setSetting] = useState<Mode | "unset">("unset");
  const [region, setRegion] = useState("eu-west-1");
  const tl = toolById(tool);
  const r = resolveSdk(tl, setting, region === "none" ? null : region);

  const sel =
    "min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-sm";

  return (
    <Figure
      title={{
        en: "Which hostname will my SDK call?",
        ja: "自分の SDK はどのホスト名を呼ぶ?",
      }}
      hint={{
        en: "The same code can hit different endpoints depending on SDK version, one config key and whether a Region is set.",
        ja: "同じコードでも、SDK のバージョン、設定キー 1 つ、リージョン設定の有無で呼ぶエンドポイントが変わります。",
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor={toolId}
            className="mb-2 block text-sm font-semibold text-[var(--muted)]"
          >
            {t({ en: "SDK or tool", ja: "SDK / ツール" })}
          </label>
          <select
            id={toolId}
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            className={sel}
          >
            {TOOLS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={regionId}
            className="mb-2 block text-sm font-semibold text-[var(--muted)]"
          >
            {t({ en: "Region configured", ja: "設定されたリージョン" })}
          </label>
          <select
            id={regionId}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={sel}
          >
            {REGION_CHOICES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.value === "none"
                  ? t({ en: "none configured", ja: "未設定" })
                  : x.label}
              </option>
            ))}
          </select>
        </div>
        <Segmented
          label={{ en: "sts_regional_endpoints", ja: "sts_regional_endpoints" }}
          value={setting}
          onChange={setSetting}
          options={[
            { value: "unset", label: { en: "unset", ja: "未設定" } },
            { value: "legacy", label: { en: "legacy", ja: "legacy" } },
            { value: "regional", label: { en: "regional", ja: "regional" } },
          ]}
        />
      </div>

      <div
        className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--sunk)] p-4 sm:flex-row sm:items-center"
        aria-live="polite"
      >
        <span className="font-mono text-sm text-[var(--muted)]">{tl.label}</span>
        <svg viewBox="0 0 40 12" className="hidden h-3 w-10 sm:block" aria-hidden>
          <path
            d="M0 6h34M30 1l6 5-6 5"
            fill="none"
            stroke="var(--sts)"
            strokeWidth="2"
          />
        </svg>
        {r.host ? (
          <code
            className="rounded-lg px-2 py-1 font-mono text-lg font-semibold break-all"
            style={{
              color: r.host === "sts.amazonaws.com" ? "var(--caller)" : "var(--sts)",
              background: `color-mix(in oklab, ${r.host === "sts.amazonaws.com" ? "var(--caller)" : "var(--sts)"} 12%, transparent)`,
            }}
          >
            {r.host}
          </code>
        ) : (
          <span className="rounded-lg bg-[color-mix(in_oklab,var(--deny)_12%,transparent)] px-2 py-1 font-semibold text-[var(--deny)]">
            {t({ en: "Request fails", ja: "リクエスト失敗" })}
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li>{rich(t(r.why))}</li>
        {r.ignoredSetting && (
          <li className="text-[var(--muted)]">
            {rich(
              t({
                en: "This SDK doesn't read `sts_regional_endpoints` at all; the value you set is ignored. Use Region `aws-global` or an explicit endpoint URL to reach the global endpoint.",
                ja: "この SDK は `sts_regional_endpoints` を読みません。設定値は無視されます。グローバルに行きたいならリージョン `aws-global` か明示的なエンドポイント URL を使います。",
              }),
            )}
          </li>
        )}
        {tl.note && <li className="text-[var(--muted)]">{rich(t(tl.note))}</li>}
      </ul>

      <div className="mt-5 space-y-3">
        <More
          summary={{
            en: "The 15 Regions that `legacy` sends to the global endpoint",
            ja: "`legacy` がグローバルに送る 15 リージョン",
          }}
        >
          <p className="flex flex-wrap gap-1.5">
            {LEGACY_GLOBAL_REGIONS.map((x) => (
              <code key={x} className="chip">
                {x}
              </code>
            ))}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {t({
              en: "Seoul (ap-northeast-2) and Osaka (ap-northeast-3) are enabled by default but are not on this list, so they always resolve Regionally. Opt-in Regions are never on it.",
              ja: "ソウル (ap-northeast-2) と大阪 (ap-northeast-3) はデフォルト有効なのにこの一覧に入っていないため、常にリージョナルに解決されます。オプトインリージョンも入っていません。",
            })}
          </p>
        </More>
        <More
          summary={{
            en: "Defaults for every SDK, side by side",
            ja: "全 SDK のデフォルト一覧",
          }}
        >
          <div className="scroll-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--muted)]">
                  <th scope="col" className="py-1.5 pr-4">
                    {t({ en: "SDK or tool", ja: "SDK / ツール" })}
                  </th>
                  <th scope="col" className="py-1.5 pr-4">
                    {t({ en: "Reads the setting", ja: "設定を読むか" })}
                  </th>
                  <th scope="col" className="py-1.5 pr-4">
                    {t({ en: "Default", ja: "既定" })}
                  </th>
                  <th scope="col" className="py-1.5">
                    {t({ en: "No Region configured", ja: "リージョン未設定時" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map((x) => (
                  <tr key={x.id} className="border-b border-[var(--line)] last:border-0">
                    <th
                      scope="row"
                      className="py-1.5 pr-4 text-left font-mono font-normal whitespace-nowrap"
                    >
                      {x.label}
                    </th>
                    <td className="py-1.5 pr-4">
                      {x.readsSetting
                        ? t({ en: "Yes", ja: "はい" })
                        : t({ en: "No", ja: "いいえ" })}
                    </td>
                    <td className="py-1.5 pr-4 font-mono">
                      {x.readsSetting
                        ? x.defaultMode
                        : t({ en: "always regional", ja: "常に regional" })}
                    </td>
                    <td className="py-1.5 font-mono whitespace-nowrap">
                      {x.fallback === "global"
                        ? "sts.amazonaws.com"
                        : x.fallback === "us-east-1"
                          ? "sts.us-east-1.amazonaws.com"
                          : t({ en: "request fails", ja: "失敗" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {t({
              en: "From the AWS SDKs and Tools Reference Guide, corrected for the 2025-07-31 Boto3 1.40.0 and CLI v1 1.42.0 releases. The guide's own table still shows the old values for those two.",
              ja: "AWS SDK とツールのリファレンスガイドの表を、2025-07-31 の Boto3 1.40.0 と CLI v1 1.42.0 のリリースに合わせて補正したもの。ガイド本体の表はこの 2 つについてまだ古い値のままです。",
            })}
          </p>
        </More>
      </div>
    </Figure>
  );
}
