import type { L } from "@/i18n/lang";
import { partitionById, regionByCode, type PartitionId } from "./regions";

export type Family =
  "global" | "regional" | "fips" | "dualstack" | "fips-dualstack" | "vpce";

export const FAMILIES: Family[] = [
  "global",
  "regional",
  "fips",
  "dualstack",
  "fips-dualstack",
  "vpce",
];

/** What each hostname segment means; drives its colour and annotation. */
export type SegmentKind = "service" | "variant" | "region" | "suffix";

export interface Segment {
  text: string;
  kind: SegmentKind;
  note: L;
}

export type HostResult =
  | { kind: "ok"; host: string; segments: Segment[]; notes: L[] }
  | {
      kind: "none" | "undocumented";
      reason: L;
      /** What an SDK would still build from its rule set, and fail to reach. */
      sdkWouldBuild?: string;
    };

const seg = {
  sts: (): Segment => ({
    text: "sts",
    kind: "service",
    note: { en: "Service prefix", ja: "サービス名" },
  }),
  stsFips: (): Segment => ({
    text: "sts-fips",
    kind: "variant",
    note: {
      en: "FIPS 140 validated variant of the service",
      ja: "FIPS 140 検証済みの別ホスト",
    },
  }),
  region: (code: string): Segment => ({
    text: code,
    kind: "region",
    note: { en: "The Region that serves you", ja: "処理するリージョン" },
  }),
  suffix: (s: string, dual: boolean): Segment => ({
    text: s,
    kind: "suffix",
    note: dual
      ? {
          en: "Dual-stack DNS suffix (IPv4 + IPv6)",
          ja: "デュアルスタック用サフィックス (IPv4 + IPv6)",
        }
      : {
          en: "Partition DNS suffix (IPv4)",
          ja: "パーティションの DNS サフィックス (IPv4)",
        },
  }),
};

const join = (segments: Segment[]) => segments.map((s) => s.text).join(".");

/**
 * Compose an STS hostname from partition, Region and endpoint family, or say
 * why it does not exist. Rules follow docs/02-endpoints.md ("Endpoint hostname
 * families", "Other partitions", "FIPS and dual-stack flags").
 */
export function buildHostname(
  partitionId: PartitionId,
  region: string,
  family: Family,
): HostResult {
  const p = partitionById(partitionId);
  if (!p.regions.includes(region))
    return {
      kind: "none",
      reason: {
        en: `${region} is not a Region of the ${partitionId} partition.`,
        ja: `${region} は ${partitionId} パーティションのリージョンではありません。`,
      },
    };
  const commercial = partitionId === "aws";
  const derivedNote: L[] = p.derived
    ? [
        {
          en: "Derived from SDK partition data; AWS does not publish this hostname in STS docs.",
          ja: "SDK のパーティション定義から導いたホスト名で、STS のドキュメントには載っていません。",
        },
      ]
    : [];

  switch (family) {
    case "global": {
      if (!commercial)
        return {
          kind: "none",
          reason: {
            en: "China, GovCloud and the European Sovereign Cloud must use Regional endpoints; AWS documents no global STS endpoint for them.",
            ja: "中国・GovCloud・European Sovereign Cloud はリージョナルエンドポイント必須です。これらにグローバルの STS エンドポイントは文書化されていません。",
          },
        };
      const segments: Segment[] = [
        seg.sts(),
        {
          text: "amazonaws.com",
          kind: "suffix",
          note: {
            en: "No Region in the name: that's what makes it global",
            ja: "リージョン名が入らないので「グローバル」です",
          },
        },
      ];
      return {
        kind: "ok",
        host: join(segments),
        segments,
        notes: [
          {
            en: "IPv4 only. Cannot be deactivated. Always logged to CloudTrail in us-east-1, and `aws:RequestedRegion` is always `us-east-1`.",
            ja: "IPv4 のみで、無効化できません。CloudTrail は常に us-east-1 に記録され、`aws:RequestedRegion` も常に `us-east-1` です。",
          },
          {
            en: "Not reachable through an STS VPC endpoint: the global endpoint bypasses it.",
            ja: "STS の VPC エンドポイント経由では届きません (グローバルは VPC エンドポイントを通りません)。",
          },
        ],
      };
    }
    case "regional": {
      const segments = [seg.sts(), seg.region(region), seg.suffix(p.dnsSuffix, false)];
      const notes: L[] = [...derivedNote];
      if (partitionId === "aws-us-gov")
        notes.push({
          en: "In GovCloud the standard endpoint is itself the FIPS endpoint.",
          ja: "GovCloud では標準エンドポイントがそのまま FIPS エンドポイントです。",
        });
      if (commercial)
        notes.push({
          en: "Recommended by AWS. Tokens it issues are valid in every Region.",
          ja: "AWS の推奨です。発行されたトークンは全リージョンで使えます。",
        });
      return { kind: "ok", host: join(segments), segments, notes };
    }
    case "dualstack": {
      const segments = [
        seg.sts(),
        seg.region(region),
        seg.suffix(p.dualStackSuffix, true),
      ];
      const notes: L[] = [
        {
          en: "Dual-stack (IPv4 + IPv6) endpoints launched on 2025-11-21. If policies use `aws:SourceIp`, add your IPv6 ranges first.",
          ja: "デュアルスタック (IPv4 + IPv6) は 2025-11-21 に提供が始まりました。`aws:SourceIp` を使うポリシーには、先に IPv6 のレンジを足してください。",
        },
      ];
      if (p.dualStackUnverified)
        notes.unshift({
          en: "Derived from SDK partition data (unverified).",
          ja: "SDK のパーティション定義から導いた値です (未検証)。",
        });
      return { kind: "ok", host: join(segments), segments, notes };
    }
    case "fips":
    case "fips-dualstack": {
      const dual = family === "fips-dualstack";
      if (partitionId === "aws-us-gov") {
        if (dual)
          return {
            kind: "undocumented",
            reason: {
              en: "AWS does not document a separate FIPS dual-stack STS hostname for GovCloud.",
              ja: "GovCloud 向けの FIPS かつデュアルスタックの STS ホスト名は文書化されていません。",
            },
          };
        const segments = [seg.sts(), seg.region(region), seg.suffix(p.dnsSuffix, false)];
        return {
          kind: "ok",
          host: join(segments),
          segments,
          notes: [
            {
              en: "No `sts-fips` prefix here: in GovCloud the standard endpoint is the FIPS endpoint.",
              ja: "`sts-fips` は付きません。GovCloud では標準エンドポイントがそのまま FIPS エンドポイントです。",
            },
          ],
        };
      }
      const wouldBuild = `sts-fips.${region}.${dual ? p.dualStackSuffix : p.dnsSuffix}`;
      if (!commercial)
        return {
          kind: partitionId === "aws-eusc" ? "undocumented" : "none",
          reason:
            partitionId === "aws-eusc"
              ? {
                  en: "FIPS STS endpoints for the European Sovereign Cloud are not documented (unverified).",
                  ja: "European Sovereign Cloud の FIPS STS エンドポイントは文書化されていません (未検証)。",
                }
              : {
                  en: "No FIPS STS endpoint is published for China Regions.",
                  ja: "中国リージョンには FIPS の STS エンドポイントが公開されていません。",
                },
        };
      const reg = regionByCode(region)!;
      if (!reg.fips)
        return {
          kind: "none",
          reason: {
            en: `FIPS STS endpoints exist only in us-east-1, us-east-2, us-west-1, us-west-2, ca-central-1 and ca-west-1. With use_fips_endpoint on, the SDK still builds the name below and the call fails.`,
            ja: `FIPS の STS エンドポイントは us-east-1 / us-east-2 / us-west-1 / us-west-2 / ca-central-1 / ca-west-1 だけです。use_fips_endpoint を有効にすると SDK は下の名前を組み立ててしまい、呼び出しは失敗します。`,
          },
          sdkWouldBuild: wouldBuild,
        };
      const segments = [
        seg.stsFips(),
        seg.region(region),
        seg.suffix(dual ? p.dualStackSuffix : p.dnsSuffix, dual),
      ];
      return {
        kind: "ok",
        host: join(segments),
        segments,
        notes: [
          {
            en: "Turn on with `use_fips_endpoint` / `AWS_USE_FIPS_ENDPOINT`.",
            ja: "`use_fips_endpoint` か `AWS_USE_FIPS_ENDPOINT` で有効にします。",
          },
        ],
      };
    }
    case "vpce": {
      if (!commercial)
        return {
          kind: "undocumented",
          reason: {
            en: "Our research covers STS VPC endpoints for the commercial partition only.",
            ja: "このサイトの調査範囲は商用パーティションの STS VPC エンドポイントのみです。",
          },
        };
      const reg = regionByCode(region)!;
      const segments = [seg.sts(), seg.region(region), seg.suffix(p.dnsSuffix, false)];
      const notes: L[] = [
        {
          en: `Same name as the Regional endpoint. With private DNS on, it resolves to the interface endpoint's private IPs (service \`com.amazonaws.${region}.sts\`).`,
          ja: `名前はリージョナルと同じです。プライベート DNS を有効にすると、インターフェイスエンドポイントのプライベート IP に解決されます (サービス名 \`com.amazonaws.${region}.sts\`)。`,
        },
        {
          en: "Only the Regional hostname is intercepted. `sts.amazonaws.com` bypasses the VPC endpoint.",
          ja: "書き換わるのはリージョナルのホスト名だけです。`sts.amazonaws.com` は VPC エンドポイントを通りません。",
        },
      ];
      if (!reg.vpceListed)
        notes.push({
          en: "This Region is not in the IAM guide's STS VPC endpoint list (33 Regions as of 2026-10). Whether the endpoint exists here is unverified; check with `aws ec2 describe-vpc-endpoint-services`.",
          ja: "このリージョンは IAM ガイドの STS VPC エンドポイント一覧 (2026 年 10 月時点で 33 リージョン) に載っていません。ここでエンドポイントが使えるかは未検証なので、`aws ec2 describe-vpc-endpoint-services` で確認してください。",
        });
      return { kind: "ok", host: join(segments), segments, notes };
    }
  }
}
