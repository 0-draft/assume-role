import type { L } from "@/i18n/lang";

/**
 * "Where does my request actually go?" — a pure model of STS request routing,
 * following docs/02-endpoints.md ("The 2025 change", "Activating and
 * deactivating STS per Region", "Session token versions", "Quotas").
 */

export type CallerId = "vpc-default" | "vpc-optin" | "off-aws";
export type EndpointChoice = "global" | "regional";
export type Resolver = "amazon" | "other";
export type Era = "before" | "after";
export type TokenVersion = "v1" | "v2";

export interface Caller {
  id: CallerId;
  label: L;
  /** Region the caller lives in (or the nearest one, for off-AWS callers). */
  region: string;
  optIn: boolean;
  inVpc: boolean;
}

export const CALLERS: Caller[] = [
  {
    id: "vpc-default",
    label: {
      en: "EC2 in eu-north-1 (enabled by default)",
      ja: "eu-north-1 の EC2 (デフォルト有効リージョン)",
    },
    region: "eu-north-1",
    optIn: false,
    inVpc: true,
  },
  {
    id: "vpc-optin",
    label: { en: "EC2 in ap-east-1 (opt-in)", ja: "ap-east-1 の EC2 (オプトイン)" },
    region: "ap-east-1",
    optIn: true,
    inVpc: true,
  },
  {
    id: "off-aws",
    label: {
      en: "Laptop in Tokyo (outside AWS)",
      ja: "東京のノート PC (AWS の外)",
    },
    region: "ap-northeast-1",
    optIn: false,
    inVpc: false,
  },
];

export const callerById = (id: CallerId) => CALLERS.find((c) => c.id === id)!;

export interface RouteInput {
  caller: CallerId;
  endpoint: EndpointChoice;
  /** Which DNS resolver answered. Off-AWS callers never use the Amazon one. */
  resolver: Resolver;
  /** STS active in the target Region for the account that issues the credentials. */
  stsActive: boolean;
  tokenVersion: TokenVersion;
  era: Era;
}

export interface RouteResult {
  hostname: string;
  resolver: Resolver;
  servingRegion: string;
  /** True when a global-endpoint request was served in the caller's Region. */
  servedLocally: boolean;
  cloudTrailRegion: string | null;
  /** additionalEventData.RequestDetails, added with the April 2025 change. */
  requestDetails: { endpointType: EndpointChoice; awsServingRegion: string } | null;
  requestedRegion: string;
  /** Whether the returned session token works in opt-in Regions. */
  tokenWorksInOptIn: boolean;
  quota: L;
  /** The STS call itself fails. */
  error: { code: string; http: number; message: L } | null;
  /** The call succeeds, but the credentials will bite later. */
  warnings: L[];
}

export const GLOBAL_HOST = "sts.amazonaws.com";
export const regionalHost = (region: string) => `sts.${region}.amazonaws.com`;

/** STS can be switched off only in default-enabled Regions other than us-east-1. */
export const canDeactivateIn = (caller: Caller) =>
  !caller.optIn && caller.region !== "us-east-1";

export function route(input: RouteInput): RouteResult {
  const c = callerById(input.caller);
  const resolver: Resolver = c.inVpc ? input.resolver : "other";
  const warnings: L[] = [];

  if (input.endpoint === "regional") {
    const region = c.region;
    const active = canDeactivateIn(c) ? input.stsActive : true;
    const error = active
      ? null
      : {
          code: "RegionDisabledException",
          http: 403,
          message: {
            en: `STS is not activated in ${region} for the account that is being asked to generate credentials. Activate it in IAM, Account settings, Security Token Service (STS).`,
            ja: `認証情報を発行するアカウントで ${region} の STS が無効化されています。IAM の「アカウント設定」→「Security Token Service (STS)」で有効化してください。`,
          },
        };
    return {
      hostname: regionalHost(region),
      resolver,
      servingRegion: region,
      servedLocally: false,
      cloudTrailRegion: error ? null : region,
      requestDetails:
        input.era === "after"
          ? { endpointType: "regional", awsServingRegion: region }
          : null,
      requestedRegion: region,
      tokenWorksInOptIn: true,
      quota: {
        en: `Regional bucket for ${region}: 600 requests/second per account, shared by AssumeRole, GetCallerIdentity, GetSessionToken and friends.`,
        ja: `${region} のリージョナル枠: アカウントあたり 600 リクエスト/秒。AssumeRole や GetCallerIdentity、GetSessionToken などで共有。`,
      },
      error,
      warnings,
    };
  }

  // Global endpoint. Since 2025-04-18 it is served in the caller's own Region,
  // but only for default-enabled Regions resolved by the Amazon DNS server.
  const servedLocally =
    input.era === "after" && c.inVpc && !c.optIn && resolver === "amazon";
  const servingRegion = servedLocally ? c.region : "us-east-1";
  const tokenWorksInOptIn = input.tokenVersion === "v2";

  if (!tokenWorksInOptIn && c.optIn)
    warnings.push({
      en: `The call succeeds, but these v1 global-endpoint credentials do not work in ${c.region}, the Region your workload runs in. Expect InvalidClientTokenId ("The security token included in the request is invalid"). Use the Regional endpoint or switch the account to v2 tokens.`,
      ja: `呼び出し自体は成功しますが、v1 のグローバルエンドポイントトークンは、ワークロードがいる ${c.region} では使えません。InvalidClientTokenId (「The security token included in the request is invalid」) になります。リージョナルエンドポイントを使うか、アカウントを v2 トークンに切り替えます。`,
    });
  if (c.region !== "us-east-1")
    warnings.push({
      en: "`aws:RequestedRegion` is `us-east-1`, so a Region-deny SCP that doesn't allow us-east-1 (and doesn't exempt `sts:*`) denies this call.",
      ja: "`aws:RequestedRegion` は `us-east-1` になるため、us-east-1 を許可せず `sts:*` も除外していないリージョン制限 SCP はこの呼び出しを拒否します。",
    });
  if (c.inVpc)
    warnings.push({
      en: "This hostname bypasses any STS VPC endpoint. Without internet egress, the call never leaves the VPC.",
      ja: "このホスト名は STS の VPC エンドポイントを通りません。インターネットへの出口がない VPC では届きません。",
    });

  return {
    hostname: GLOBAL_HOST,
    resolver,
    servingRegion,
    servedLocally,
    cloudTrailRegion: "us-east-1",
    requestDetails:
      input.era === "after"
        ? { endpointType: "global", awsServingRegion: servingRegion }
        : null,
    requestedRegion: "us-east-1",
    tokenWorksInOptIn,
    quota: servedLocally
      ? {
          en: `The global endpoint's own quota, not shared with Regional endpoints. Because this request originates in ${c.region}, that Region gets its own independent bucket.`,
          ja: `グローバルエンドポイント専用の枠 (リージョナルとは共有しない)。${c.region} から来たリクエストなので、このリージョン用に独立した枠が割り当てられます。`,
        }
      : {
          en: "The global endpoint's own quota, not shared with Regional endpoints.",
          ja: "グローバルエンドポイント専用の枠 (リージョナルとは共有しない)。",
        },
    error: null,
    warnings,
  };
}
