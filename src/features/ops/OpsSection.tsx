import { useState } from "react";
import { Callout, P, Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import type { L } from "@/i18n/lang";
import { rich } from "@/lib/rich";
import { QuotaLab } from "./QuotaLab";
import { TrailExplorer } from "./TrailExplorer";

interface Threat {
  title: L;
  example: L;
  control: L;
  source: string;
}

const THREATS: Threat[] = [
  {
    title: { en: "Stolen instance credentials", ja: "インスタンス認証情報の窃取" },
    example: {
      en: "SSRF against IMDSv1, or credentials printed in a CI log, then used from somewhere else.",
      ja: "IMDSv1 への SSRF や CI ログに出た認証情報が、別の場所から使われる。",
    },
    control: {
      en: "Enforce IMDSv2. GuardDuty raises `InstanceCredentialExfiltration.OutsideAWS` / `.InsideAWS`. SCPs comparing `aws:EC2InstanceSourceVPC` with `aws:SourceVpc` pin credentials to their instance.",
      ja: "IMDSv2 を強制する。GuardDuty が `InstanceCredentialExfiltration.OutsideAWS` / `.InsideAWS` を検知する。`aws:EC2InstanceSourceVPC` と `aws:SourceVpc` を比べる SCP で、認証情報を発行元インスタンスに縛れる。",
    },
    source:
      "https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html",
  },
  {
    title: { en: "Trust that's too broad", ja: "広すぎる信頼" },
    example: {
      en: "A role trusting `token.actions.githubusercontent.com` with no `sub` condition: any repository on GitHub can assume it.",
      ja: "`sub` 条件なしで `token.actions.githubusercontent.com` を信頼したロール。GitHub 上のどのリポジトリからでも引き受けられる。",
    },
    control: {
      en: "Pin `aud` and `sub` (prefer immutable ID claims). IAM now rejects GitHub trust policies without a real `sub`. Access Analyzer flags external access.",
      ja: "`aud` と `sub` を固定する (不変の ID クレーム推奨)。IAM はいま、実質的な `sub` の無い GitHub 信頼ポリシーを拒否する。Access Analyzer が外部アクセスを検出する。",
    },
    source:
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html",
  },
  {
    title: { en: "Confused deputy", ja: "混乱した代理" },
    example: {
      en: "A SaaS vendor is tricked into using your role ARN on behalf of another customer.",
      ja: "SaaS ベンダーがだまされ、別の顧客のためにあなたのロール ARN を使ってしまう。",
    },
    control: {
      en: "Require `sts:ExternalId` for third parties, `aws:SourceArn` / `aws:SourceAccount` for AWS services.",
      ja: "第三者には `sts:ExternalId`、AWS サービスには `aws:SourceArn` / `aws:SourceAccount` を必須にする。",
    },
    source: "https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html",
  },
  {
    title: { en: "whoami can't be blocked", ja: "whoami は止められない" },
    example: {
      en: "`GetCallerIdentity` needs no permission and an explicit deny is ignored, so it is the first thing anyone does with stolen keys.",
      ja: "`GetCallerIdentity` は権限不要で、明示的な拒否も無視される。盗んだキーで真っ先に叩かれる。",
    },
    control: {
      en: "Detect instead of prevent: it is logged, so alert on first-seen callers.",
      ja: "防げないので検知する。ログには残るので、初めて見る呼び出し元にアラートを出す。",
    },
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html",
  },
  {
    title: { en: "Key-to-account recon", ja: "キーからアカウントを特定" },
    example: {
      en: "`GetAccessKeyInfo` maps any access key ID to its account. The call is logged only in the caller's account, so the victim never sees it.",
      ja: "`GetAccessKeyInfo` は任意のアクセスキー ID からアカウントを引ける。記録は呼び出し側だけなので、被害者には見えない。",
    },
    control: {
      en: "Nothing to block. Treat leaked key IDs as revealing your account ID.",
      ja: "止める手段は無い。キー ID が漏れたらアカウント ID も漏れたと考える。",
    },
    source:
      "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html",
  },
  {
    title: { en: "Outsiders assuming your roles", ja: "組織外からのロール引き受け" },
    example: {
      en: "A trust policy edited by mistake lets an external account in.",
      ja: "信頼ポリシーの誤編集で外部アカウントが入れてしまう。",
    },
    control: {
      en: "An RCP (since November 2024) denying `sts:AssumeRole` when `aws:PrincipalOrgID` is not yours, exempting AWS services, protects every member account at once.",
      ja: "`aws:PrincipalOrgID` が自組織でない `sts:AssumeRole` を拒否する RCP (2024 年 11 月〜、AWS サービスは除外) で、全メンバーアカウントを一度に守れる。",
    },
    source:
      "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html",
  },
];

const CHECKLIST: L[] = [
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
    en: "Keep `MaxSessionDuration` as short as the job allows.",
    ja: "`MaxSessionDuration` は仕事に足りる最短にする。",
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
    ja: "`aws:TokenIssueTime`・`aws:userid`・`aws:SourceIdentity` による拒否で無効化を練習しておく。",
  },
  {
    en: "Watch `SessionTokenUtilization` in CloudWatch `AWS/STS`.",
    ja: "CloudWatch の `AWS/STS` で `SessionTokenUtilization` を見張る。",
  },
];

export function OpsSection() {
  const { t } = useLang();
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
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
        ja: "STS が CloudTrail のどこに記録するか、毎秒 600 リクエストの枠がどう分かれるか、料金、そして一時認証情報がどう悪用されるか。",
      }}
    >
      <TrailExplorer />
      <Callout kind="warn">
        {{
          en: "Global endpoint calls are logged in **us-east-1** even when they were served in your Region. A trail that only covers your home Region misses them.",
          ja: "グローバルエンドポイントの呼び出しは、自分のリージョンで処理されても **us-east-1** に記録される。ホームリージョンだけの証跡では見逃す。",
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
              ja: "STS 自体は追加料金なし。払うのは認証情報で呼んだサービスと、VPC エンドポイントを使うなら PrivateLink の料金。",
            },
            src: "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html",
          },
          {
            k: { en: "SLA", ja: "SLA" },
            v: { en: "None published", ja: "公開なし" },
            d: {
              en: "The AWS SLA index lists no STS or core IAM SLA (checked 2026-10-10). Design for Regional isolation instead.",
              ja: "AWS の SLA 一覧に STS やコア IAM の SLA は無い (2026-10-10 確認)。リージョン単位の分離で設計する。",
            },
            src: "https://aws.amazon.com/legal/service-level-agreements/",
          },
          {
            k: { en: "Quota", ja: "クォータ" },
            v: { en: "600 rps", ja: "600 rps" },
            d: {
              en: "Per account, per Region, shared by six operations. Increases go through AWS Support.",
              ja: "アカウント・リージョンごと、6 つの操作で共有。引き上げは AWS サポート経由。",
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
            ja: "一時認証情報はベアラートークン。キー・シークレット・トークンを持っていれば、期限まではどこからでも使える。守りは短い寿命と狭い権限。",
          }}
        </P>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {THREATS.map((th) => (
            <li
              key={th.title.en}
              className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <h4 className="font-semibold text-[var(--deny)]">{t(th.title)}</h4>
              <p className="mt-1 text-sm">{rich(t(th.example))}</p>
              <p className="mt-2 border-t border-dashed border-[var(--line)] pt-2 text-sm">
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
      </div>

      <div>
        <h3 className="mb-1 font-display text-2xl font-bold">
          {t({ en: "Hardening checklist", ja: "堅牢化チェックリスト" })}
        </h3>
        <p className="mb-3 text-sm text-[var(--muted)]" aria-live="polite">
          {t({
            en: `${done.size} of ${CHECKLIST.length} done. Ticks stay on this page only.`,
            ja: `${CHECKLIST.length} 項目中 ${done.size} 項目完了 (チェックはこのページ内だけ)。`,
          })}
        </p>
        <ul className="grid gap-1.5 md:grid-cols-2">
          {CHECKLIST.map((c, i) => (
            <li key={c.en}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-[var(--sunk)]">
                <input
                  type="checkbox"
                  checked={done.has(i)}
                  onChange={() => toggle(i)}
                  className="mt-1 size-4 shrink-0 accent-[var(--resource)]"
                />
                <span
                  className={`text-[0.95rem] ${done.has(i) ? "text-[var(--muted)] line-through" : ""}`}
                >
                  {rich(t(c))}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
