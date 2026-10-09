import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { Callout, Code, Figure, More, P, Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { rich } from "@/lib/rich";
import { RouterSim } from "./RouterSim";
import { HostnameBuilder } from "./HostnameBuilder";
import { DepartureBoard } from "./DepartureBoard";
import { SdkExplorer } from "./SdkExplorer";
import { DecisionGuide } from "./DecisionGuide";
import { CHANGES } from "./timeline";

/** The six kinds of window at a glance, before any interaction. */
const WINDOWS: { host: string; name: L; note: L; color: string }[] = [
  {
    host: "sts.amazonaws.com",
    name: { en: "Global (legacy)", ja: "グローバル (レガシー)" },
    note: {
      en: "One name, no Region. Logged in us-east-1. IPv4 only.",
      ja: "リージョンなしの 1 つの名前。記録は us-east-1。IPv4 のみ。",
    },
    color: "var(--caller)",
  },
  {
    host: "sts.<region>.amazonaws.com",
    name: { en: "Regional", ja: "リージョナル" },
    note: {
      en: "One per Region. What AWS recommends.",
      ja: "リージョンごとに 1 つ。AWS 推奨。",
    },
    color: "var(--sts)",
  },
  {
    host: "sts.<region>.api.aws",
    name: { en: "Dual-stack", ja: "デュアルスタック" },
    note: { en: "IPv4 + IPv6, since 2025-11-21.", ja: "IPv4 + IPv6。2025-11-21 から。" },
    color: "var(--resource)",
  },
  {
    host: "sts-fips.<region>.amazonaws.com",
    name: { en: "FIPS", ja: "FIPS" },
    note: {
      en: "Six US and Canada Regions only (plus a dual-stack twin).",
      ja: "米国・カナダの 6 リージョンだけ (デュアルスタック版もあり)。",
    },
    color: "var(--idp)",
  },
  {
    host: "com.amazonaws.<region>.sts",
    name: { en: "VPC endpoint", ja: "VPC エンドポイント" },
    note: {
      en: "PrivateLink. Same Regional name, private IPs.",
      ja: "PrivateLink。名前はリージョナルと同じで、IP がプライベート。",
    },
    color: "var(--role)",
  },
  {
    host: "sts.<region>.amazonaws.com.cn",
    name: { en: "Other partitions", ja: "他のパーティション" },
    note: {
      en: "China, GovCloud, ESC: Regional only, own DNS suffix.",
      ja: "中国・GovCloud・ESC はリージョナルのみ。DNS サフィックスが別。",
    },
    color: "var(--muted)",
  },
];

export function EndpointsSection() {
  const { t } = useLang();
  return (
    <Section
      id="endpoints"
      index={chapter("endpoints")}
      title={{
        en: "One service, a lot of front doors",
        ja: "サービスは 1 つ、入口はたくさん",
      }}
      lede={{
        en: "STS is a single API, but you can reach it through a global hostname, a hostname per Region, FIPS and IPv6 variants, private VPC endpoints and separate partitions. Which one you hit decides where the request is served, where it is logged, and where the token works.",
        ja: "STS の API は 1 つですが、入口はグローバルのホスト名、リージョンごとのホスト名、FIPS や IPv6 の別名、VPC のプライベートエンドポイント、別パーティションと何通りもあります。どれを叩くかで、処理されるリージョン、ログが残る場所、トークンが使える範囲が変わります。",
      }}
    >
      <div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {WINDOWS.map((w) => (
            <div
              key={w.host}
              role="listitem"
              className="flex overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"
            >
              <div className="w-2 shrink-0" style={{ background: w.color }} aria-hidden />
              <div className="min-w-0 p-3">
                <div className="text-sm font-bold" style={{ color: w.color }}>
                  {t(w.name)}
                </div>
                <div className="mt-0.5 font-mono text-[0.8rem] break-all">{w.host}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{t(w.note)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <P>
        {{
          en: "For most of STS's life the global endpoint was simply a server in N. Virginia. Since **2025-04-18** it is served in the caller's own Region, but only if the caller sits in a Region that is enabled by default and asked the Amazon DNS server in its VPC. Everything else still crosses to `us-east-1`. And even when it is served locally, the global endpoint keeps pretending to be `us-east-1` for logging and policy purposes.",
          ja: "STS の歴史の大半で、グローバルエンドポイントの実体はバージニア北部のサーバーでした。**2025-04-18** からは呼び出し元のリージョンで処理されます。ただし条件付きで、呼び出し元がデフォルト有効リージョンにいて、VPC の Amazon DNS で名前解決した場合だけです。それ以外は今も `us-east-1` まで行きます。ローカルで処理された場合でも、ログとポリシー評価のうえでは `us-east-1` のふりをし続けます。",
        }}
      </P>

      <RouterSim />

      <Callout kind="new">
        {{
          en: "What the 2025 change did **not** change: CloudTrail still logs global calls in `us-east-1`, `aws:RequestedRegion` is still `us-east-1`, opt-in Regions and non-Amazon DNS still go to N. Virginia, the global endpoint still bypasses VPC endpoints, and it still has no IPv6.",
          ja: "2025 年の変更で**変わらなかった**こと: グローバル呼び出しの CloudTrail 記録先は `us-east-1` のまま、`aws:RequestedRegion` も `us-east-1` のまま。オプトインリージョンや Amazon 以外の DNS からは今もバージニア北部行き。VPC エンドポイントは素通りし、IPv6 も非対応のまま。",
        }}
      </Callout>

      <HostnameBuilder />

      <Figure
        title={{
          en: "Turning STS off in a Region, and token versions",
          ja: "リージョン単位の STS 無効化とトークンのバージョン",
        }}
        hint={{
          en: "Two account-level switches in IAM, Account settings, Security Token Service (STS).",
          ja: "IAM の「アカウント設定」→「Security Token Service (STS)」にある、アカウント単位のスイッチ 2 つ。",
        }}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <h3 className="font-display text-lg font-bold">
              {t({ en: "Per-Region activation", ja: "リージョンごとの有効化" })}
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                {
                  en: "Default-enabled Regions: on by default, can be switched off. Exceptions: `us-east-1` and the global endpoint can never be switched off.",
                  ja: "デフォルト有効リージョン: 既定でオン、オフにもできる。ただし `us-east-1` とグローバルエンドポイントはオフにできない。",
                },
                {
                  en: "Opt-in Regions: STS turns on when you enable the Region and cannot be switched off.",
                  ja: "オプトインリージョン: リージョンを有効化すると STS もオンになり、オフにはできない。",
                },
                {
                  en: "The switch that matters is in the account that **issues** the credentials (the role's account), not the caller's.",
                  ja: "効くのは認証情報を**発行する**側 (ロールのある) アカウントの設定で、呼び出し側ではない。",
                },
                {
                  en: "Off means `RegionDisabledException` (HTTP 403) from AssumeRole*, AssumeRoot, GetFederationToken, GetSessionToken and GetDelegatedAccessToken in that Region.",
                  ja: "オフにすると、そのリージョンの AssumeRole* / AssumeRoot / GetFederationToken / GetSessionToken / GetDelegatedAccessToken が `RegionDisabledException` (HTTP 403) を返す。",
                },
              ].map((x, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--sts)]"
                  />
                  <span>
                    <RichText copy={x} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="font-display text-lg font-bold">
              {t({
                en: "Global endpoint token version",
                ja: "グローバルのトークンバージョン",
              })}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border-2 border-[var(--caller)] p-3">
                <div className="font-mono font-semibold">v1Token</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {t({ en: "Default. Shorter.", ja: "既定。短い。" })}
                </div>
                <div className="mt-2">
                  {t({
                    en: "Valid only in Regions enabled by default. Fails in opt-in Regions such as Hong Kong.",
                    ja: "デフォルト有効リージョンでのみ有効。香港などのオプトインリージョンでは失敗する。",
                  })}
                </div>
              </div>
              <div className="rounded-xl border-2 border-[var(--sts)] p-3">
                <div className="font-mono font-semibold">v2Token</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {t({
                    en: "Opt in per account. Longer.",
                    ja: "アカウント単位で選択。長い。",
                  })}
                </div>
                <div className="mt-2">
                  {t({ en: "Valid in every Region.", ja: "全リージョンで有効。" })}
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {t({
                en: "This setting only affects tokens from the global endpoint. Regional endpoints always issue tokens that work everywhere. AWS publishes no fixed byte length for either version, so never store tokens in fixed-width columns.",
                ja: "この設定が効くのはグローバルが発行するトークンだけ。リージョナルが出すトークンは常にどこでも使える。どちらのバージョンも長さは公表されていないので、固定長カラムに保存しないこと。",
              })}
            </p>
            <Code label="bash">{`aws iam set-security-token-service-preferences \\
  --global-endpoint-token-version v2Token
aws iam get-account-summary \\
  --query 'SummaryMap.GlobalEndpointTokenVersion'`}</Code>
          </div>
        </div>
      </Figure>

      <DepartureBoard />

      <SdkExplorer />

      <Code label="~/.aws/config">{`[default]
region = ap-northeast-1
sts_regional_endpoints = regional   # read by CLI v1, Boto3, JS v2, Go v1, Java 1.x, Ruby, PHP…

# Point STS somewhere specific (LocalStack, a VPC endpoint DNS name, …)
# env: AWS_ENDPOINT_URL_STS=https://sts.ap-northeast-1.amazonaws.com`}</Code>

      <DecisionGuide />

      <div className="space-y-4">
        <h3 className="font-display text-2xl font-bold">
          {t({
            en: "Four ways endpoints bite",
            ja: "エンドポイントでハマる 4 つのパターン",
          })}
        </h3>
        <Callout kind="warn">
          {{
            en: "**Region-deny SCPs block global STS.** Global calls always carry `aws:RequestedRegion = us-east-1`. AWS's sample Region-deny SCP exempts `iam:*`, `organizations:*`, `route53:*` and others, but not `sts:*`. An EU-only SCP denies `sts:AssumeRole` sent to `sts.amazonaws.com`. Better fix: move callers to Regional endpoints in allowed Regions.",
            ja: "**リージョン制限 SCP がグローバル STS を止める。** グローバル呼び出しは常に `aws:RequestedRegion = us-east-1`。AWS のサンプル SCP は `iam:*` や `organizations:*`、`route53:*` などは除外しているが `sts:*` は除外していない。EU 限定の SCP は `sts.amazonaws.com` への `sts:AssumeRole` を拒否する。根本対策は呼び出し側を許可リージョンのリージョナルに移すこと。",
          }}
        </Callout>
        <Callout kind="warn">
          {{
            en: "**A VPC endpoint policy keyed only on aws:PrincipalOrgID breaks federation.** AssumeRoleWithSAML and AssumeRoleWithWebIdentity carry no principal keys, so GitHub Actions OIDC, IRSA and SAML are implicitly denied. Add a statement for those two actions conditioned on `aws:ResourceOrgID` or `aws:ResourceAccount`.",
            ja: "**aws:PrincipalOrgID だけで絞った VPC エンドポイントポリシーはフェデレーションを壊す。** AssumeRoleWithSAML と AssumeRoleWithWebIdentity にはプリンシパル系のキーが付かないため、GitHub Actions の OIDC や IRSA、SAML が暗黙的に拒否される。この 2 アクション用に `aws:ResourceOrgID` か `aws:ResourceAccount` で絞るステートメントを足す。",
          }}
        </Callout>
        <Callout kind="warn">
          {{
            en: "**The global endpoint bypasses VPC endpoints.** Private DNS only rewrites the Regional hostname. A workload with no internet egress that still calls `sts.amazonaws.com` fails even though an STS VPC endpoint exists, before and after the 2025 change.",
            ja: "**グローバルエンドポイントは VPC エンドポイントを素通りする。** プライベート DNS が書き換えるのはリージョナルのホスト名だけ。STS の VPC エンドポイントがあっても、出口のない VPC から `sts.amazonaws.com` を呼べば失敗する。2025 年の変更後も同じ。",
          }}
        </Callout>
        <Callout kind="warn">
          {{
            en: '**EKS IRSA needs an annotation, then new Pods.** Setting the service-account annotation `sts-regional-endpoints` (prefix `eks.amazonaws.com/`) to `"true"` makes the Pod identity webhook inject `AWS_STS_REGIONAL_ENDPOINTS`. Existing Pods keep the old value until they are re-created.',
            ja: '**EKS の IRSA はアノテーションのあと Pod の作り直しが要る。** サービスアカウントのアノテーション `sts-regional-endpoints` (接頭辞 `eks.amazonaws.com/`) を `"true"` にすると、Pod Identity Webhook が `AWS_STS_REGIONAL_ENDPOINTS` を注入する。既存の Pod は作り直すまで古い値のまま。',
          }}
        </Callout>
        <More summary={{ en: "More endpoint pitfalls", ja: "その他の落とし穴" }}>
          <ul className="space-y-2 text-sm">
            {[
              {
                en: "Upgrading to Boto3 1.40.0+ or CLI v1 1.42.0+ moves traffic from `sts.amazonaws.com` to Regional hostnames. Egress allowlists that only allow the global name break.",
                ja: "Boto3 1.40.0 以降や CLI v1 1.42.0 以降に上げると通信先が `sts.amazonaws.com` からリージョナルに変わる。グローバルの名前しか許可していない出口制御は壊れる。",
              },
              {
                en: "Switching to Regional changes `aws:RequestedRegion` from `us-east-1` to the real Region, which can start matching deny statements that never fired before.",
                ja: "リージョナルに切り替えると `aws:RequestedRegion` が `us-east-1` から実際のリージョンに変わり、今まで発火しなかった Deny に引っかかることがある。",
              },
              {
                en: 'Single-Region trails or Region-filtered detections miss global calls, which land in `us-east-1`. To find them, filter CloudTrail for `endpointType` = `global` under additionalEventData.RequestDetails; Trusted Advisor\'s free "STS global endpoint" check also flags them.',
                ja: "単一リージョンの証跡やリージョンで絞った検知は、`us-east-1` に落ちるグローバル呼び出しを見逃す。探すなら additionalEventData.RequestDetails の `endpointType` が `global` のイベントを絞り込む。Trusted Advisor の無料チェック「STS global endpoint」でも見つかる。",
              },
              {
                en: "Under IRSA, switching the STS endpoint type also changes the shape of pre-signed S3 URLs (`bucket.s3.<region>.amazonaws.com` vs `bucket.s3.amazonaws.com`).",
                ja: "IRSA では STS エンドポイントの種類を変えると、S3 の署名付き URL の形 (`bucket.s3.<region>.amazonaws.com` か `bucket.s3.amazonaws.com` か) も変わる。",
              },
            ].map((x, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--deny)]"
                />
                <span>
                  <RichText copy={x} />
                </span>
              </li>
            ))}
          </ul>
        </More>
      </div>

      <div>
        <h3 className="font-display text-2xl font-bold">
          {t({ en: "How the front doors changed", ja: "入口の変遷" })}
        </h3>
        <div tabIndex={0} className="scroll-x mt-4 pb-2">
          <ol className="flex min-w-max gap-0">
            {CHANGES.map((c, i) => (
              <li key={c.date} className="relative w-56 shrink-0 pr-4">
                <div className="flex items-center">
                  <span
                    aria-hidden
                    className="size-3.5 shrink-0 rounded-full border-2 border-[var(--sts)] bg-[var(--surface)]"
                  />
                  {i < CHANGES.length - 1 && (
                    <span aria-hidden className="h-0.5 flex-1 bg-[var(--line)]" />
                  )}
                </div>
                <div className="mt-2 font-mono text-sm font-semibold text-[var(--sts)]">
                  {c.date}
                </div>
                <div className="mt-1 text-sm">
                  <Src href={c.href}>{t(c.title)}</Src>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <More summary={{ en: "Primary sources for this chapter", ja: "この章の一次情報" }}>
        <ul className="space-y-1.5 text-sm">
          {SOURCES.map(([label, href]) => (
            <li key={href}>
              <Src href={href}>{label}</Src>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--muted)]">
          {t({
            en: "Full notes, including where AWS documents contradict each other: docs/02-endpoints.md in the repository.",
            ja: "AWS のドキュメント同士が食い違う箇所も含めた詳細メモは、リポジトリの docs/02-endpoints.md にあります。",
          })}
        </p>
      </More>
    </Section>
  );
}

function RichText({ copy }: { copy: L }) {
  const { t } = useLang();
  return <>{rich(t(copy))}</>;
}

const SOURCES: [string, string][] = [
  [
    "IAM User Guide: AWS STS Regions and endpoints",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_region-endpoints.html",
  ],
  [
    "IAM User Guide: Manage AWS STS in an AWS Region",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-regions.html",
  ],
  [
    "AWS General Reference: AWS STS endpoints and quotas",
    "https://docs.aws.amazon.com/general/latest/gr/sts.html",
  ],
  [
    "SDKs and Tools Reference: AWS STS Regional endpoints",
    "https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html",
  ],
  [
    "IAM User Guide: Dual-stack endpoint support",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_dual-stack_endpoint_support.html",
  ],
  [
    "IAM User Guide: Control access to AWS STS with VPC endpoint policies",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sts_vpc_endpoint_policies.html",
  ],
  [
    "IAM User Guide: Logging IAM and AWS STS API calls with CloudTrail",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html",
  ],
  [
    "IAM User Guide: IAM and AWS STS quotas",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html",
  ],
  [
    "What's New 2025-04-18: global endpoint served locally",
    "https://aws.amazon.com/about-aws/whats-new/2025/04/aws-sts-global-endpoint-requests-locally-regions-default/",
  ],
  [
    "AWS Security Blog: How to use Regional AWS STS endpoints",
    "https://aws.amazon.com/blogs/security/how-to-use-regional-aws-sts-endpoints/",
  ],
  [
    "EKS User Guide: Configure the AWS STS endpoint for a service account",
    "https://docs.aws.amazon.com/eks/latest/userguide/configure-sts-endpoint.html",
  ],
];
