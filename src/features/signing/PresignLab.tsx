import { useEffect, useState } from "react";
import { Figure, Segmented } from "@/components/ui";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { DATETIME, DEMO_SECRET, TEMP_KEY } from "./demos";
import { presignUrl, type PresignResult } from "./sigv4";

const CREDS = {
  accessKeyId: TEMP_KEY,
  secretAccessKey: DEMO_SECRET,
  sessionToken: "IQoJb3JpZ2luX2VjEBYaCXVzLWVhc3QtMSJHMEUCIQDEXAMPLE",
};

/** Seconds; 604800 (seven days) is the S3 ceiling. */
const EXPIRY_CHOICES = ["60", "300", "900", "86400", "604800"] as const;
type Expiry = (typeof EXPIRY_CHOICES)[number];

function expiryLabel(seconds: number): L {
  if (seconds >= 86400) {
    const d = seconds / 86400;
    return { en: `${d} day${d > 1 ? "s" : ""}`, ja: `${d} 日` };
  }
  if (seconds >= 60) return { en: `${seconds / 60} min`, ja: `${seconds / 60} 分` };
  return { en: `${seconds} s`, ja: `${seconds} 秒` };
}

export function PresignLab() {
  const { t } = useLang();
  const [expiry, setExpiry] = useState<Expiry>("900");
  const [result, setResult] = useState<{ expiry: Expiry; r: PresignResult } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void presignUrl(
      {
        method: "GET",
        path: "/key.txt",
        headers: { host: "my-bucket.s3.us-east-1.amazonaws.com" },
      },
      CREDS,
      {
        region: "us-east-1",
        service: "s3",
        datetime: DATETIME,
        expiresIn: Number(expiry),
        doubleEncodePath: false,
      },
    ).then((r) => {
      if (!cancelled) setResult({ expiry, r });
    });
    return () => {
      cancelled = true;
    };
  }, [expiry]);

  const r = result?.expiry === expiry ? result.r : null;
  const pre =
    "scroll-x rounded-lg border border-[var(--line)] bg-[var(--sunk)] px-3 py-2 font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]";

  return (
    <Figure
      title={{ en: "Sign it into a URL instead", ja: "ヘッダーではなく URL に署名する" }}
      hint={{
        en: "The same canonical request, with the auth parameters moved into the query string. Computed live.",
        ja: "正規リクエストは同じで、認証パラメータをクエリ文字列に移しただけです。その場で計算しています。",
      }}
    >
      <Segmented
        label={{ en: "Valid for (X-Amz-Expires)", ja: "有効期間 (X-Amz-Expires)" }}
        value={expiry}
        onChange={setExpiry}
        options={EXPIRY_CHOICES.map((s) => ({ value: s, label: expiryLabel(Number(s)) }))}
      />
      {expiry === "604800" && (
        <p className="mt-2 text-sm text-[var(--deny)]">
          {t({
            en: "604800 seconds is seven days, the ceiling S3 allows, because the signing key itself is only valid that long.",
            ja: "604800 秒は 7 日で、S3 が認める上限です。署名キー自体がその期間しか有効でないためです。",
          })}
        </p>
      )}
      {r ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold">
              {t({ en: "The URL", ja: "できた URL" })}
            </h4>
            <pre tabIndex={0} aria-label="presigned URL" className={pre}>
              {r.url.replace(/&/g, "\n  &")}
            </pre>
            <p className="text-sm">
              {t({
                en: "Nothing else is needed to use it: no header, no SDK, no key. Whoever holds this string is the caller until it expires, which is why a presigned URL in a log or a chat message is a credential leak.",
                ja: "使うのに他は何も要りません。ヘッダーも SDK もキーも不要です。この文字列を持っている人が期限まで呼び出し元になります。ログやチャットに貼られた presigned URL がそのまま認証情報の漏洩になるのはそのためです。",
              })}
            </p>
          </div>
          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold">
              {t({ en: "Canonical request", ja: "正規リクエスト" })}
            </h4>
            <pre tabIndex={0} aria-label="canonical request" className={pre}>
              {r.canonicalRequest}
            </pre>
            <p className="text-sm">
              {rich(
                t({
                  en: "The last line is the literal `UNSIGNED-PAYLOAD`, because at signing time nobody knows what will be uploaded. A presigned PUT therefore pins the destination, not the bytes.",
                  ja: "最終行は文字列 `UNSIGNED-PAYLOAD` そのものです。署名の時点では何がアップロードされるか分からないからです。つまり presigned な PUT が保証するのは宛先であって、中身ではありません。",
                }),
              )}
            </p>
            <p className="text-sm">
              {rich(
                t({
                  en: "With temporary credentials the session token goes into the query string as `X-Amz-Security-Token` and is signed there, not as a header.",
                  ja: "一時認証情報の場合、セッショントークンはヘッダーではなくクエリ文字列の `X-Amz-Security-Token` に入り、そこで署名対象になります。",
                }),
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-72" aria-busy />
      )}
    </Figure>
  );
}
