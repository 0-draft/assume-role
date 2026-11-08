import { useEffect, useMemo, useState } from "react";
import { Figure, Segmented } from "@/components/ui";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { rich } from "@/lib/rich";
import { SIGNING_DEMOS, TONE_VAR, type ServerNote, type SigningDemo } from "./demos";
import { signRequest, type SigV4Result } from "./sigv4";
import { Wire } from "./Wire";

function Block({ title, note, body }: { title: L; note?: L; body: string }) {
  const { t } = useLang();
  return (
    <div>
      <h4 className="text-sm font-semibold">{t(title)}</h4>
      {note && <p className="mb-1 text-sm text-[var(--muted)]">{rich(t(note))}</p>}
      <pre
        tabIndex={0}
        aria-label={t(title)}
        className="scroll-x rounded-lg border border-[var(--line)] bg-[var(--sunk)] px-3 py-2 font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {body}
      </pre>
    </div>
  );
}

export function ServerNotes({ notes }: { notes: ServerNote[] }) {
  const { t } = useLang();
  return (
    <div className="rounded-xl border border-[var(--line)]">
      <h4 className="border-b border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
        {t({ en: "On the AWS side", ja: "AWS 側で起きること" })}
      </h4>
      <ol className="divide-y divide-[var(--line)]">
        {notes.map((n) => (
          <li key={n.title.en} className="px-4 py-2.5">
            <h5
              className="text-sm font-semibold"
              style={{ color: n.tone ? TONE_VAR[n.tone] : undefined }}
            >
              {t(n.title)}
            </h5>
            <p className="text-sm">{rich(t(n.detail))}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Signs `demo` with the given edits; the result for stale inputs is dropped. */
function useSignature(
  demo: SigningDemo,
  edits: { method: string; path: string; headers: Record<string, string> },
  omitToken: boolean,
): SigV4Result | null {
  const [state, setState] = useState<{ key: string; result: SigV4Result } | null>(null);
  const key = JSON.stringify([demo.id, edits, omitToken]);
  useEffect(() => {
    let cancelled = false;
    const credentials = omitToken
      ? { ...demo.credentials, sessionToken: undefined }
      : demo.credentials;
    void signRequest({ ...demo.request, ...edits }, credentials, demo.options).then(
      (result) => {
        if (!cancelled) setState({ key, result });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [demo, edits, omitToken, key]);
  return state?.key === key ? state.result : null;
}

function Lab({ demo }: { demo: SigningDemo }) {
  const { t } = useLang();
  const pristineEdits = useMemo(
    () => ({
      method: demo.request.method,
      path: demo.request.path,
      headers: demo.request.headers,
    }),
    [demo],
  );
  const [edits, setEdits] = useState(pristineEdits);
  const [omitToken, setOmitToken] = useState(false);
  const pristine = useSignature(demo, pristineEdits, false);
  const live = useSignature(demo, edits, omitToken);
  const hasToken = Boolean(demo.credentials.sessionToken);

  const auth = useMemo<Array<[string, string]>>(
    () => (pristine ? [["Authorization", pristine.authorizationHeader]] : []),
    [pristine],
  );

  if (!pristine || !live) return <div className="min-h-96" aria-busy />;
  const broken = pristine.signature !== live.signature;
  const field =
    "min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-sm";

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <p className="text-sm">{rich(t(demo.blurb))}</p>
        <Wire
          label={t({ en: "Request on the wire", ja: "通信路に流れるリクエスト" })}
          message={demo.wire}
          extraHeaders={auth}
        />
        <ServerNotes notes={demo.serverSide} />
      </div>

      <div className="min-w-0 space-y-4">
        <Block
          title={{
            en: "1. Canonical request",
            ja: "1. 正規リクエスト (canonical request)",
          }}
          note={{
            en: "The string AWS rebuilds from what it received, to check your work.",
            ja: "AWS が受け取ったリクエストから組み立て直して照合する文字列です。",
          }}
          body={live.canonicalRequest}
        />
        <Block
          title={{ en: "2. String to sign", ja: "2. 署名対象文字列 (string to sign)" }}
          note={{
            en: "Algorithm, timestamp, credential scope, and the SHA-256 of the canonical request.",
            ja: "アルゴリズム、タイムスタンプ、credential scope、正規リクエストの SHA-256 です。",
          }}
          body={live.stringToSign}
        />
        <div>
          <h4 className="text-sm font-semibold">
            {t({ en: "3. Signing key derivation", ja: "3. 署名キーの導出" })}
          </h4>
          <p className="mb-1 text-sm text-[var(--muted)]">
            {t({
              en: "Date, Region and service are baked into the key. A leaked signing key works for that day, that Region and that service, and nothing else.",
              ja: "日付・リージョン・サービスがキーに焼き込まれます。署名キーが漏れても、その日・そのリージョン・そのサービスにしか使えません。",
            })}
          </p>
          <ol className="space-y-1">
            {live.derivation.map((s) => (
              <li
                key={s.label}
                className="rounded-lg border border-[var(--line)] bg-[var(--sunk)] px-3 py-1.5 font-mono text-[0.76rem] [overflow-wrap:anywhere]"
              >
                <span className="block text-[var(--idp)]">{s.label}</span>
                <span className="text-[var(--muted)]">{s.keyHex}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="text-sm font-semibold">
            {t({ en: "4. Signature", ja: "4. 署名" })}
          </h4>
          <output
            aria-live="polite"
            className="mt-1 block rounded-lg border-2 px-3 py-2 font-mono text-[0.78rem] [overflow-wrap:anywhere]"
            style={{
              borderColor: broken ? "var(--deny)" : "var(--resource)",
              color: broken ? "var(--deny)" : "var(--resource)",
            }}
          >
            {live.signature}
            <span className="mt-1 block font-sans text-sm font-semibold">
              {broken
                ? t({
                    en: "✗ SignatureDoesNotMatch: AWS would reject this",
                    ja: "✗ SignatureDoesNotMatch: AWS はこれを拒否します",
                  })
                : t({ en: "✓ Matches the original", ja: "✓ 元の署名と一致" })}
            </span>
          </output>
        </div>

        <fieldset className="rounded-xl border border-dashed border-[var(--line)] p-3">
          <legend className="px-1 text-sm font-semibold text-[var(--deny)]">
            {t({ en: "Break it", ja: "壊してみる" })}
          </legend>
          <p className="mb-2 text-sm text-[var(--muted)]">
            {t({
              en: "Edit anything. The signature is recomputed on every keystroke; AWS would reject every value that differs from the original.",
              ja: "どれでも書き換えてください。署名は入力のたびに再計算されます。元と違う値はすべて AWS に拒否されます。",
            })}
          </p>
          <div className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
            <label htmlFor={`${demo.id}-method`} className="font-mono text-xs">
              method
            </label>
            <input
              id={`${demo.id}-method`}
              value={edits.method}
              onChange={(e) => setEdits({ ...edits, method: e.target.value })}
              className={field}
            />
            <label htmlFor={`${demo.id}-path`} className="font-mono text-xs">
              path
            </label>
            <input
              id={`${demo.id}-path`}
              value={edits.path}
              onChange={(e) => setEdits({ ...edits, path: e.target.value })}
              className={field}
            />
            {Object.entries(edits.headers).map(([name, value]) => (
              <div key={name} className="contents">
                <label
                  htmlFor={`${demo.id}-${name}`}
                  className="font-mono text-xs break-all"
                >
                  {name}
                </label>
                <input
                  id={`${demo.id}-${name}`}
                  value={value}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      headers: { ...edits.headers, [name]: e.target.value },
                    })
                  }
                  className={field}
                />
              </div>
            ))}
          </div>
          {hasToken && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={omitToken}
                onChange={(e) => setOmitToken(e.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                <span className="font-semibold">
                  {t({
                    en: "Leave x-amz-security-token out of SignedHeaders",
                    ja: "SignedHeaders から x-amz-security-token を外す",
                  })}
                </span>
                <span className="block text-[var(--muted)]">
                  {t({
                    en: "The most common cause of SignatureDoesNotMatch when hand-rolling SigV4 with temporary credentials.",
                    ja: "一時認証情報で SigV4 を手書きしたときに SignatureDoesNotMatch が出る、いちばんよくある原因です。",
                  })}
                </span>
              </span>
            </label>
          )}
          {(broken || omitToken) && (
            <button
              type="button"
              onClick={() => {
                setEdits(pristineEdits);
                setOmitToken(false);
              }}
              className="mt-3 min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold"
            >
              {t({ en: "Reset", ja: "元に戻す" })}
            </button>
          )}
        </fieldset>
      </div>
    </div>
  );
}

/** Live SigV4: pick a request, read every intermediate value, then break it. */
export function SignatureLab() {
  const [id, setId] = useState(SIGNING_DEMOS[0].id);
  const demo = SIGNING_DEMOS.find((d) => d.id === id) ?? SIGNING_DEMOS[0];
  return (
    <Figure
      title={{
        en: "A signature, computed in this tab",
        ja: "このタブの中で署名を計算する",
      }}
      hint={{
        en: "WebCrypto runs the same HMAC chain AWS runs. Nothing is sent anywhere, and every key is AWS's published example value.",
        ja: "AWS と同じ HMAC の連鎖を WebCrypto がこのタブ内で回しています。どこにも送信しません。キーはすべて AWS が公開しているサンプル値です。",
      }}
    >
      <Segmented
        label={{ en: "Which request", ja: "どのリクエストか" }}
        value={id}
        onChange={setId}
        options={SIGNING_DEMOS.map((d) => ({ value: d.id, label: d.label }))}
      />
      {/* Keyed so the edit fields start from the chosen request. */}
      <Lab key={demo.id} demo={demo} />
    </Figure>
  );
}
