import { useState } from "react";
import { Callout, P, Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import type { L } from "@/i18n/lang";
import { rich } from "@/lib/rich";
import { QuotaLab } from "./QuotaLab";
import { TrailExplorer } from "./TrailExplorer";

interface Threat {
  /** High-impact threats get a full card; the rest are one-line disclosures. */
  weight: "high" | "normal";
  title: L;
  /** One line that says what goes wrong. */
  headline: L;
  example: L;
  control: L;
  source: string;
}

const THREATS: Threat[] = [
  {
    weight: "high",
    title: { en: "Stolen instance credentials", ja: "インスタンス認証情報の窃取" },
    headline: {
      en: "Keys lifted from IMDS or a CI log keep working anywhere until they expire.",
      ja: "IMDS や CI ログから抜かれたキーは、期限までどこからでも使えます。",
    },
    example: {
      en: "SSRF against IMDSv1, or credentials printed in a CI log, then used from somewhere else.",
      ja: "IMDSv1 への SSRF や、CI ログに出てしまった認証情報が、別の場所から使われます。",
    },
    control: {
      en: "Enforce IMDSv2. GuardDuty raises `InstanceCredentialExfiltration.OutsideAWS` / `.InsideAWS`. SCPs comparing `aws:EC2InstanceSourceVPC` with `aws:SourceVpc` (and `aws:EC2InstanceSourcePrivateIPv4` with `aws:VpcSourceIp`) pin credentials to their instance.",
      ja: "IMDSv2 を強制します。GuardDuty は `InstanceCredentialExfiltration.OutsideAWS` / `.InsideAWS` で検知します。`aws:EC2InstanceSourceVPC` と `aws:SourceVpc` (さらに `aws:EC2InstanceSourcePrivateIPv4` と `aws:VpcSourceIp`) を比べる SCP で、認証情報を発行元のインスタンスに縛れます。",
    },
    source:
      "https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html",
  },
  {
    weight: "high",
    title: { en: "Trust that's too broad", ja: "広すぎる信頼" },
    headline: {
      en: "An OIDC trust without a `sub` condition lets any repository on GitHub in.",
      ja: "`sub` 条件のない OIDC 信頼は、GitHub 上のどのリポジトリでも通します。",
    },
    example: {
      en: "A role trusting `token.actions.githubusercontent.com` with no `sub` condition: any repository on GitHub can assume it.",
      ja: "`sub` 条件なしで `token.actions.githubusercontent.com` を信頼したロールは、GitHub 上のどのリポジトリからでも引き受けられます。",
    },
    control: {
      en: "Pin `aud` and `sub` (prefer immutable ID claims). IAM now rejects GitHub trust policies without a real `sub`. Access Analyzer flags external access.",
      ja: "`aud` と `sub` を固定します (不変の ID クレームがおすすめです)。IAM は現在、実質的な `sub` のない GitHub 向け信頼ポリシーを受け付けません。外部からのアクセスは Access Analyzer が検出します。",
    },
    source:
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html",
  },
  {
    weight: "normal",
    title: { en: "Confused deputy", ja: "混乱した代理" },
    headline: {
      en: "A vendor is tricked into using your role on someone else's behalf.",
      ja: "ベンダーがだまされ、他人のためにあなたのロールを使ってしまいます。",
    },
    example: {
      en: "A SaaS vendor is tricked into using your role ARN on behalf of another customer.",
      ja: "SaaS ベンダーがだまされ、別の顧客のためにあなたのロール ARN を使ってしまいます。",
    },
    control: {
      en: "Require `sts:ExternalId` for third parties, `aws:SourceArn` / `aws:SourceAccount` for AWS services.",
      ja: "第三者には `sts:ExternalId`、AWS サービスには `aws:SourceArn` / `aws:SourceAccount` を必須にします。",
    },
    source: "https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html",
  },
  {
    weight: "normal",
    title: { en: "whoami can't be blocked", ja: "whoami は止められない" },
    headline: {
      en: "`GetCallerIdentity` ignores even an explicit deny.",
      ja: "`GetCallerIdentity` は明示的な拒否すら無視します。",
    },
    example: {
      en: "`GetCallerIdentity` needs no permission and an explicit deny is ignored, so it is the first thing anyone does with stolen keys.",
      ja: "`GetCallerIdentity` は権限不要で、明示的な拒否も無視されます。盗まれたキーで真っ先に呼ばれる API です。",
    },
    control: {
      en: "Detect instead of prevent: it is logged, so alert on first-seen callers.",
      ja: "防げないので検知に回ります。ログには残るので、初めて見る呼び出し元にアラートを出します。",
    },
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html",
  },
  {
    weight: "normal",
    title: { en: "Key-to-account recon", ja: "キーからアカウントを特定" },
    headline: {
      en: "Any access key ID reveals its account, and the owner never sees the lookup.",
      ja: "アクセスキー ID からアカウントが割れ、持ち主はその照会に気づけません。",
    },
    example: {
      en: "`GetAccessKeyInfo` maps any access key ID to its account. The call is logged only in the caller's account, so the victim never sees it.",
      ja: "`GetAccessKeyInfo` は任意のアクセスキー ID からアカウントを引けます。記録は呼び出し側にしか残らないので、被害者からは見えません。",
    },
    control: {
      en: "Nothing to block. Treat leaked key IDs as revealing your account ID.",
      ja: "止める手段はありません。キー ID が漏れたら、アカウント ID も漏れたと考えてください。",
    },
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html",
  },
  {
    weight: "normal",
    title: { en: "Outsiders assuming your roles", ja: "組織外からのロール引き受け" },
    headline: {
      en: "One bad trust-policy edit lets an external account in.",
      ja: "信頼ポリシーを一度書き間違えるだけで、外部アカウントが入れます。",
    },
    example: {
      en: "A trust policy edited by mistake lets an external account in.",
      ja: "信頼ポリシーの誤編集で、外部アカウントが入れてしまいます。",
    },
    control: {
      en: "An RCP (since November 2024) denying `sts:AssumeRole` when `aws:PrincipalOrgID` is not yours, exempting AWS services, protects every member account at once.",
      ja: "`aws:PrincipalOrgID` が自組織でない `sts:AssumeRole` を拒否する RCP (2024 年 11 月から、AWS サービスは除外) を入れると、全メンバーアカウントを一度に守れます。",
    },
    source:
      "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html",
  },
];

interface CheckGroup {
  title: L;
  items: L[];
}

const CHECKLIST: CheckGroup[] = [
  {
    title: { en: "Endpoints and load", ja: "エンドポイントと負荷" },
    items: [
      {
        en: "Call the Regional STS endpoint in the workload's own Region.",
        ja: "ワークロードと同じリージョンのリージョナルエンドポイントを呼ぶ。",
      },
      {
        en: "If anything still calls the global endpoint, switch global tokens to `v2Token` before enabling opt-in Regions.",
        ja: "グローバルエンドポイントを呼ぶものが残っているなら、オプトインリージョンを有効にする前にトークンを `v2Token` にする。",
      },
      {
        en: "Cache credentials; let SDK providers refresh them. Alarm on `ThrottlingException`.",
        ja: "認証情報はキャッシュし、更新は SDK に任せる。`ThrottlingException` にアラームを設定する。",
      },
      {
        en: "Alarm on `SessionTokenSize` vs `SessionTokenMaxSize` in CloudWatch `AWS/STS`, and log `SessionTokenUtilization` from responses.",
        ja: "CloudWatch の `AWS/STS` で `SessionTokenSize` と `SessionTokenMaxSize` にアラームを設定し、レスポンスの `SessionTokenUtilization` も記録する。",
      },
    ],
  },
  {
    title: { en: "Who may get a session", ja: "誰にセッションを渡すか" },
    items: [
      {
        en: "Keep `MaxSessionDuration` as short as the job allows.",
        ja: "`MaxSessionDuration` は用途に必要な最短の長さにする。",
      },
      {
        en: "Name specific principals in every trust policy; pin OIDC `aud` and `sub`.",
        ja: "信頼ポリシーには具体的なプリンシパルを書き、OIDC は `aud` と `sub` を固定する。",
      },
      {
        en: "Require `sts:ExternalId` for third parties and `aws:SourceArn` for services.",
        ja: "第三者には `sts:ExternalId`、サービスには `aws:SourceArn` を必須にする。",
      },
      {
        en: "Require `sts:SourceIdentity` for human federated access.",
        ja: "人のフェデレーションアクセスでは `sts:SourceIdentity` を必須にする。",
      },
      {
        en: "Deploy an RCP that limits `sts:AssumeRole*` to your organization.",
        ja: "`sts:AssumeRole*` を自組織に限定する RCP を入れる。",
      },
    ],
  },
  {
    title: { en: "Detect and respond", ja: "検知と対応" },
    items: [
      {
        en: "Enforce IMDSv2 and enable GuardDuty organization-wide.",
        ja: "IMDSv2 を強制し、GuardDuty を組織全体で有効にする。",
      },
      {
        en: "Run a multi-Region trail and search us-east-1 for global-endpoint calls.",
        ja: "マルチリージョンの証跡を作り、グローバルエンドポイントの呼び出しは us-east-1 で探す。",
      },
      {
        en: "Rehearse revocation with `aws:TokenIssueTime`, `aws:userid` and `aws:SourceIdentity` denies.",
        ja: "`aws:TokenIssueTime`、`aws:userid`、`aws:SourceIdentity` を使った拒否で、無効化の手順を練習しておく。",
      },
    ],
  },
];

const CHECK_TOTAL = CHECKLIST.reduce((n, g) => n + g.items.length, 0);

export function OpsSection() {
  const { t } = useLang();
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (i: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <Section
      id="ops"
      index={chapter("ops")}
      title={{ en: "Logs, limits and the threat model", ja: "ログ、上限、脅威モデル" }}
      lede={{
        en: "Where STS writes its CloudTrail events, how its 600-requests-per-second quota is split, what it costs, and how temporary credentials get abused.",
        ja: "STS が CloudTrail のどこに記録するのか、毎秒 600 リクエストの枠がどう分かれるのか、料金はいくらか、そして一時認証情報がどう悪用されるのかを見ていきます。",
      }}
    >
      <TrailExplorer />
      <Callout kind="warn">
        {{
          en: "Global endpoint calls are logged in **us-east-1** even when they were served in your Region. A trail that only covers your home Region misses them.",
          ja: "グローバルエンドポイントの呼び出しは、自分のリージョンで処理されても **us-east-1** に記録されます。ホームリージョンだけの証跡では見逃します。",
        }}
      </Callout>
      <QuotaLab />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            k: { en: "Price", ja: "料金" },
            v: { en: "Free", ja: "無料" },
            d: {
              en: "STS is offered at no additional charge. You pay for the services you call with the credentials, and for PrivateLink if you use VPC endpoints.",
              ja: "STS 自体に追加料金はかかりません。払うのは認証情報で呼んだサービスの料金と、VPC エンドポイントを使う場合の PrivateLink の料金です。",
            },
            src: "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html",
          },
          {
            k: { en: "SLA", ja: "SLA" },
            v: { en: "None published", ja: "公開なし" },
            d: {
              en: "The AWS SLA index lists no STS or core IAM SLA (checked 2026-10-10). Design for Regional isolation instead.",
              ja: "AWS の SLA 一覧に、STS やコア IAM の SLA はありません (2026-10-10 確認)。リージョン単位で分離する前提で設計します。",
            },
            src: "https://aws.amazon.com/legal/service-level-agreements/",
          },
          {
            k: { en: "Quota", ja: "クォータ" },
            v: { en: "600 rps", ja: "600 rps" },
            d: {
              en: "Per account, per Region, shared by six operations. Increases go through AWS Support.",
              ja: "アカウント・リージョンごとの枠を 6 つの操作で共有します。引き上げは AWS サポート経由です。",
            },
            src: "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html",
          },
        ].map((f) => (
          <div
            key={f.k.en}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <div className="text-sm text-[var(--muted)]">{t(f.k)}</div>
            <div className="font-display text-3xl font-bold text-[var(--sts)]">
              {t(f.v)}
            </div>
            <p className="mt-1 text-sm">{t(f.d)}</p>
            <div className="mt-1 text-xs">
              <Src href={f.src}>{t({ en: "Source", ja: "出典" })}</Src>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 font-display text-2xl font-bold">
          {t({
            en: "How temporary credentials get abused",
            ja: "一時認証情報はこう悪用される",
          })}
        </h3>
        <P className="mb-4 text-[var(--muted)]">
          {{
            en: "Temporary credentials are bearer tokens: whoever holds the key, secret and token can use them from anywhere until they expire. Their protection is a short life and a narrow scope.",
            ja: "一時認証情報はベアラートークンです。キー、シークレット、トークンを持っていれば、期限まではどこからでも使えます。守りになるのは短い寿命と狭い権限です。",
          }}
        </P>
        <ul className="grid gap-3 md:grid-cols-2">
          {THREATS.filter((th) => th.weight === "high").map((th) => (
            <li
              key={th.title.en}
              className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-[var(--deny)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
            >
              <h4 className="font-display text-xl font-bold text-[var(--deny)]">
                {t(th.title)}
              </h4>
              <p className="mt-1 text-[1.02rem] font-semibold">{rich(t(th.headline))}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{rich(t(th.example))}</p>
              <p className="mt-3 rounded-lg bg-[var(--sunk)] px-3 py-2 text-sm">
                <span className="font-semibold text-[var(--resource)]">
                  {t({ en: "Control: ", ja: "対策: " })}
                </span>
                {rich(t(th.control))}
              </p>
              <div className="mt-auto pt-2 text-xs">
                <Src href={th.source}>{t({ en: "Source", ja: "出典" })}</Src>
              </div>
            </li>
          ))}
        </ul>
        <ul className="mt-3 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {THREATS.filter((th) => th.weight === "normal").map((th) => (
            <li key={th.title.en}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2.5 shrink-0 rotate-45 border-2 border-[var(--deny)] group-open:bg-[var(--deny)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{t(th.title)}</span>
                    <span className="block text-sm text-[var(--muted)]">
                      {rich(t(th.headline))}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--sts)] underline underline-offset-2">
                    <span className="group-open:hidden">
                      {t({ en: "Details", ja: "詳しく" })}
                    </span>
                    <span className="hidden group-open:inline">
                      {t({ en: "Close", ja: "閉じる" })}
                    </span>
                  </span>
                </summary>
                <div className="mt-2 space-y-2 pl-5.5 text-sm">
                  <p>{rich(t(th.example))}</p>
                  <p>
                    <span className="font-semibold text-[var(--resource)]">
                      {t({ en: "Control: ", ja: "対策: " })}
                    </span>
                    {rich(t(th.control))}
                  </p>
                  <Src href={th.source}>{t({ en: "Source", ja: "出典" })}</Src>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 font-display text-2xl font-bold">
          {t({ en: "Hardening checklist", ja: "堅牢化チェックリスト" })}
        </h3>
        <p className="mb-4 text-sm text-[var(--muted)]" aria-live="polite">
          {t({
            en: `${done.size} of ${CHECK_TOTAL} done. Ticks stay on this page only.`,
            ja: `${CHECK_TOTAL} 項目中 ${done.size} 項目完了 (チェックはこのページ内だけです)。`,
          })}
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {CHECKLIST.map((g) => {
            const n = g.items.filter((c) => done.has(c.en)).length;
            return (
              <section
                key={g.title.en}
                aria-label={t(g.title)}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
              >
                <div className="flex items-baseline justify-between gap-2 px-2 pt-1">
                  <h4 className="font-semibold">{t(g.title)}</h4>
                  <span className="font-mono text-xs text-[var(--muted)] tabular-nums">
                    {n}/{g.items.length}
                  </span>
                </div>
                <div className="mx-2 mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sunk)]">
                  <div
                    className="h-full rounded-full bg-[var(--resource)] transition-[width]"
                    style={{ width: `${(n / g.items.length) * 100}%` }}
                  />
                </div>
                <ul className="mt-2 space-y-0.5">
                  {g.items.map((c) => (
                    <li key={c.en}>
                      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-[var(--sunk)]">
                        <input
                          type="checkbox"
                          checked={done.has(c.en)}
                          onChange={() => toggle(c.en)}
                          className="mt-1 size-4 shrink-0 accent-[var(--resource)]"
                        />
                        <span
                          className={`text-[0.92rem] ${done.has(c.en) ? "text-[var(--muted)] line-through" : ""}`}
                        >
                          {rich(t(c))}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
