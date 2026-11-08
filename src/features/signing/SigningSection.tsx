import { Callout, Figure, More, P, Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import { BEDROCK_BEARER, BEDROCK_NOTES, CREATE_ACCESS_KEY } from "./demos";
import { PresignLab } from "./PresignLab";
import { ServerNotes, SignatureLab } from "./SignatureLab";
import { SigV4aLab } from "./SigV4aLab";
import { Wire } from "./Wire";

const REPO = "https://github.com/0-draft/aws-credentials/blob/main";

export function SigningSection() {
  const { t } = useLang();
  return (
    <Section
      id="signing"
      index={chapter("signing")}
      title={{
        en: "Signing: what a credential does on the wire",
        ja: "署名: 認証情報は通信路で何をするのか",
      }}
      lede={{
        en: "A secret access key is never sent. Every request carries a signature computed from it instead, and AWS recomputes that signature on its side. This chapter runs the real SigV4 and SigV4a algorithms in your browser.",
        ja: "シークレットアクセスキーそのものは送られません。代わりに、そこから計算した署名を毎回のリクエストに付け、AWS が自分の側で同じ署名を計算し直します。この章では本物の SigV4 と SigV4a のアルゴリズムをブラウザ内で動かします。",
      }}
    >
      <P>
        {{
          en: "Every credential passes through four stages: **issue** (IAM or STS hands it out), **sign** (your code turns it into a signature), **verify** (the service recomputes the signature) and **authorize** (only then are policies evaluated). The unsigned `AssumeRoleWithWebIdentity` and `AssumeRoleWithSAML` calls never reach the sign stage: the token in the body is the proof. A bearer token skips issue and sign both.",
          ja: "認証情報は 4 つの段階を通ります。**発行** (IAM か STS が渡す)、**署名** (自分のコードが署名に変える)、**検証** (サービスが署名を計算し直す)、**認可** (ここで初めてポリシーが評価される) です。署名のない `AssumeRoleWithWebIdentity` と `AssumeRoleWithSAML` は署名の段階を通りません。ボディのトークンが証明そのものです。bearer トークンは発行と署名の両方を飛ばします。",
        }}
      </P>
      <SignatureLab />
      <Callout kind="note">
        {{
          en: "S3 signs the path exactly as sent; every other service URI-encodes it a second time in the canonical request. Hand-rolled signers that get this wrong work against one and fail against the other.",
          ja: "S3 はパスを送ったとおりに署名しますが、それ以外のサービスは正規リクエストの中でパスをもう一度 URI エンコードします。ここを間違えた手書きの署名処理は、片方では動いてもう片方では失敗します。",
        }}
      </Callout>
      <Callout kind="warn">
        {{
          en: "Exporting `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` is the quickest way to hand temporary credentials to a signer, and the one that bites: switch back to a long-term key without unsetting `AWS_SESSION_TOKEN` and the stale token rides along with a key it does not belong to, so every request fails with `InvalidClientTokenId`. Pasting the values into SDK constructor arguments has the opposite problem: static credentials never refresh and die at `Expiration`.",
          ja: "`AWS_ACCESS_KEY_ID`・`AWS_SECRET_ACCESS_KEY`・`AWS_SESSION_TOKEN` を export するのは、一時認証情報を署名側に渡すいちばん手早い方法で、いちばん事故が起きる方法です。`AWS_SESSION_TOKEN` を unset せずに長期キーに戻すと、無関係なキーに古いトークンが付いたままになり、すべてのリクエストが `InvalidClientTokenId` で失敗します。値を SDK のコンストラクタ引数に貼り付けると逆の問題が起きます。静的な認証情報は更新されず、`Expiration` の時刻に使えなくなります。",
        }}
      </Callout>

      <More
        summary={{
          en: "Where an `AKIA…` key comes from: IAM `CreateAccessKey`, not STS",
          ja: "`AKIA…` キーの出どころ: STS ではなく IAM の `CreateAccessKey`",
        }}
      >
        <P>
          {{
            en: "A long-term key is the only AWS credential with no expiration. IAM stores the secret so it can recompute signatures later, and shows it to you exactly once. An IAM user can hold two access keys at a time, Active or Inactive; asking for a third returns `LimitExceeded`. Two is what makes rotation possible: create the new one, move traffic, delete the old one.",
            ja: "長期キーは有効期限のない唯一の AWS 認証情報です。IAM は後で署名を再計算するためにシークレットを保管し、利用者には一度だけ表示します。IAM ユーザーが同時に持てるアクセスキーは Active・Inactive を問わず 2 本までで、3 本目を求めると `LimitExceeded` が返ります。2 本あるからローテーションが成り立ちます。新しいキーを作り、トラフィックを移し、古いキーを消します。",
          }}
        </P>
        <Wire
          label={t({
            en: "Request (signed by an admin)",
            ja: "リクエスト (管理者が署名)",
          })}
          message={CREATE_ACCESS_KEY.request}
        />
        <Wire
          label={t({ en: "Response", ja: "レスポンス" })}
          message={CREATE_ACCESS_KEY.response}
        />
      </More>

      <P>
        {{
          en: "A **presigned URL** is the same signature moved out of the headers and into the query string. That turns it into a bearer token: whoever holds the URL can make that one request until it expires, with no key and no IAM identity of their own.",
          ja: "**presigned URL** は、同じ署名をヘッダーからクエリ文字列に移したものです。その結果、bearer トークンになります。URL を持っている人は、キーも自分の IAM ID もなしに、期限までその 1 つのリクエストを実行できます。",
        }}
      </P>
      <PresignLab />
      <ServerNotes
        notes={[
          {
            title: { en: "Same verification, different place", ja: "同じ検証、違う場所" },
            detail: {
              en: "S3 rebuilds the canonical request from the query string rather than the headers, recomputes, and compares. The algorithm is unchanged.",
              ja: "S3 はヘッダーではなくクエリ文字列から正規リクエストを組み立て直し、再計算して照合します。アルゴリズムは変わりません。",
            },
          },
          {
            title: {
              en: "The principal is still you",
              ja: "プリンシパルは署名した本人のまま",
            },
            detail: {
              en: "The URL uses the credentials of the principal that generated it, and CloudTrail records that principal, not whoever used the link. Actions taken with a shared URL are attributed to you.",
              ja: "URL が使うのは生成したプリンシパルの認証情報で、CloudTrail に残るのもそのプリンシパルです。リンクを使った相手ではありません。共有した URL で行われた操作は自分の名前で記録されます。",
            },
            tone: "warn",
          },
          {
            title: {
              en: "Nothing to revoke individually",
              ja: "個別に失効させる手段はない",
            },
            detail: {
              en: "Signing is arithmetic over a string; nothing is registered with AWS. A presigned URL cannot be revoked on its own: only disabling or rotating the credential that signed it, or the session ending, kills it early.",
              ja: "署名は文字列に対する計算にすぎず、AWS 側には何も登録されません。presigned URL を単独で失効させることはできず、早めに無効にするには署名した認証情報を止めるかローテーションする (またはセッションが切れる) しかありません。",
            },
            tone: "warn",
          },
        ]}
      />

      <P>
        {{
          en: "A SigV4 signing key is scoped to one Region by construction. **SigV4a** moves that scoping elsewhere so one signature can be valid in several Regions, which is what S3 Multi-Region Access Points need; SDKs and the CLI switch to it automatically for them. It signs with an ECDSA P-256 key derived from the same secret, so verifying needs only the public half, and that can be replicated freely. SigV4 verification needs the shared secret, so every Region that verifies must hold it.",
          ja: "SigV4 の署名キーは構造上 1 つのリージョンに固定されます。**SigV4a** はその固定を別の場所に移し、1 つの署名を複数のリージョンで有効にします。S3 マルチリージョンアクセスポイントに必要な仕組みで、SDK と CLI はその宛先に対して自動で切り替えます。同じシークレットから導出した ECDSA P-256 鍵で署名するので、検証には公開鍵だけあればよく、それは自由に複製できます。SigV4 の検証には共有シークレットが要るので、検証するリージョンはすべてそれを持つ必要があります。",
        }}
      </P>
      <SigV4aLab />

      <P>
        {{
          en: "**Amazon Bedrock API keys** are the one AWS path that skips SigV4 entirely: one `Authorization: Bearer` header, no canonical request, no signing key, no SDK required. They exist for tools that expect an API key and cannot be taught to sign. Short-term keys last up to 12 hours (or the session, if shorter) and work only in the Region they were generated in; long-term keys last until a configured expiry and are tied to an IAM user.",
          ja: "**Amazon Bedrock の API キー** は、SigV4 を丸ごと飛ばす AWS で唯一の経路です。`Authorization: Bearer` ヘッダー 1 つだけで、正規リクエストも署名キーも SDK も要りません。API キーを前提にしていて署名を組み込めないツールのためにあります。短期キーは最長 12 時間 (セッションの方が短ければそれまで) で、生成したリージョンでしか使えません。長期キーは設定した期限まで有効で、IAM ユーザーに紐づきます。",
        }}
      </P>
      <Figure
        title={{
          en: "A Bedrock call with a bearer token",
          ja: "bearer トークンで Bedrock を呼ぶ",
        }}
        hint={{
          en: "Everything the signature lab above computes simply does not happen here.",
          ja: "上の署名ラボで計算していたことが、ここでは何ひとつ起きません。",
        }}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Wire label={t({ en: "Request", ja: "リクエスト" })} message={BEDROCK_BEARER} />
          <ServerNotes notes={BEDROCK_NOTES} />
        </div>
      </Figure>
      <Callout kind="note">
        {{
          en: "CloudTrail still logs the Bedrock API calls, but the API key travels as an authorization header and is not logged.",
          ja: "Bedrock の API 呼び出しは CloudTrail に記録されますが、API キー自体は authorization ヘッダーで送られるので記録されません。",
        }}
      </Callout>

      <P>
        {{
          en: "How the signer is checked: CI asserts it byte for byte against two worked examples AWS publishes, the Glacier Create Vault signature (canonical request, string to sign and signature) and the S3 presigned `test.txt` URL. SigV4a has no AWS-published vector, so its derived keys are cross-checked against an independent implementation of the published pseudocode instead, which is weaker evidence. One of the Glacier page's own examples does not reproduce; the notes record how that was ruled out.",
          ja: "署名処理の確かめ方: CI で、AWS が公開している 2 つの計算例とバイト単位で照合しています。Glacier の Create Vault の署名 (正規リクエスト・署名対象文字列・署名) と、S3 の presigned `test.txt` の URL です。SigV4a には AWS 公開のテストベクタがないので、公開された疑似コードを別に実装したものと導出結果を突き合わせています。こちらは証拠としては弱めです。Glacier のページにある別の例は再現できず、その切り分けの経緯は調査メモに残しています。",
        }}
      </P>

      <p className="prose-col text-sm text-[var(--muted)]">
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html">
          AWS Signature Version 4 for API requests
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html">
          Create a signed AWS API request
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/amazonglacier/latest/dev/amazon-glacier-signing-requests.html">
          Glacier: example signature calculation
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html">
          S3 presigned URLs
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiRegionAccessPointRequests.html">
          Multi-Region Access Point requests
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html">
          Manage access keys for IAM users
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html">
          Amazon Bedrock API keys
        </Src>
        {", "}
        <Src href={`${REPO}/docs/signing/05-verification.md`}>
          {t({ en: "how the signer was verified", ja: "署名処理の検証メモ" })}
        </Src>
      </p>
    </Section>
  );
}
