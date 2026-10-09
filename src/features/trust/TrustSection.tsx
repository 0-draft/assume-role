import { useState } from "react";
import { Callout, Code, Figure, P, Section, Segmented, Src } from "@/components/ui";
import { Sequence } from "@/components/ui/Sequence";
import { chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { DEPUTY_LANES, DEPUTY_STEPS } from "./deputy";
import { GatesLab } from "./GatesLab";
import { KeyCatalog } from "./KeyCatalog";
import { OidcLab } from "./OidcLab";
import { EXAMPLES } from "./policies";

function Examples() {
  const { t } = useLang();
  const [id, setId] = useState(EXAMPLES[0].id);
  const ex = EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
  return (
    <Figure
      title={{ en: "Trust policies you can copy", ja: "コピーして使える信頼ポリシー" }}
      hint={{
        en: "Account IDs and names are placeholders.",
        ja: "アカウント ID や名前はダミーです。",
      }}
    >
      <Segmented
        label={{ en: "Who is trusted", ja: "誰を信頼するか" }}
        value={id}
        onChange={setId}
        color="var(--role)"
        options={EXAMPLES.map((e) => ({ value: e.id, label: e.label }))}
      />
      <p className="prose-col mt-4 text-sm">{rich(t(ex.note))}</p>
      <div className="mt-3">
        <Code label="trust-policy.json">{ex.json}</Code>
      </div>
    </Figure>
  );
}

export function TrustSection() {
  return (
    <Section
      id="trust"
      index={chapter("trust")}
      title={{
        en: "Trust policies decide who gets a ticket",
        ja: "チケットを渡す相手は信頼ポリシーが決める",
      }}
      lede={{
        en: "Every role carries a trust policy: a resource-based policy that names who may assume it. STS reads it on every AssumeRole* call, and it must say yes explicitly, even inside one account.",
        ja: "すべてのロールは信頼ポリシーを持っています。誰がそのロールを引き受けてよいかを書いたリソースベースのポリシーです。STS は AssumeRole* のたびにこれを読み、同じアカウント内であっても明示的な許可がなければ通しません。",
      }}
    >
      <P>
        {{
          en: "An `AssumeRole` call is checked from two sides. The **trust policy** on the role must allow the caller, and the **caller's identity policy** must allow `sts:AssumeRole` on the role, except when the role is in the same account and the trust policy names the caller directly. SCPs on the caller's account, RCPs on the role's account and the caller's permissions boundary can still deny.",
          ja: "`AssumeRole` は両側からチェックされます。ロールの **信頼ポリシー** が呼び出し元を許可し、かつ **呼び出し元の ID ポリシー** がそのロールへの `sts:AssumeRole` を許可していること。ただし同じアカウントで信頼ポリシーが呼び出し元を名指ししている場合は ID ポリシー側の許可が要りません。呼び出し元アカウントの SCP、ロール側アカウントの RCP、呼び出し元の Permissions Boundary はそれでも拒否できます。",
        }}
      </P>
      <GatesLab />
      <Callout kind="new">
        {{
          en: "Since 2022-09-21 a role does not trust itself implicitly. If a workload re-assumes its own role (to add session tags or a session policy), the role's trust policy must name that role. A small allow list of legacy roles kept the old behaviour; for them CloudTrail records `explicitTrustGrant: false`.",
          ja: "2022-09-21 以降、ロールは自分自身を暗黙には信頼しません。ワークロードが自分のロールを引き受け直す (セッションタグやセッションポリシーを付けるため) なら、信頼ポリシーにそのロール自身を書く必要があります。旧挙動を使っていた一部のロールだけ許可リストで例外扱いになっており、CloudTrail に `explicitTrustGrant: false` が記録されます。",
        }}
      </Callout>

      <P>
        {{
          en: "Federated principals have no AWS identity policy at all, so the trust policy is the only gate. For OIDC that means the conditions on the token's claims are your whole security boundary. GitHub Actions is the case people get wrong most often: the token says which repository, ref and environment the job ran in, and the trust policy has to check that.",
          ja: "フェデレーションのプリンシパルには AWS の ID ポリシーがそもそもないので、ゲートは信頼ポリシーだけです。OIDC なら、トークンのクレームに対する条件がセキュリティ境界のすべてになります。いちばん間違えやすいのが GitHub Actions です。トークンにはジョブがどのリポジトリ・ref・environment で動いたかが入っていて、信頼ポリシーはそれを検査しなければなりません。",
        }}
      </P>
      <OidcLab />
      <Callout kind="warn">
        {{
          en: "IAM now refuses to save a trust policy for GitHub's provider unless `token.actions.githubusercontent.com:sub` is present and is not only a wildcard. It does not stop `repo:*` or `repo:my-org*` (no slash), which still match repositories anyone can create.",
          ja: "IAM は GitHub プロバイダー向けの信頼ポリシーについて、`token.actions.githubusercontent.com:sub` があってワイルドカードだけではないことを保存時に検査するようになりました。ただし `repo:*` や `repo:my-org*` (スラッシュなし) は止めてくれません。これらは誰でも作れるリポジトリに一致します。",
        }}
      </Callout>
      <Callout kind="new">
        {{
          en: "GitHub immutable subject claims: repositories created after 2026-07-15, and repositories renamed or transferred after that date, send `repo:OWNER@OWNER_ID/REPO@REPO_ID:...` (github.com only, not GHES). Older repositories keep the name-only form unless an admin opts in. A trust policy that only lists the name form will start failing for those repositories.",
          ja: "GitHub の immutable subject claims: 2026-07-15 以降に作成されたリポジトリと、その日以降にリネーム・移管されたリポジトリは `repo:OWNER@OWNER_ID/REPO@REPO_ID:...` を送ります (github.com のみ、GHES は対象外)。それ以前のリポジトリは管理者がオプトインしない限り名前だけの形のままです。名前の形しか書いていない信頼ポリシーは、こうしたリポジトリで失敗し始めます。",
        }}
      </Callout>

      <P>
        {{
          en: "Cross-account access to a SaaS vendor has a different trap: the **confused deputy**. The vendor's role is trusted by many customers, and role ARNs are not secrets. The fix is an external ID that the vendor generates per customer and always sends, and that each customer checks with `sts:ExternalId`.",
          ja: "SaaS ベンダーにクロスアカウントでアクセスさせる場合は別の罠があります。**Confused Deputy (混乱した代理人)** です。ベンダーのロールは多くの顧客から信頼されていて、ロール ARN は秘密ではありません。対策は、ベンダーが顧客ごとに生成して必ず送る外部 ID を、各顧客が `sts:ExternalId` で検査することです。",
        }}
      </P>
      <Figure
        title={{
          en: "How ExternalId stops a confused deputy",
          ja: "ExternalId が Confused Deputy を止める流れ",
        }}
        hint={{
          en: "Step through with Next or the arrow keys.",
          ja: "「次へ」か矢印キーで 1 ステップずつ進めます。",
        }}
      >
        <Sequence
          lanes={DEPUTY_LANES}
          steps={DEPUTY_STEPS}
          ariaLabel={{
            en: "Confused deputy sequence",
            ja: "Confused Deputy のシーケンス",
          }}
        />
      </Figure>
      <Callout kind="note">
        {{
          en: "The same problem exists between AWS services. When a service principal such as `logs.amazonaws.com` assumes your role, add `aws:SourceAccount` and `aws:SourceArn` so the role only works for your own resources. Both are evaluated independently and both must match. Whether a service sets them on `sts:AssumeRole` varies, so check that service's docs.",
          ja: "同じ問題は AWS サービス間にもあります。`logs.amazonaws.com` のようなサービスプリンシパルにロールを引き受けさせるときは、`aws:SourceAccount` と `aws:SourceArn` を付けて自分のリソースのためだけに使われるようにします。2 つは独立に評価され、両方の一致が必要です。サービスが `sts:AssumeRole` でこれらを設定するかはサービスごとに違うので、各サービスのドキュメントを確認してください。",
        }}
      </Callout>

      <KeyCatalog />
      <Examples />

      <p className="prose-col text-sm text-[var(--muted)]">
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html">
          Policy evaluation logic
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html">
          AssumeRole
        </Src>
        {", "}
        <Src href="https://aws.amazon.com/blogs/security/announcing-an-update-to-iam-role-trust-policy-behavior/">
          Role trust policy behaviour update (2022)
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html">
          IAM roles for GitHub OIDC
        </Src>
        {", "}
        <Src href="https://docs.github.com/en/actions/reference/security/oidc">
          GitHub OIDC reference
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html">
          Confused deputy
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html">
          Service Authorization Reference: STS
        </Src>
      </p>
    </Section>
  );
}
