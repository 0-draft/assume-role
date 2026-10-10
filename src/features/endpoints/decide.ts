import type { L } from "@/i18n/lang";

/** "Which endpoint should I use?" from docs/02-endpoints.md, "Decision guide". */
export interface Answers {
  commercial: boolean;
  fips: boolean;
  fipsRegion: boolean;
  privateNoEgress: boolean;
  ipv6: boolean;
}

export type QuestionId = keyof Answers;

export interface Decision {
  /** Questions that were actually asked, in order. */
  asked: QuestionId[];
  host: string | null;
  why: L;
}

export function decide(a: Answers): Decision {
  if (!a.commercial)
    return {
      asked: ["commercial"],
      host: "sts.<region>.<partition suffix>",
      why: {
        en: "China, GovCloud, the European Sovereign Cloud and ISO partitions have no global endpoint. Use that partition's Regional endpoint; credentials never cross partitions.",
        ja: "中国・GovCloud・European Sovereign Cloud・ISO にはグローバルエンドポイントがありません。そのパーティションのリージョナルを使います。認証情報はパーティションをまたげません。",
      },
    };
  if (a.fips) {
    if (a.fipsRegion)
      return {
        asked: ["commercial", "fips", "fipsRegion", "ipv6"],
        host: a.ipv6 ? "sts-fips.<region>.api.aws" : "sts-fips.<region>.amazonaws.com",
        why: {
          en: "FIPS endpoints exist in us-east-1, us-east-2, us-west-1, us-west-2, ca-central-1 and ca-west-1, each with a dual-stack twin.",
          ja: "FIPS エンドポイントは us-east-1 / us-east-2 / us-west-1 / us-west-2 / ca-central-1 / ca-west-1 にあり、それぞれデュアルスタック版もあります。",
        },
      };
    return {
      asked: ["commercial", "fips", "fipsRegion"],
      host: null,
      why: {
        en: "There is no FIPS STS endpoint in your Region. Run the workload in a FIPS Region (or GovCloud), or accept a non-FIPS endpoint. Don't just flip use_fips_endpoint: the SDK builds a hostname that doesn't exist.",
        ja: "そのリージョンに FIPS の STS エンドポイントはありません。FIPS リージョン (か GovCloud) で動かすか、非 FIPS を受け入れてください。use_fips_endpoint だけ有効にすると、存在しないホスト名を SDK が組み立てて失敗します。",
      },
    };
  }
  if (a.privateNoEgress)
    return {
      asked: ["commercial", "fips", "privateNoEgress"],
      host: "sts.<region>.amazonaws.com",
      why: {
        en: "Create an interface endpoint for com.amazonaws.<region>.sts with private DNS, and call the Regional hostname. The global endpoint bypasses the VPC endpoint and will never connect.",
        ja: "com.amazonaws.<region>.sts のインターフェースエンドポイントをプライベート DNS 付きで作り、リージョナルのホスト名を呼んでください。グローバルは VPC エンドポイントを通らないので繋がりません。",
      },
    };
  if (a.ipv6)
    return {
      asked: ["commercial", "fips", "privateNoEgress", "ipv6"],
      host: "sts.<region>.api.aws",
      why: {
        en: "Dual-stack endpoints serve IPv4 and IPv6. The global endpoint has no IPv6.",
        ja: "デュアルスタックは IPv4 と IPv6 の両方に対応しています。グローバルには IPv6 がありません。",
      },
    };
  return {
    asked: ["commercial", "fips", "privateNoEgress", "ipv6"],
    host: "sts.<region>.amazonaws.com",
    why: {
      en: "The Regional endpoint of the Region your workload runs in: same-Region fault isolation, tokens valid everywhere, CloudTrail in the same Region. Off AWS, pick the nearest Region and build your own failover.",
      ja: "ワークロードと同じリージョンのリージョナルエンドポイントを使います。障害の影響範囲がリージョン内に収まり、トークンは全リージョンで有効で、CloudTrail も同じリージョンに残ります。AWS の外からなら最寄りのリージョンを選び、フェイルオーバーは自前で用意してください。",
    },
  };
}
