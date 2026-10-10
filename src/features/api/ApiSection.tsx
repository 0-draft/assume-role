import { Callout, Figure, P, Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import { DurationRuler } from "./DurationRuler";
import { IdDecoder } from "./IdDecoder";
import { Matrix } from "./Matrix";
import { TicketWindows } from "./TicketWindows";

export function ApiSection() {
  const { t } = useLang();
  return (
    <Section
      id="api"
      index={chapter("api")}
      title={{ en: "Eleven windows, not one", ja: "窓口は 1 つではなく 11 個" }}
      lede={{
        en: "STS gets explained as AssumeRole. The API Reference lists 11 operations: three hand out role credentials, four hand out other short-lived keys, one signs JWTs for the outside world, and three only answer questions.",
        ja: "STS というと AssumeRole の話になりがちですが、API リファレンスには 11 個のオペレーションがあります。ロールの認証情報を出すのが 3 つ、それ以外の短期キーを出すのが 4 つ、外部向けの JWT に署名するのが 1 つ、質問に答えるだけのものが 3 つです。",
      }}
    >
      <P>
        {{
          en: "Which window you walk up to depends on what you already hold. Pick it below: the windows that will serve you light up, and the one you select prints its pass, with the real CLI call and response.",
          ja: "どの窓口に並ぶかは、手元に何があるかで決まります。下で選ぶと使える窓口が光り、選んだ窓口の「券」が CLI の呼び出し例とレスポンス付きで出てきます。",
        }}
      </P>

      <Figure
        title={{ en: "The ticket windows", ja: "発券窓口" }}
        hint={{
          en: "Choose what you hold, then select any window. Unsigned windows need no AWS keys at all.",
          ja: "手元にあるものを選んでから窓口をクリックしてください。「署名なし」の窓口は AWS のキーがなくても呼べます。",
        }}
      >
        <TicketWindows />
      </Figure>

      <Callout kind="new">
        {{
          en: "Since 2026-09-15 STS enforces one 4,096-byte limit on the assembled session token. Responses now carry `SessionTokenSize` and `SessionTokenUtilization` (percent of the limit), and the new `MinimumSessionTokenSize` parameter (0 to 4096) pads tokens so you can test how your code copes with large ones. `PackedPolicySize` is deprecated and now reports the same number as `SessionTokenUtilization`.",
          ja: "2026-09-15 から、STS は組み上がったセッショントークンに 4,096 バイトの上限を 1 本だけ適用します。レスポンスには `SessionTokenSize` と `SessionTokenUtilization` (上限に対する %) が入り、新パラメータ `MinimumSessionTokenSize` (0〜4096) でトークンを水増しして、大きなトークンでもコードが壊れないか試せます。`PackedPolicySize` は非推奨になり、`SessionTokenUtilization` と同じ値を返します。",
        }}
      </Callout>

      <Figure
        title={{ en: "How long each pass lasts", ja: "券の有効期間" }}
        hint={{
          en: "From one minute to 36 hours, on a log scale. Role chaining and root callers get much shorter ceilings.",
          ja: "1 分から 36 時間までの対数目盛です。ロールチェーンや root からの呼び出しは上限がぐっと短くなります。",
        }}
      >
        <DurationRuler />
      </Figure>

      <Figure
        title={{
          en: "Read an ID by its first four letters",
          ja: "先頭 4 文字で ID を読む",
        }}
        hint={{
          en: "Every IAM identifier starts with a prefix that says what it is.",
          ja: "IAM の識別子は、先頭の接頭辞で種類がわかります。",
        }}
      >
        <IdDecoder />
      </Figure>

      <Figure
        title={{ en: "All eleven side by side", ja: "11 個を横並びで比較" }}
        hint={{
          en: "Scroll sideways inside the table on small screens.",
          ja: "狭い画面では表の中を横にスクロールできます。",
        }}
      >
        <Matrix />
      </Figure>

      <Callout kind="note">
        {{
          en: "Under the SDKs, STS still speaks the AWS Query protocol from API version `2011-06-15`: a form-encoded `Action=AssumeRole&Version=2011-06-15` request, an XML response, SigV4 with signing name `sts`. Unlike CloudWatch, it has not moved to JSON or CBOR. The two federation calls are sent unsigned.",
          ja: "SDK の下では、STS はいまも API バージョン `2011-06-15` の AWS Query プロトコルで話しています。フォームエンコードの `Action=AssumeRole&Version=2011-06-15` を送り、XML が返り、署名は署名名 `sts` の SigV4 です。CloudWatch と違って JSON や CBOR には移行していません。フェデレーション系の 2 つは署名なしで送ります。",
        }}
      </Callout>

      <p className="prose-col text-sm text-[var(--muted)]">
        {t({ en: "Sources: ", ja: "出典: " })}
        <Src href="https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html">
          {t({ en: "STS API Reference, Actions", ja: "STS API リファレンス (Actions)" })}
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html">
          {t({ en: "Compare AWS STS credentials", ja: "AWS STS 認証情報の比較" })}
        </Src>
        {", "}
        <Src href="https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html">
          {t({ en: "IAM identifiers", ja: "IAM 識別子" })}
        </Src>
        {", "}
        <Src href="https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/">
          {t({
            en: "session token size change (2026-09)",
            ja: "セッショントークンサイズの変更 (2026-09)",
          })}
        </Src>
        .
      </p>
    </Section>
  );
}
