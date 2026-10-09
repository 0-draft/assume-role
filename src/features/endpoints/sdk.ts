import type { L } from "@/i18n/lang";
import { LEGACY_GLOBAL_REGIONS } from "./regions";
import { GLOBAL_HOST, regionalHost } from "./model";

/**
 * Which STS hostname each SDK or tool calls, from the SDK Reference Guide table
 * (as of 2026-10-10) corrected by the 2025-07-31 release announcements for
 * Boto3 1.40.0 and AWS CLI v1 1.42.0. See docs/02-endpoints.md.
 */

export type Mode = "legacy" | "regional";
export type Fallback = "global" | "us-east-1" | "fail";

export interface Tool {
  id: string;
  label: string;
  /** Reads sts_regional_endpoints / AWS_STS_REGIONAL_ENDPOINTS. */
  readsSetting: boolean;
  /** Default mode when the setting is unset (only meaningful if readsSetting). */
  defaultMode: Mode;
  /** What happens when no Region is configured at all. */
  fallback: Fallback;
  note?: L;
}

export const TOOLS: Tool[] = [
  {
    id: "cli-v2",
    label: "AWS CLI v2",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "global",
  },
  {
    id: "cli-v1-new",
    label: "AWS CLI v1 ≥ 1.42.0",
    readsSetting: true,
    defaultMode: "regional",
    fallback: "global",
    note: {
      en: "Flipped to `regional` on 2025-07-31. AWS's SDK table and the CLI v1 docs still say `legacy`; the release announcement wins.",
      ja: "2025-07-31 に `regional` へ変更。AWS の SDK 一覧表と CLI v1 のドキュメントはまだ `legacy` と書いているが、リリース告知のほうが正しい。",
    },
  },
  {
    id: "cli-v1-old",
    label: "AWS CLI v1 < 1.42.0",
    readsSetting: true,
    defaultMode: "legacy",
    fallback: "global",
  },
  {
    id: "boto3-new",
    label: "Boto3 ≥ 1.40.0",
    readsSetting: true,
    defaultMode: "regional",
    fallback: "global",
    note: {
      en: "Flipped to `regional` on 2025-07-31. Allowlists that only permit sts.amazonaws.com break on upgrade.",
      ja: "2025-07-31 に `regional` へ変更。sts.amazonaws.com しか許可していない許可リストはアップグレードで壊れる。",
    },
  },
  {
    id: "boto3-old",
    label: "Boto3 < 1.40.0",
    readsSetting: true,
    defaultMode: "legacy",
    fallback: "global",
  },
  {
    id: "js-v3",
    label: "JavaScript v3",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "us-east-1",
  },
  {
    id: "js-v2",
    label: "JavaScript v2",
    readsSetting: true,
    defaultMode: "legacy",
    fallback: "global",
  },
  {
    id: "go-v2",
    label: "Go v2",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "fail",
  },
  {
    id: "go-v1",
    label: "Go v1",
    readsSetting: true,
    defaultMode: "legacy",
    fallback: "global",
  },
  {
    id: "java-2",
    label: "Java 2.x",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "fail",
    note: {
      en: "With no Region, AWS's table says requests fail, except AssumeRole and AssumeRoleWithWebIdentity, which use the global endpoint.",
      ja: "リージョン未設定だと失敗する。ただし AssumeRole と AssumeRoleWithWebIdentity だけはグローバルエンドポイントを使う (AWS の表より)。",
    },
  },
  {
    id: "java-1",
    label: "Java 1.x",
    readsSetting: true,
    defaultMode: "legacy",
    fallback: "global",
  },
  {
    id: "kotlin",
    label: "Kotlin",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "global",
  },
  {
    id: "dotnet-4",
    label: ".NET 4.x",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "us-east-1",
  },
  {
    id: "cpp",
    label: "C++",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "us-east-1",
  },
  {
    id: "ruby-3",
    label: "Ruby 3.x",
    readsSetting: true,
    defaultMode: "regional",
    fallback: "fail",
  },
  {
    id: "rust",
    label: "Rust",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "fail",
  },
  {
    id: "swift",
    label: "Swift",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "fail",
  },
  {
    id: "php-3",
    label: "PHP 3.x (current)",
    readsSetting: true,
    defaultMode: "regional",
    fallback: "fail",
    note: {
      en: "Switched to `regional` in the 2025-07-31 change; the exact first version is not documented (unverified).",
      ja: "2025-07-31 の変更で `regional` に。切り替わった最初のバージョンは文書化されていない (未検証)。",
    },
  },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)!;

export interface Resolved {
  host: string | null;
  mode: Mode;
  /** The setting was given but this tool ignores it. */
  ignoredSetting: boolean;
  why: L;
}

/**
 * Resolve the STS hostname a tool would call.
 * `region` null means no Region configured; "aws-global" is the pseudo-Region
 * that forces the global endpoint.
 */
export function resolveSdk(
  tool: Tool,
  setting: Mode | "unset",
  region: string | null,
): Resolved {
  const ignoredSetting = !tool.readsSetting && setting !== "unset";
  const mode: Mode = !tool.readsSetting
    ? "regional"
    : setting === "unset"
      ? tool.defaultMode
      : setting;

  if (region === null) {
    const host =
      tool.fallback === "global"
        ? GLOBAL_HOST
        : tool.fallback === "us-east-1"
          ? regionalHost("us-east-1")
          : null;
    return {
      host,
      mode,
      ignoredSetting,
      why:
        tool.fallback === "fail"
          ? {
              en: "No Region configured: this SDK fails the request instead of guessing.",
              ja: "リージョン未設定: この SDK は推測せずにリクエストを失敗させる。",
            }
          : tool.fallback === "global"
            ? {
                en: "No Region configured: this tool silently falls back to the global endpoint.",
                ja: "リージョン未設定: このツールは黙ってグローバルエンドポイントに落ちる。",
              }
            : {
                en: "No Region configured: this SDK silently falls back to us-east-1.",
                ja: "リージョン未設定: この SDK は黙って us-east-1 に落ちる。",
              },
    };
  }

  if (region === "aws-global")
    return {
      host: GLOBAL_HOST,
      mode,
      ignoredSetting,
      why: {
        en: "The pseudo-Region `aws-global` always means the global endpoint.",
        ja: "疑似リージョン `aws-global` は常にグローバルエンドポイントを意味する。",
      },
    };

  if (mode === "legacy" && (LEGACY_GLOBAL_REGIONS as readonly string[]).includes(region))
    return {
      host: GLOBAL_HOST,
      mode,
      ignoredSetting,
      why: {
        en: `\`legacy\` mode, and ${region} is on the fixed list of 15 Regions that legacy sends to the global endpoint.`,
        ja: `\`legacy\` モードで、${region} は legacy がグローバルに送る固定の 15 リージョンに含まれる。`,
      },
    };

  return {
    host: regionalHost(region),
    mode,
    ignoredSetting,
    why:
      mode === "legacy"
        ? {
            en: `\`legacy\` mode, but ${region} is not on the legacy list, so it goes Regional anyway.`,
            ja: `\`legacy\` モードだが ${region} は legacy の一覧に入っていないので、結局リージョナルに行く。`,
          }
        : {
            en: "`regional` mode: the endpoint of the configured Region.",
            ja: "`regional` モード: 設定されたリージョンのエンドポイント。",
          },
  };
}
