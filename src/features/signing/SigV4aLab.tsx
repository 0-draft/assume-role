import { useEffect, useState } from "react";
import { Figure, Segmented } from "@/components/ui";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { DATETIME } from "./demos";
import { signSigV4a, verifySigV4a, type SigV4aResult } from "./sigv4a";

const CREDS = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

const REGION_SETS = ["us-east-1", "us-east-1,us-west-2", "us-west-*", "*"] as const;
type RegionSet = (typeof REGION_SETS)[number];
const SIGNED = "host;x-amz-date;x-amz-region-set";

function sigV4aCanonicalRequest(regionSet: string): string {
  return [
    "GET",
    "/key.txt",
    "",
    "host:my-bucket.accesspoint.s3-global.amazonaws.com",
    `x-amz-date:${DATETIME}`,
    `x-amz-region-set:${regionSet}`,
    "",
    SIGNED,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  ].join("\n");
}

export function SigV4aLab() {
  const { t } = useLang();
  const [set, setSet] = useState<RegionSet>("us-east-1,us-west-2");
  const [state, setState] = useState<{ set: RegionSet; r: SigV4aResult } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void signSigV4a(sigV4aCanonicalRequest(set), CREDS, SIGNED, {
      service: "s3",
      datetime: DATETIME,
      regionSet: set.split(","),
    }).then((r) => {
      if (!cancelled) setState({ set, r });
    });
    return () => {
      cancelled = true;
    };
  }, [set]);

  const r = state?.set === set ? state.r : null;
  const ok = r
    ? verifySigV4a(r.signature, r.stringToSign, r.keyPair.publicKeyHex)
    : false;
  const pre =
    "scroll-x rounded-lg border border-[var(--line)] bg-[var(--sunk)] px-3 py-2 font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]";

  return (
    <Figure
      title={{
        en: "One signature, several Regions (SigV4a)",
        ja: "1 つの署名を複数リージョンで (SigV4a)",
      }}
      hint={{
        en: "The keypair is derived from the same secret access key, and the Region moves out of the scope into a signed header. Derived and signed here.",
        ja: "鍵ペアは同じシークレットアクセスキーから導出します。リージョンは scope から出て、署名対象のヘッダーに移ります。ここで導出して署名しています。",
      }}
    >
      <Segmented
        label={{
          en: "Valid in (X-Amz-Region-Set)",
          ja: "有効なリージョン (X-Amz-Region-Set)",
        }}
        value={set}
        onChange={setSet}
        options={REGION_SETS.map((s) => ({ value: s, label: { en: s, ja: s } }))}
      />
      {r ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div>
              <h4 className="text-sm font-semibold">Credential scope</h4>
              <pre tabIndex={0} aria-label="credential scope" className={pre}>
                {r.credentialScope}
              </pre>
              <p className="mt-1 text-sm">
                {rich(
                  t({
                    en: "No Region. SigV4 would read `20260919/us-east-1/s3/aws4_request` here; SigV4a states the Regions in the `X-Amz-Region-Set` header instead, which is itself signed.",
                    ja: "リージョンがありません。SigV4 ならここは `20260919/us-east-1/s3/aws4_request` になります。SigV4a ではリージョンを `X-Amz-Region-Set` ヘッダーで示し、そのヘッダー自体が署名対象になります。",
                  }),
                )}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">
                {t({ en: "Derived keypair (P-256)", ja: "導出された鍵ペア (P-256)" })}
              </h4>
              <pre tabIndex={0} aria-label="derived keypair" className={pre}>
                {`private  ${r.keyPair.privateKeyHex}\npublic   ${r.keyPair.publicKeyHex}\ncounter  ${r.keyPair.counter}`}
              </pre>
              <p className="mt-1 text-sm">
                {t({
                  en: "The secret key is run through a counter-mode KDF until the result lands inside the P-256 group order. A 256-bit value can exceed the order, so the counter is not decorative, though in practice the first candidate works. No new credential is issued: AWS derives the same public key on its side when it checks a signature.",
                  ja: "シークレットキーを counter モードの KDF に通し、結果が P-256 の位数に収まるまで繰り返します。256 ビットの値は位数を超えることがあるので counter は飾りではありませんが、実際には最初の候補で通ります。新しい認証情報は発行されません。AWS は署名を検証するとき、自分の側で同じ公開鍵を導出します。",
                })}
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <h4 className="text-sm font-semibold">String to sign</h4>
              <pre tabIndex={0} aria-label="string to sign" className={pre}>
                {r.stringToSign}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold">
                {t({ en: "Signature (DER, hex)", ja: "署名 (DER, hex)" })}
              </h4>
              <output
                className="mt-1 block rounded-lg border-2 px-3 py-2 font-mono text-[0.78rem] [overflow-wrap:anywhere]"
                style={{
                  borderColor: ok ? "var(--resource)" : "var(--deny)",
                  color: ok ? "var(--resource)" : "var(--deny)",
                }}
              >
                {r.signature}
                <span className="mt-1 block font-sans text-sm font-semibold">
                  {ok
                    ? t({
                        en: "✓ Verifies against the public key alone",
                        ja: "✓ 公開鍵だけで検証が通る",
                      })
                    : t({ en: "✗ Does not verify", ja: "✗ 検証が通らない" })}
                </span>
              </output>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {t({
                  en: "Reproducible here because this implementation uses the RFC 6979 deterministic nonce. A signer that uses a random nonce, which ECDSA allows, gives different bytes for the same request, and they verify just as well.",
                  ja: "この実装は RFC 6979 の決定的 nonce を使うので、毎回同じ結果になります。ECDSA は乱数の nonce も許すので、そういう署名処理なら同じリクエストでも毎回バイト列が変わり、それでも同じように検証が通ります。",
                })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-72" aria-busy />
      )}
    </Figure>
  );
}
