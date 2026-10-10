import { useLang } from "@/i18n/useLang";
import type { L } from "@/i18n/lang";
import { chapter } from "@/data/nav";
import { Callout, Figure, More, P, Section, Src } from "@/components/ui";
import { rich } from "@/lib/rich";
import { PermissionsLab } from "./PermissionsLab";
import { ChainBuilder } from "./ChainBuilder";
import { TokenMeter } from "./TokenMeter";
import { RevokeTimeline } from "./RevokeTimeline";

const DOCS = {
  evaluation:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html",
  roles: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html",
  tags: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html",
  sourceIdentity:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html",
  assumeRole: "https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html",
  quotas: "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html",
  tokenBlog:
    "https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/",
  revoke:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html",
  disable:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html",
  principal:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html",
  variables:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html",
};

const DURATIONS: { how: L; range: L }[] = [
  {
    how: {
      en: "`AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`",
      ja: "`AssumeRole`、`AssumeRoleWithSAML`、`AssumeRoleWithWebIdentity`",
    },
    range: {
      en: "15 min to the role's MaxSessionDuration (1–12 h), default 1 h",
      ja: "15 分〜ロールの MaxSessionDuration (1〜12 時間)、既定 1 時間",
    },
  },
  {
    how: { en: "Role chaining", ja: "ロールチェーン" },
    range: { en: "15 min to 1 h, hard cap", ja: "15 分〜1 時間 (変更不可の上限)" },
  },
  {
    how: {
      en: "`GetSessionToken`, `GetFederationToken` (IAM user)",
      ja: "`GetSessionToken`、`GetFederationToken` (IAM ユーザー)",
    },
    range: { en: "15 min to 36 h, default 12 h", ja: "15 分〜36 時間、既定 12 時間" },
  },
  {
    how: {
      en: "Same calls with root user credentials",
      ja: "同じ呼び出しをルートユーザーで",
    },
    range: { en: "15 min to 1 h", ja: "15 分〜1 時間" },
  },
  {
    how: { en: "`AssumeRoot`", ja: "`AssumeRoot`" },
    range: { en: "up to 15 min, default 15 min", ja: "最大 15 分、既定 15 分" },
  },
];

const PRINCIPALS: { kind: L; arn: string; userid: string; note?: L }[] = [
  {
    kind: {
      en: "AssumeRole, SAML or OIDC session",
      ja: "AssumeRole / SAML / OIDC のセッション",
    },
    arn: "arn:aws:sts::111122223333:assumed-role/Deployer/ci-run-42",
    userid: "AROAEXAMPLEID:ci-run-42",
  },
  {
    kind: { en: "EC2 instance role", ja: "EC2 インスタンスロール" },
    arn: "arn:aws:sts::111122223333:assumed-role/WebServer/i-0abc12345def67890",
    userid: "AROAEXAMPLEID:i-0abc12345def67890",
    note: {
      en: "Both forms appear in an AWS Knowledge Center example; the session name is the instance ID.",
      ja: "どちらの形式も AWS ナレッジセンターの例に載っています。セッション名はインスタンス ID です。",
    },
  },
  {
    kind: { en: "GetFederationToken", ja: "GetFederationToken" },
    arn: "arn:aws:sts::111122223333:federated-user/jane",
    userid: "111122223333:jane",
  },
  {
    kind: { en: "IAM user (for comparison)", ja: "IAM ユーザー (比較用)" },
    arn: "arn:aws:iam::111122223333:user/alice",
    userid: "AIDAEXAMPLEID",
  },
  {
    kind: { en: "Root user", ja: "ルートユーザー" },
    arn: "arn:aws:iam::111122223333:root",
    userid: "111122223333",
  },
];

export function SessionsSection() {
  const { t } = useLang();
  return (
    <Section
      id="sessions"
      index={chapter("sessions")}
      title={{
        en: "What a session can do, and for how long",
        ja: "セッションにできること、使える時間",
      }}
      lede={{
        en: "STS hands back a pass, not a new identity. What the pass opens is the role's permissions cut down by every gate in front of it. How long it lasts depends on how you got it.",
        ja: "STS が返すのは新しい ID ではなく、期限付きの通行証です。開けられる扉は、ロールの権限を手前のゲートすべてで削った残りです。有効期限は入手経路で決まります。",
      }}
    >
      <P>
        {{
          en: "A role session never has more than the role. Each request it signs is checked against every policy type in a fixed order, and the first gate that does not allow the action stops it. A session policy, passed in the `AssumeRole` call, is one more gate: it can only take permissions away.",
          ja: "ロールセッションがロール以上の権限を持つことはありません。署名したリクエストは決まった順序で各ポリシーと照合され、許可しないゲートに当たった時点で止まります。`AssumeRole` 呼び出しで渡すセッションポリシーはもう一枚のゲートで、権限を削ることしかできません。",
        }}
      </P>

      <Figure
        title={{
          en: "Six gates between a session and an API call",
          ja: "セッションと API 呼び出しの間にある 6 枚のゲート",
        }}
        hint={{
          en: "Rows are gates in evaluation order; requests fall from top to bottom. Click squares to edit policies.",
          ja: "行は評価順のゲートで、リクエストは上から下へ落ちていきます。マスをクリックしてポリシーを編集できます。",
        }}
      >
        <PermissionsLab />
      </Figure>

      <Callout kind="warn">
        {{
          en: "Resource-based policies are the exception. A bucket or key policy that names the **session ARN** adds access after the session is created, so a session policy or permissions boundary does not cut it back (same account). One that names the **role ARN** is limited like the identity policy.",
          ja: "例外はリソースベースのポリシーです。バケットやキーのポリシーが **セッション ARN** を指定している場合、その権限はセッション作成後に加わるため、同一アカウント内ならセッションポリシーや境界で削られません。**ロール ARN** を指定している場合は ID ポリシーと同様に制限されます。",
        }}
      </Callout>

      <More
        summary={{
          en: "Evaluation order, as AWS documents it",
          ja: "AWS が示す評価順序",
        }}
      >
        <ol className="prose-col list-decimal space-y-1 pl-5 text-sm">
          {[
            {
              en: "An explicit `Deny` in any policy ends evaluation.",
              ja: "どれかのポリシーに明示的な `Deny` があれば、その時点で評価が終わります。",
            },
            {
              en: "RCPs on the resource's account must allow. `RCPFullAWSAccess` is attached automatically when RCPs are enabled.",
              ja: "リソース側アカウントの RCP が許可していること。RCP を有効にすると `RCPFullAWSAccess` が自動でアタッチされます。",
            },
            {
              en: "SCPs on the caller's account must allow. SCPs do not affect the management account or service-linked roles.",
              ja: "呼び出し側アカウントの SCP が許可していること。管理アカウントとサービスリンクロールには効きません。",
            },
            {
              en: "A resource policy naming the session principal can allow on its own.",
              ja: "セッションプリンシパルを指定したリソースポリシーは、単独で許可できます。",
            },
            {
              en: "Identity policies must allow, then the permissions boundary if one is set.",
              ja: "ID ポリシーが許可し、境界が設定されていれば境界も許可していること。",
            },
            {
              en: "If a session policy was passed it must allow; if not, a default session policy allows everything.",
              ja: "セッションポリシーを渡した場合はそれも許可していること。渡さなければ既定のセッションポリシーがすべて許可します。",
            },
          ].map((s, i) => (
            <li key={i}>{rich(t(s))}</li>
          ))}
        </ol>
        <p className="text-sm">
          <Src href={DOCS.evaluation}>
            {t({ en: "Policy evaluation logic", ja: "ポリシー評価ロジック" })}
          </Src>
        </p>
      </More>

      <P>
        {{
          en: "**Role chaining** is a role session assuming another role. It is capped at one hour no matter what the role allows, and asking for more fails the call. Signing in through SAML or OIDC, or using IAM user keys, is not chaining. Session tags marked transitive and the `SourceIdentity` follow you down the chain; everything else stays behind.",
          ja: "**ロールチェーン** とは、ロールセッションが別のロールを引き受けることです。ロールの設定に関係なく 1 時間が上限で、それ以上を要求すると呼び出しが失敗します。SAML や OIDC でのサインイン、IAM ユーザーのキーからの引き受けはチェーンではありません。推移指定したセッションタグと `SourceIdentity` はチェーンの先へ引き継がれ、それ以外は残りません。",
        }}
      </P>

      <Figure
        title={{ en: "Build a role chain", ja: "ロールチェーンを組み立てる" }}
        hint={{
          en: "Pick a starting point, then change durations and tags on each pass. Tags marked ↪ ride into the next hop.",
          ja: "出発点を選び、各通行証の期間とタグを変えてみてください。↪ 付きのタグが次の段へ引き継がれます。",
        }}
      >
        <ChainBuilder />
      </Figure>

      <More
        summary={{
          en: "Session duration by how you got the credentials",
          ja: "入手経路ごとのセッション期間",
        }}
      >
        <div tabIndex={0} className="scroll-x">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-1.5 pr-3 font-semibold">
                  {t({ en: "Credentials from", ja: "入手方法" })}
                </th>
                <th className="py-1.5 font-semibold">DurationSeconds</th>
              </tr>
            </thead>
            <tbody>
              {DURATIONS.map((d, i) => (
                <tr key={i} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 pr-3">{rich(t(d.how))}</td>
                  <td className="py-1.5">{t(d.range)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          <Src href={DOCS.roles}>
            {t({ en: "IAM roles: role chaining", ja: "IAM ロール: ロールチェーン" })}
          </Src>
          {" / "}
          <Src href={DOCS.tags}>{t({ en: "Session tags", ja: "セッションタグ" })}</Src>
          {" / "}
          <Src href={DOCS.sourceIdentity}>
            {t({ en: "Source identity", ja: "ソースアイデンティティ" })}
          </Src>
        </p>
      </More>

      <P>
        {{
          en: "Session tags and session policies are not stored on a server somewhere: they are packed into the session token you carry. That token has a size limit, separate from the per-field limits.",
          ja: "セッションタグとセッションポリシーはどこかのサーバーに保存されるのではなく、持ち歩くセッショントークンの中に詰め込まれます。そのトークンには、各項目の上限とは別にサイズ上限があります。",
        }}
      </P>

      <Figure
        title={{ en: "What fits in a session token", ja: "セッショントークンに収まる量" }}
        hint={{
          en: "Drag the sliders. The left checks are exact; the token bar is an illustration.",
          ja: "スライダーを動かしてみてください。左側の上限チェックは正確、トークンのバーはイメージです。",
        }}
      >
        <TokenMeter />
      </Figure>

      <Callout kind="new">
        {{
          en: "On 2026-09-15 STS moved to one 4096-byte limit on the session token. Responses now carry `SessionTokenSize` and `SessionTokenUtilization`, `PackedPolicySize` is deprecated, and the new `MinimumSessionTokenSize` parameter (0–4096) pads a token so you can test that your clients cope with large ones.",
          ja: "2026-09-15 から、STS のセッショントークンは 4096 バイトの単一上限になりました。レスポンスに `SessionTokenSize` と `SessionTokenUtilization` が加わり、`PackedPolicySize` は非推奨になりました。新しい `MinimumSessionTokenSize` パラメータ (0〜4096) でトークンを水増しし、大きなトークンをクライアントが扱えるか試せます。",
        }}
      </Callout>
      <p className="prose-col text-sm">
        <Src href={DOCS.tokenBlog}>
          {t({
            en: "AWS Security Blog: session token size",
            ja: "AWS Security Blog: セッショントークンのサイズ",
          })}
        </Src>
        {" / "}
        <Src href={DOCS.assumeRole}>AssumeRole API</Src>
        {" / "}
        <Src href={DOCS.quotas}>
          {t({ en: "IAM and STS quotas", ja: "IAM と STS のクォータ" })}
        </Src>
      </p>

      <P>
        {{
          en: "There is no API to cancel an issued credential. It stays valid until it expires. What you can change is policy, because every request is re-evaluated: the IAM console's **Revoke active sessions** adds a deny for every session whose `aws:TokenIssueTime` is older than about 30 seconds from now.",
          ja: "発行済みの認証情報を取り消す API はなく、期限まで有効なままです。変えられるのはポリシーのほうで、リクエストは毎回評価し直されます。IAM コンソールの **アクティブなセッションを取り消す** は、`aws:TokenIssueTime` が現在から約 30 秒後より前のセッションをすべて拒否するポリシーを追加します。",
        }}
      </P>

      <Figure
        title={{ en: "Revoke active sessions", ja: "アクティブなセッションの取り消し" }}
        hint={{
          en: "Revoke, then let time pass and issue a new session to see which side of the line it lands on.",
          ja: "取り消してから時間を進め、新しいセッションを発行すると、線のどちら側に来るかがわかります。",
        }}
      >
        <RevokeTimeline />
      </Figure>

      <Callout kind="warn">
        {{
          en: "Revoking needs `iam:PutRolePolicy` and does not work on service-linked roles or IAM Identity Center permission-set roles (revoke those in Identity Center). Policy changes take a few minutes to propagate, the CLI keeps assumed-role credentials in `~/.aws/cli/cache`, and sessions from `GetFederationToken` or `GetSessionToken` called as root cannot be restricted by policy at all.",
          ja: "取り消しには `iam:PutRolePolicy` が必要で、サービスリンクロールや IAM Identity Center の許可セットのロールには使えません (Identity Center 側で取り消します)。ポリシー変更の反映には数分かかり、CLI は引き受けたロールの認証情報を `~/.aws/cli/cache` に保持します。ルートで呼んだ `GetFederationToken` / `GetSessionToken` のセッションはポリシーで制限できません。",
        }}
      </Callout>
      <p className="prose-col text-sm">
        <Src href={DOCS.revoke}>
          {t({ en: "Revoke role sessions", ja: "ロールセッションの取り消し" })}
        </Src>
        {" / "}
        <Src href={DOCS.disable}>
          {t({ en: "Disabling temporary credentials", ja: "一時認証情報の無効化" })}
        </Src>
      </p>

      <Figure
        title={{
          en: "How a session shows up in policies and logs",
          ja: "ポリシーやログでのセッションの見え方",
        }}
        wide
      >
        <div tabIndex={0} className="scroll-x">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2 pr-3 font-semibold">
                  {t({ en: "Principal", ja: "プリンシパル" })}
                </th>
                <th className="py-2 pr-3 font-semibold">ARN</th>
                <th className="py-2 font-semibold">aws:userid</th>
              </tr>
            </thead>
            <tbody>
              {PRINCIPALS.map((p) => (
                <tr
                  key={p.arn}
                  className="border-b border-[var(--line)] align-top last:border-0"
                >
                  <td className="py-2 pr-3 font-semibold">{t(p.kind)}</td>
                  <td className="py-2 pr-3 font-mono text-xs break-all">
                    {p.arn}
                    {p.note && (
                      <span className="mt-1 block font-sans text-[0.7rem] text-[var(--muted)]">
                        {t(p.note)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs break-all">{p.userid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="prose-col mt-4 list-disc space-y-1.5 pl-5 text-sm">
          {[
            {
              en: "Name the **role ARN** in policies, not the session ARN. AWS recommends role principals wherever possible, and the session name is picked by whoever calls `AssumeRole`.",
              ja: "ポリシーにはセッション ARN ではなく **ロール ARN** を書きます。AWS もできる限りロールプリンシパルを推奨しており、セッション名は `AssumeRole` を呼ぶ側が自由に決められます。",
            },
            {
              en: "A role ARN in a `Principal` element is stored as the role's unique ID (`AROA…`). Delete and recreate the role with the same name and the policy no longer matches until you save it again.",
              ja: "`Principal` 要素のロール ARN は、保存時にロールの一意 ID (`AROA…`) に変換されます。同名でロールを作り直すと、保存し直すまでポリシーは一致しません。",
            },
            {
              en: "`aws:PrincipalArn` in a condition is matched by name, so access survives a delete and recreate. Convenient, and also something to keep in mind.",
              ja: "条件キー `aws:PrincipalArn` は名前で照合されるため、作り直しても権限が残ります。便利ですが、注意点でもあります。",
            },
          ].map((s, i) => (
            <li key={i}>{rich(t(s))}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Src href={DOCS.principal}>
            {t({ en: "Principal element", ja: "Principal 要素" })}
          </Src>
          {" / "}
          <Src href={DOCS.variables}>
            {t({ en: "Principal key values", ja: "プリンシパルキーの値" })}
          </Src>
        </p>
      </Figure>
    </Section>
  );
}
