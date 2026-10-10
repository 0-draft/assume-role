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
      ja: "2025-07-31 に `regional` へ変わりました。AWS の SDK 一覧表と CLI v1 のドキュメントはまだ `legacy` と書いていますが、リリース告知のほうが正しい情報です。",
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
      ja: "2025-07-31 に `regional` へ変わりました。sts.amazonaws.com しか許可していない許可リストは、アップグレードで壊れます。",
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
      ja: "リージョン未設定だと失敗します。ただし AssumeRole と AssumeRoleWithWebIdentity だけはグローバルエンドポイントを使います (AWS の表より)。",
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
    note: {
      en: "Always regional since 4.0.0; the StsRegionalEndpointsValue setting was removed. .NET 3.x switched its default to `regional` in AWSSDK.Core 3.7.500.0 (2025-07-31). Tools for PowerShell V5 builds on .NET 4.x and inherits this.",
      ja: "4.0.0 から常にリージョナルで、StsRegionalEndpointsValue 設定は削除されました。.NET 3.x は AWSSDK.Core 3.7.500.0 (2025-07-31) で既定が `regional` になりました。Tools for PowerShell V5 は .NET 4.x の上に作られているので同じ挙動です。",
    },
  },
  {
    id: "cpp",
    label: "C++",
    readsSetting: false,
    defaultMode: "regional",
    fallback: "us-east-1",
    note: {
      en: "Has no sts_regional_endpoints setting. Since 1.11.617 (2025-07-31) the web-identity credentials provider uses the client's configured Region instead of falling back to us-east-1.",
      ja: "sts_regional_endpoints 設定はありません。1.11.617 (2025-07-31) から、Web ID の認証情報プロバイダは us-east-1 に戻らず、クライアントに設定したリージョンを使います。",
    },
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
    label: "PHP 3.x ≥ 3.351.12",
    readsSetting: true,
    defaultMode: "regional",
    fallback: "fail",
    note: {
      en: "3.351.12 (2025-07-31) changed the STS default endpoint configuration to `regional`, per the SDK changelog.",
      ja: "SDK の changelog によると、3.351.12 (2025-07-31) で STS の既定エンドポイント設定が `regional` に変わりました。",
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
              ja: "リージョン未設定: この SDK は推測せず、リクエストを失敗させます。",
            }
          : tool.fallback === "global"
            ? {
                en: "No Region configured: this tool silently falls back to the global endpoint.",
                ja: "リージョン未設定: このツールは黙ってグローバルエンドポイントを使います。",
              }
            : {
                en: "No Region configured: this SDK silently falls back to us-east-1.",
                ja: "リージョン未設定: この SDK は黙って us-east-1 を使います。",
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
        ja: "疑似リージョン `aws-global` は常にグローバルエンドポイントを指します。",
      },
    };

  if (mode === "legacy" && (LEGACY_GLOBAL_REGIONS as readonly string[]).includes(region))
    return {
      host: GLOBAL_HOST,
      mode,
      ignoredSetting,
      why: {
        en: `\`legacy\` mode, and ${region} is on the fixed list of 15 Regions that legacy sends to the global endpoint.`,
        ja: `\`legacy\` モードで、${region} は legacy がグローバルに送る固定の 15 リージョンに含まれます。`,
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
            ja: `\`legacy\` モードですが、${region} は legacy の一覧にないので、結局リージョナルに行きます。`,
          }
        : {
            en: "`regional` mode: the endpoint of the configured Region.",
            ja: "`regional` モード: 設定されたリージョンのエンドポイントを使います。",
          },
  };
}
