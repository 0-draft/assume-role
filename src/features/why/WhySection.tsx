import { useState } from "react";
import { useLang } from "@/i18n/useLang";
import { Callout, Code, Figure, P, Section, Src } from "@/components/ui";
import { chapter } from "@/data/nav";
import { exposureHours, LIFETIMES } from "./exposure";

export function WhySection() {
  const { t } = useLang();
  return (
    <Section
      id="why"
      index={chapter("why")}
      title={{ en: "Why temporary credentials exist", ja: "なぜ一時認証情報なのか" }}
      lede={{
        en: "A long-term access key works until someone deletes it. A key from STS stops working on its own. That one difference is the reason STS sits underneath almost every way into AWS.",
        ja: "長期アクセスキーは誰かが消すまで使えます。STS のキーは放っておけば勝手に失効します。この違いひとつが、AWS へのほぼすべての入口の下に STS がいる理由です。",
      }}
    >
      <Anatomy />
      <LeakWindow />
      <P>
        {{
          en: "The extra piece is the session token. When you sign a request with temporary keys, the token rides along in the `X-Amz-Security-Token` header. AWS checks the SigV4 signature against the secret, then reads the token to find out which session, which policies and which expiry apply.",
          ja: "違いはセッショントークンです。一時キーでリクエストに署名すると、トークンが `X-Amz-Security-Token` ヘッダーに乗って一緒に届きます。AWS はシークレットで SigV4 署名を検証し、トークンからどのセッションか、どのポリシーと有効期限が効くかを読み取ります。",
        }}
      </P>
      <Code
        label={t({
          en: "A request signed with STS credentials",
          ja: "STS の認証情報で署名したリクエスト",
        })}
      >
        {`POST / HTTP/1.1
Host: sts.ap-northeast-1.amazonaws.com
Content-Type: application/x-www-form-urlencoded; charset=utf-8
X-Amz-Date: 20261010T090000Z
X-Amz-Security-Token: AQoEXAMPLEH4aoAH0gNCAPy...
Authorization: AWS4-HMAC-SHA256 Credential=ASIAQEXAMPLEDEVKEY01/20261010/ap-northeast-1/sts/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-security-token, Signature=...

Action=GetCallerIdentity&Version=2011-06-15`}
      </Code>
      <Callout kind="note">
        {{
          en: "STS still speaks the 2011 Query protocol: form-encoded `Action=...&Version=2011-06-15` in, XML out. SDKs hide this, but you will see it in CloudTrail and in `--debug` output.",
          ja: "STS は今も 2011 年版の Query プロトコルです。リクエストはフォームエンコードの `Action=...&Version=2011-06-15`、レスポンスは XML。SDK が隠してくれますが、CloudTrail や `--debug` の出力で目にします。",
        }}
      </Callout>
      <p className="prose-col text-sm text-[var(--muted)]">
        {t({
          en: "How the signature itself is computed is drawn step by step in the sibling project ",
          ja: "署名そのものの計算は、姉妹プロジェクト ",
        })}
        <Src href="https://0-draft.github.io/caller-identity/">caller-identity</Src>
        {t({ en: ".", ja: " で一歩ずつ図解しています。" })}
      </p>
    </Section>
  );
}

function Anatomy() {
  const { t } = useLang();
  const parts = [
    {
      k: "AccessKeyId",
      long: "AKIAIOSFODNN7EXAMPLE",
      temp: "ASIAQEXAMPLEDEVKEY01",
      note: {
        en: "AKIA means long-term, ASIA means it came from STS.",
        ja: "AKIA は長期キー、ASIA は STS 発行の印。",
      },
    },
    {
      k: "SecretAccessKey",
      long: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      temp: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      note: {
        en: "Signs requests. Never sent over the wire.",
        ja: "署名に使う。通信路には流れない。",
      },
    },
    {
      k: "SessionToken",
      long: null,
      temp: "AQoEXAMPLEH4aoAH0gNCAPy…",
      note: {
        en: "Only temporary credentials have one. Up to 4,096 bytes since Sept 2026.",
        ja: "一時認証情報にだけある。2026 年 9 月から上限 4,096 バイト。",
      },
    },
    {
      k: "Expiration",
      long: null,
      temp: "2026-10-10T10:00:00Z",
      note: {
        en: "15 minutes to 36 hours depending on the API.",
        ja: "API によって 15 分から 36 時間。",
      },
    },
  ];
  return (
    <Figure
      title={{ en: "Two kinds of keys, side by side", ja: "2 種類のキーを並べる" }}
      hint={{
        en: "Same signing algorithm, two extra fields.",
        ja: "署名の仕組みは同じ。違うのは 2 つの追加フィールド。",
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {(["long", "temp"] as const).map((kind) => (
          <div
            key={kind}
            className={`rounded-xl border p-4 ${kind === "temp" ? "guilloche border-[var(--sts)]" : "border-[var(--line)] bg-[var(--sunk)]"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-bold">
                {kind === "long"
                  ? t({ en: "Long-term access key", ja: "長期アクセスキー" })
                  : t({ en: "STS temporary credentials", ja: "STS の一時認証情報" })}
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: kind === "temp" ? "var(--sts)" : "var(--deny)" }}
              >
                {kind === "long"
                  ? t({ en: "valid until deleted", ja: "削除するまで有効" })
                  : t({ en: "expires by itself", ja: "自動で失効" })}
              </span>
            </div>
            <dl className="mt-3 space-y-2">
              {parts.map((p) => {
                const v = p[kind];
                return (
                  <div key={p.k} className={v ? "" : "opacity-40"}>
                    <dt className="font-mono text-[0.7rem] text-[var(--muted)]">{p.k}</dt>
                    <dd className="font-mono text-[0.8rem] break-all">
                      {v ?? t({ en: "(none)", ja: "(なし)" })}
                    </dd>
                    {kind === "temp" && (
                      <dd className="text-[0.78rem] text-[var(--muted)]">{t(p.note)}</dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </Figure>
  );
}

function LeakWindow() {
  const { t } = useLang();
  const [noticed, setNoticed] = useState(72);
  const axis = 24 * 30;
  return (
    <Figure
      title={{
        en: "How long does a leaked key stay useful?",
        ja: "漏れたキーはいつまで使える?",
      }}
      hint={{
        en: "Drag the slider to set how long it takes your team to notice and revoke a leaked key.",
        ja: "スライダーで、漏えいに気づいて無効化するまでの時間を変えてみてください。",
      }}
    >
      <label className="block text-sm font-semibold">
        {t({ en: "Time until someone notices", ja: "気づくまでの時間" })}:{" "}
        <span className="font-mono text-[var(--deny)]">
          {noticed < 48
            ? `${noticed} h`
            : `${Math.round(noticed / 24)} ${t({ en: "days", ja: "日" })}`}
        </span>
        <input
          type="range"
          min={1}
          max={axis}
          value={noticed}
          onChange={(e) => setNoticed(Number(e.target.value))}
          className="mt-2 block w-full accent-[var(--deny)]"
        />
      </label>
      <div className="mt-5 space-y-3">
        {LIFETIMES.map((l) => {
          const h = exposureHours(l.hours, noticed);
          return (
            <div
              key={l.id}
              className="grid gap-1 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-3"
            >
              <div className="text-sm">
                <span className="font-semibold">{t(l.label)}</span>
                <span className="ml-2 font-mono text-xs text-[var(--muted)]">
                  {h < 1
                    ? `${Math.round(h * 60)} min`
                    : h < 48
                      ? `${+h.toFixed(1)} h`
                      : `${Math.round(h / 24)} d`}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-[var(--sunk)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.max(0.6, (h / axis) * 100)}%`,
                    background: l.hours === null ? "var(--deny)" : "var(--sts)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">
        {t({
          en: "Bars show the hours an attacker could use the key, on a 30-day axis. A stolen STS key also stops at its expiry even if nobody ever notices.",
          ja: "バーは攻撃者がキーを使える時間 (30 日軸)。STS のキーは、誰も気づかなくても有効期限で止まります。",
        })}
      </p>
    </Figure>
  );
}
