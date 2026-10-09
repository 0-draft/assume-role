import type { L } from "@/i18n/lang";

/**
 * The 34 commercial Regions as of 2026-10-10 (docs/02-endpoints.md, "Commercial
 * Region endpoint table"). Hostnames are not stored: they follow one pattern per
 * family, built in hostname.ts, so the table cannot drift from the builder.
 */
export interface Region {
  code: string;
  name: L;
  optIn: boolean;
  /** Has a published FIPS endpoint (General Reference: US and Canada only). */
  fips: boolean;
  /**
   * Listed in the IAM User Guide's STS VPC endpoint list. `false` means "not
   * listed", which the doc marks unverified: the list may simply be stale.
   */
  vpceListed: boolean;
  /** Missing from the IAM "STS Regions and endpoints" table (doc discrepancy). */
  missingFromIamTable?: boolean;
}

const r = (
  code: string,
  en: string,
  ja: string,
  optIn: boolean,
  extra: Partial<Pick<Region, "fips" | "vpceListed" | "missingFromIamTable">> = {},
): Region => ({
  code,
  name: { en, ja },
  optIn,
  fips: extra.fips ?? false,
  vpceListed: extra.vpceListed ?? true,
  ...(extra.missingFromIamTable ? { missingFromIamTable: true } : {}),
});

export const REGIONS: Region[] = [
  r("us-east-1", "US East (N. Virginia)", "米国東部 (バージニア北部)", false, {
    fips: true,
  }),
  r("us-east-2", "US East (Ohio)", "米国東部 (オハイオ)", false, { fips: true }),
  r("us-west-1", "US West (N. California)", "米国西部 (北カリフォルニア)", false, {
    fips: true,
  }),
  r("us-west-2", "US West (Oregon)", "米国西部 (オレゴン)", false, { fips: true }),
  r("ca-central-1", "Canada (Central)", "カナダ (中部)", false, { fips: true }),
  r("sa-east-1", "South America (São Paulo)", "南米 (サンパウロ)", false),
  r("eu-central-1", "Europe (Frankfurt)", "欧州 (フランクフルト)", false),
  r("eu-west-1", "Europe (Ireland)", "欧州 (アイルランド)", false),
  r("eu-west-2", "Europe (London)", "欧州 (ロンドン)", false),
  r("eu-west-3", "Europe (Paris)", "欧州 (パリ)", false),
  r("eu-north-1", "Europe (Stockholm)", "欧州 (ストックホルム)", false),
  r("ap-northeast-1", "Asia Pacific (Tokyo)", "アジアパシフィック (東京)", false),
  r("ap-northeast-2", "Asia Pacific (Seoul)", "アジアパシフィック (ソウル)", false),
  r("ap-northeast-3", "Asia Pacific (Osaka)", "アジアパシフィック (大阪)", false),
  r("ap-south-1", "Asia Pacific (Mumbai)", "アジアパシフィック (ムンバイ)", false),
  r(
    "ap-southeast-1",
    "Asia Pacific (Singapore)",
    "アジアパシフィック (シンガポール)",
    false,
  ),
  r("ap-southeast-2", "Asia Pacific (Sydney)", "アジアパシフィック (シドニー)", false),
  r("af-south-1", "Africa (Cape Town)", "アフリカ (ケープタウン)", true),
  r("ap-east-1", "Asia Pacific (Hong Kong)", "アジアパシフィック (香港)", true),
  r("ap-east-2", "Asia Pacific (Taipei)", "アジアパシフィック (台北)", true, {
    vpceListed: false,
    missingFromIamTable: true,
  }),
  r(
    "ap-south-2",
    "Asia Pacific (Hyderabad)",
    "アジアパシフィック (ハイデラバード)",
    true,
  ),
  r("ap-southeast-3", "Asia Pacific (Jakarta)", "アジアパシフィック (ジャカルタ)", true),
  r(
    "ap-southeast-4",
    "Asia Pacific (Melbourne)",
    "アジアパシフィック (メルボルン)",
    true,
  ),
  r(
    "ap-southeast-5",
    "Asia Pacific (Malaysia)",
    "アジアパシフィック (マレーシア)",
    true,
    {
      vpceListed: false,
    },
  ),
  r(
    "ap-southeast-6",
    "Asia Pacific (New Zealand)",
    "アジアパシフィック (ニュージーランド)",
    true,
    { vpceListed: false, missingFromIamTable: true },
  ),
  r("ap-southeast-7", "Asia Pacific (Thailand)", "アジアパシフィック (タイ)", true, {
    vpceListed: false,
  }),
  r("ca-west-1", "Canada West (Calgary)", "カナダ西部 (カルガリー)", true, {
    fips: true,
  }),
  r("eu-central-2", "Europe (Zurich)", "欧州 (チューリッヒ)", true),
  r("eu-south-1", "Europe (Milan)", "欧州 (ミラノ)", true),
  r("eu-south-2", "Europe (Spain)", "欧州 (スペイン)", true),
  r("il-central-1", "Israel (Tel Aviv)", "イスラエル (テルアビブ)", true),
  r("me-central-1", "Middle East (UAE)", "中東 (アラブ首長国連邦)", true),
  r("me-south-1", "Middle East (Bahrain)", "中東 (バーレーン)", true),
  r("mx-central-1", "Mexico (Central)", "メキシコ (中部)", true, { vpceListed: false }),
];

export const regionByCode = (code: string) => REGIONS.find((x) => x.code === code);

/**
 * Whether the account can switch STS off in this Region (IAM console, Account
 * settings). us-east-1 cannot; opt-in Regions are always on once enabled.
 */
export const canDeactivate = (reg: Region) => !reg.optIn && reg.code !== "us-east-1";

/**
 * Regions that `sts_regional_endpoints = legacy` sends to sts.amazonaws.com
 * (CLI v1 config-vars, botocore rule set `AWS::STS::UseGlobalEndpoint`). Seoul
 * and Osaka are default-enabled but NOT on this list.
 */
export const LEGACY_GLOBAL_REGIONS = [
  "ap-northeast-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ca-central-1",
  "eu-central-1",
  "eu-north-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "sa-east-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
] as const;

export type RegionFilter = "all" | "default" | "optin" | "fips";

/** Search for the departure board: code or name (either language), plus a type filter. */
export function filterRegions(query: string, filter: RegionFilter) {
  const q = query.trim().toLowerCase();
  return REGIONS.filter((r) => {
    if (filter === "default" && r.optIn) return false;
    if (filter === "optin" && !r.optIn) return false;
    if (filter === "fips" && !r.fips) return false;
    if (!q) return true;
    return (
      r.code.includes(q) || r.name.en.toLowerCase().includes(q) || r.name.ja.includes(q)
    );
  });
}

export type PartitionId = "aws" | "aws-cn" | "aws-us-gov" | "aws-eusc";

export interface Partition {
  id: PartitionId;
  name: L;
  regions: string[];
  dnsSuffix: string;
  dualStackSuffix: string;
  /** Hostnames derived from SDK partition data, not published in STS docs. */
  derived?: boolean;
  dualStackUnverified?: boolean;
}

export const PARTITIONS: Partition[] = [
  {
    id: "aws",
    name: { en: "Commercial", ja: "商用" },
    regions: REGIONS.map((x) => x.code),
    dnsSuffix: "amazonaws.com",
    dualStackSuffix: "api.aws",
  },
  {
    id: "aws-cn",
    name: { en: "China", ja: "中国" },
    regions: ["cn-north-1", "cn-northwest-1"],
    dnsSuffix: "amazonaws.com.cn",
    dualStackSuffix: "api.amazonwebservices.com.cn",
  },
  {
    id: "aws-us-gov",
    name: { en: "GovCloud (US)", ja: "GovCloud (US)" },
    regions: ["us-gov-west-1", "us-gov-east-1"],
    dnsSuffix: "amazonaws.com",
    dualStackSuffix: "api.aws",
  },
  {
    id: "aws-eusc",
    name: { en: "European Sovereign Cloud", ja: "European Sovereign Cloud" },
    regions: ["eusc-de-east-1"],
    dnsSuffix: "amazonaws.eu",
    dualStackSuffix: "api.amazonwebservices.eu",
    derived: true,
    dualStackUnverified: true,
  },
];

export const partitionById = (id: PartitionId) => PARTITIONS.find((p) => p.id === id)!;
