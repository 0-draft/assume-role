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
      ja: "リージョンなしの 1 つの名前です。記録は us-east-1、IPv4 のみ。",
    },
    color: "var(--caller)",
  },
  {
    host: "sts.<region>.amazonaws.com",
    name: { en: "Regional", ja: "リージョナル" },
    note: {
      en: "One per Region. What AWS recommends.",
      ja: "リージョンごとに 1 つあります。AWS の推奨です。",
    },
    color: "var(--sts)",
  },
  {
    host: "sts.<region>.api.aws",
    name: { en: "Dual-stack", ja: "デュアルスタック" },
    note: {
      en: "IPv4 + IPv6, since 2025-11-21.",
      ja: "IPv4 と IPv6 の両方に対応。2025-11-21 からです。",
    },
    color: "var(--resource)",
  },
  {
    host: "sts-fips.<region>.amazonaws.com",
    name: { en: "FIPS", ja: "FIPS" },
    note: {
      en: "Six US and Canada Regions only (plus a dual-stack twin).",
      ja: "米国とカナダの 6 リージョンだけです (デュアルスタック版もあります)。",
    },
    color: "var(--idp)",
  },
  {
    host: "com.amazonaws.<region>.sts",
    name: { en: "VPC endpoint", ja: "VPC エンドポイント" },
    note: {
      en: "PrivateLink. Same Regional name, private IPs.",
      ja: "PrivateLink です。名前はリージョナルと同じで、IP がプライベートになります。",
    },
    color: "var(--role)",
  },
  {
    host: "sts.<region>.amazonaws.com.cn",
    name: { en: "Other partitions", ja: "他のパーティション" },
    note: {
      en: "China, GovCloud, ESC: Regional only, own DNS suffix.",
      ja: "中国、GovCloud、ESC はリージョナルのみで、DNS サフィックスも別です。",
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
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WINDOWS.map((w, i) => (
          <li
            key={w.host}
            className="guilloche relative flex flex-col overflow-hidden rounded-t-2xl rounded-b-md border-2 border-b-0"
            style={{ borderColor: w.color }}
          >
            <div
              className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-[var(--on-color)]"
              style={{ background: w.color }}
            >
              <span className="text-sm font-bold">{t(w.name)}</span>
              <span className="font-mono text-xs font-semibold tabular-nums">
                {t({ en: "Window", ja: "窓口" })} {i + 1}
              </span>
            </div>
            <div className="flex-1 px-3 pt-3 pb-2">
              <div className="font-mono text-[0.8rem] font-semibold break-all">
                {w.host}
              </div>
              <div className="mt-1.5 text-xs text-[var(--muted)]">{t(w.note)}</div>
            </div>
            {/* The counter: a perforated sill under each window. */}
            <div
              aria-hidden
              className="h-2.5 border-t-2 border-dashed bg-[var(--sunk)]"
              style={{ borderColor: w.color }}
            />
          </li>
        ))}
      </ol>

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
          ja: "2025 年の変更で**変わらなかった**ことがあります。グローバル呼び出しの CloudTrail の記録先は `us-east-1` のままで、`aws:RequestedRegion` も `us-east-1` のままです。オプトインリージョンや Amazon 以外の DNS からは今もバージニア北部に向かいます。VPC エンドポイントは通らず、IPv6 にも対応していません。",
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
          ja: "IAM の「アカウント設定」にある「Security Token Service (STS)」の、アカウント単位のスイッチ 2 つです。",
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
                  ja: "デフォルト有効リージョンは既定でオンで、オフにもできます。ただし `us-east-1` とグローバルエンドポイントはオフにできません。",
                },
                {
                  en: "Opt-in Regions: STS turns on when you enable the Region and cannot be switched off.",
                  ja: "オプトインリージョンは、リージョンを有効化すると STS もオンになり、オフにはできません。",
                },
                {
                  en: "The switch that matters is in the account that **issues** the credentials (the role's account), not the caller's.",
                  ja: "効くのは認証情報を**発行する**側 (ロールのある) アカウントの設定です。呼び出し側の設定ではありません。",
                },
                {
                  en: "Off means `RegionDisabledException` (HTTP 403) from AssumeRole*, AssumeRoot, GetFederationToken, GetSessionToken and GetDelegatedAccessToken in that Region.",
                  ja: "オフにすると、そのリージョンの AssumeRole* / AssumeRoot / GetFederationToken / GetSessionToken / GetDelegatedAccessToken が `RegionDisabledException` (HTTP 403) を返します。",
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
                  {t({ en: "Default. Shorter.", ja: "既定値です。短め。" })}
                </div>
                <div className="mt-2">
                  {t({
                    en: "Valid only in Regions enabled by default. Fails in opt-in Regions such as Hong Kong.",
                    ja: "デフォルト有効リージョンでのみ使えます。香港などのオプトインリージョンでは失敗します。",
                  })}
                </div>
              </div>
              <div className="rounded-xl border-2 border-[var(--sts)] p-3">
                <div className="font-mono font-semibold">v2Token</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {t({
                    en: "Opt in per account. Longer.",
                    ja: "アカウント単位で選びます。長め。",
                  })}
                </div>
                <div className="mt-2">
                  {t({ en: "Valid in every Region.", ja: "全リージョンで使えます。" })}
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {t({
                en: "This setting only affects tokens from the global endpoint. Regional endpoints always issue tokens that work everywhere. AWS publishes no fixed byte length for either version, so never store tokens in fixed-width columns.",
                ja: "この設定が効くのはグローバルが発行するトークンだけです。リージョナルが出すトークンは常にどこでも使えます。どちらのバージョンも長さは公表されていないので、固定長のカラムには保存しないでください。",
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
        <ol className="space-y-2">
          {PITFALLS.map((p, i) => (
            <li key={i}>
              <details className="group rounded-xl border border-l-4 border-[var(--line)] border-l-[var(--deny)] bg-[var(--surface)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="font-display text-lg font-bold text-[var(--deny)] tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-semibold">{rich(t(p.head))}</span>
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <p className="prose-col px-4 pb-3 pl-11 text-sm">{rich(t(p.body))}</p>
              </details>
            </li>
          ))}
        </ol>
        <More summary={{ en: "More endpoint pitfalls", ja: "その他の落とし穴" }}>
          <ul className="space-y-2 text-sm">
            {[
              {
                en: "Upgrading to Boto3 1.40.0+ or CLI v1 1.42.0+ moves traffic from `sts.amazonaws.com` to Regional hostnames. Egress allowlists that only allow the global name break.",
                ja: "Boto3 1.40.0 以降や CLI v1 1.42.0 以降に上げると通信先が `sts.amazonaws.com` からリージョナルに変わります。グローバルの名前しか許可していない出口制御は壊れます。",
              },
              {
                en: "Switching to Regional changes `aws:RequestedRegion` from `us-east-1` to the real Region, which can start matching deny statements that never fired before.",
                ja: "リージョナルに切り替えると `aws:RequestedRegion` が `us-east-1` から実際のリージョンに変わり、今まで発火しなかった Deny に引っかかることがあります。",
              },
              {
                en: 'Single-Region trails or Region-filtered detections miss global calls, which land in `us-east-1`. To find them, filter CloudTrail for `endpointType` = `global` under additionalEventData.RequestDetails; Trusted Advisor\'s free "STS global endpoint" check also flags them.',
                ja: "単一リージョンの証跡やリージョンで絞った検知は、`us-east-1` に記録されるグローバル呼び出しを見逃します。探すなら additionalEventData.RequestDetails の `endpointType` が `global` のイベントを絞り込みます。Trusted Advisor の無料チェック「STS global endpoint」でも見つかります。",
              },
              {
                en: "Under IRSA, switching the STS endpoint type also changes the shape of pre-signed S3 URLs (`bucket.s3.<region>.amazonaws.com` vs `bucket.s3.amazonaws.com`).",
                ja: "IRSA では STS エンドポイントの種類を変えると、S3 の署名付き URL の形 (`bucket.s3.<region>.amazonaws.com` か `bucket.s3.amazonaws.com` か) も変わります。",
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

/** Each pitfall leads with the one-line symptom; the explanation opens on demand. */
const PITFALLS: { head: L; body: L }[] = [
  {
    head: {
      en: "A Region-deny policy blocks the global endpoint",
      ja: "リージョン制限ポリシーがグローバルエンドポイントを止める",
    },
    body: {
      en: "Global calls always carry `aws:RequestedRegion = us-east-1`. The IAM User Guide's sample Region-deny policy exempts `cloudfront:*`, `iam:*`, `organizations:*`, `route53:*` and `support:*`, but not `sts:*`. Copy it into an EU-only SCP and `sts:AssumeRole` sent to `sts.amazonaws.com` is denied. (Control Tower's Region-deny SCP does exempt `sts:*`.) The better fix is to move callers to Regional endpoints in allowed Regions.",
      ja: "グローバル呼び出しの `aws:RequestedRegion` は常に `us-east-1` です。IAM ユーザーガイドにあるリージョン制限ポリシーのサンプルは `cloudfront:*`、`iam:*`、`organizations:*`、`route53:*`、`support:*` を除外していますが、`sts:*` は除外していません。これを EU 限定の SCP に流用すると、`sts.amazonaws.com` への `sts:AssumeRole` が拒否されます (Control Tower のリージョン拒否 SCP は `sts:*` を除外しています)。根本的には、呼び出し側を許可リージョンのリージョナルエンドポイントに移すのが確実です。",
    },
  },
  {
    head: {
      en: "A VPC endpoint policy on `aws:PrincipalOrgID` breaks OIDC and SAML",
      ja: "`aws:PrincipalOrgID` だけの VPC エンドポイントポリシーで OIDC と SAML が壊れる",
    },
    body: {
      en: "AssumeRoleWithSAML and AssumeRoleWithWebIdentity are unsigned, so they carry no principal keys. GitHub Actions OIDC, IRSA and SAML are implicitly denied. Add a statement for those two actions conditioned on `aws:ResourceOrgID` or `aws:ResourceAccount`.",
      ja: "AssumeRoleWithSAML と AssumeRoleWithWebIdentity は署名なしで呼ばれるため、プリンシパル系のキーが付きません。そのため GitHub Actions の OIDC、IRSA、SAML が暗黙的に拒否されます。この 2 つのアクション向けに、`aws:ResourceOrgID` か `aws:ResourceAccount` で絞るステートメントを追加してください。",
    },
  },
  {
    head: {
      en: "The global endpoint skips your VPC endpoint",
      ja: "グローバルエンドポイントは VPC エンドポイントを通らない",
    },
    body: {
      en: "Private DNS only rewrites the Regional hostname. A workload with no internet egress that still calls `sts.amazonaws.com` fails even though an STS VPC endpoint exists, before and after the 2025 change.",
      ja: "プライベート DNS が書き換えるのはリージョナルのホスト名だけです。STS の VPC エンドポイントがあっても、インターネットへの出口がない VPC から `sts.amazonaws.com` を呼ぶと失敗します。2025 年の変更後も同じです。",
    },
  },
  {
    head: {
      en: "IRSA picks up the Regional setting only in new Pods",
      ja: "IRSA のリージョナル設定は新しい Pod にしか反映されない",
    },
    body: {
      en: 'Setting the service-account annotation `sts-regional-endpoints` (prefix `eks.amazonaws.com/`) to `"true"` makes the Pod identity webhook inject `AWS_STS_REGIONAL_ENDPOINTS`. Existing Pods keep the old value until they are re-created.',
      ja: 'サービスアカウントのアノテーション `sts-regional-endpoints` (接頭辞 `eks.amazonaws.com/`) を `"true"` にすると、Pod Identity Webhook が `AWS_STS_REGIONAL_ENDPOINTS` を注入します。既存の Pod は作り直すまで古い値のままです。',
    },
  },
];

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
