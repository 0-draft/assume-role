import { useId, useRef, useState } from "react";
import { Callout, Figure, Section, Segmented, Src, ActorTag } from "@/components/ui";
import { Sequence } from "@/components/ui/Sequence";
import { chapter } from "@/data/nav";
import { useLang } from "@/i18n/useLang";
import { useNarrow } from "@/hooks/useNarrow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { L } from "@/i18n/lang";
import { CALLER_LABEL, GROUPS, PATHS, SIGNED_LABEL, type PathDef } from "./paths";
import {
  PROVIDER_LABEL,
  SDK_LABEL,
  resolve,
  type ProfileKind,
  type Sdk,
  type Sources,
} from "./chain";

export function PathsSection() {
  return (
    <Section
      id="paths"
      index={chapter("paths")}
      title={{
        en: "Who actually calls STS for you",
        ja: "STS を呼んでいるのは誰か",
      }}
      lede={{
        en: "Most temporary credentials you use came from an STS call you never wrote. Pick a path to watch who asks, who answers and where the keys end up.",
        ja: "普段使っている一時認証情報の大半は、自分では書いていない STS 呼び出しから来ています。経路を選ぶと、誰が頼み、誰が応え、キーがどこに置かれるかを順に追えます。",
      }}
    >
      <PathExplorer />
      <div className="grid gap-4 lg:grid-cols-2">
        <Callout kind="note">
          {{
            en: "**IMDSv2 hop limit.** The token PUT response only survives `HttpPutResponseHopLimit` IP hops. With 1, containers on a bridged network cannot reach the instance role; use 2 only if containers are meant to use it.",
            ja: "**IMDSv2 のホップ上限です。** トークンを取る PUT の応答は `HttpPutResponseHopLimit` 分の IP ホップしか届きません。1 ならブリッジネットワークのコンテナからインスタンスロールに届きません。コンテナにも使わせたいときだけ 2 にします。",
          }}
        </Callout>
        <Callout kind="note">
          {{
            en: "**Pod Identity is not STS from the pod.** The pod talks to a node-local agent, the agent calls `eks-auth:AssumeRoleForPodIdentity`, and EKS calls `AssumeRole`. IRSA is the one where the pod calls STS itself.",
            ja: "**Pod Identity は Pod から STS を呼びません。** Pod はノード上のエージェントと話し、エージェントが `eks-auth:AssumeRoleForPodIdentity` を呼び、EKS が `AssumeRole` を呼びます。Pod 自身が STS を呼ぶのは IRSA のほうです。",
          }}
        </Callout>
        <Callout kind="note">
          {{
            en: "**Identity Center is SAML underneath.** Each assignment is an `AWSReservedSSO_*` role trusting a SAML provider `AWSSSO_*_DO_NOT_DELETE`, and console sign-ins show up in CloudTrail as `AssumeRoleWithSAML`.",
            ja: "**Identity Center の中身は SAML です。** 割り当てごとに `AWSSSO_*_DO_NOT_DELETE` という SAML プロバイダを信頼する `AWSReservedSSO_*` ロールがあり、コンソールへのサインインは CloudTrail に `AssumeRoleWithSAML` として残ります。",
          }}
        </Callout>
        <Callout kind="new">
          {{
            en: "**GitHub changed its sub claims.** Repositories created, renamed or transferred after 2026-07-15 send `repo:org@<org_id>/repo@<repo_id>:…`. A trust policy matching only `repo:org/repo:…` stops working for them; list both forms.",
            ja: "**GitHub の sub クレームの形式が変わりました。** 2026-07-15 以降に作成・リネーム・移管されたリポジトリは `repo:org@<org_id>/repo@<repo_id>:…` を送ります。`repo:org/repo:…` だけに一致させた信頼ポリシーは通らなくなるので、両方の形を並べておきます。",
          }}
        </Callout>
      </div>
      <WhoCallsMatrix />
      <ChainLab />
    </Section>
  );
}

function PathExplorer() {
  const { t } = useLang();
  const name = useId();
  const [id, setId] = useState(PATHS[0].id);
  const path = PATHS.find((p) => p.id === id) ?? PATHS[0];
  const narrow = useNarrow();
  const reduced = useReducedMotion();
  const detail = useRef<HTMLDivElement>(null);
  // On phones the picker is a screen tall; bring the diagram into view.
  const pick = (next: string) => {
    setId(next);
    if (narrow)
      requestAnimationFrame(() =>
        detail.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }),
      );
  };

  return (
    <Figure
      title={{ en: "Pick a credential path", ja: "認証情報の経路を選ぶ" }}
      hint={{
        en: "Then step through it with Next or the arrow keys. Colours: who uses the keys, who vouches for identity, the AWS side that delivers them, STS, and the API you call.",
        ja: "選んだら「次へ」か矢印キーで 1 ステップずつ進めてください。色はそれぞれ、キーを使う側・身元を保証する側・キーを届ける AWS 側・STS・最終的に呼ぶ API を表します。",
      }}
    >
      <div className="mb-4 flex flex-wrap gap-2" aria-hidden>
        <ActorTag actor="caller">
          {t({ en: "Uses the keys", ja: "キーを使う側" })}
        </ActorTag>
        <ActorTag actor="idp">
          {t({ en: "Vouches for identity", ja: "身元を保証する側" })}
        </ActorTag>
        <ActorTag actor="role">
          {t({ en: "AWS side that delivers", ja: "届ける AWS 側" })}
        </ActorTag>
        <ActorTag actor="sts">STS</ActorTag>
        <ActorTag actor="resource">
          {t({ en: "Where you call", ja: "呼び出し先" })}
        </ActorTag>
      </div>

      {narrow ? (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--muted)]">
            {t({ en: "Credential path", ja: "認証情報の経路" })}
          </span>
          <select
            value={id}
            onChange={(e) => pick(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-base font-semibold"
          >
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={t(g.label)}>
                {PATHS.filter((p) => p.group === g.id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((g) => (
            <fieldset key={g.id} className="min-w-0">
              <legend className="mb-2 text-sm font-semibold text-[var(--muted)]">
                {t(g.label)}
              </legend>
              <div className="flex flex-col gap-1.5">
                {PATHS.filter((p) => p.group === g.id).map((p) => {
                  const on = p.id === id;
                  return (
                    <label
                      key={p.id}
                      className="flex min-h-10 cursor-pointer items-center rounded-lg border px-3 py-1.5 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--sts)]"
                      style={{
                        borderColor: on ? "var(--sts)" : "var(--line)",
                        background: on
                          ? "color-mix(in oklab, var(--sts) 14%, var(--surface))"
                          : "var(--surface)",
                        color: on ? "var(--ink)" : "var(--muted)",
                      }}
                    >
                      <input
                        type="radio"
                        name={name}
                        value={p.id}
                        checked={on}
                        onChange={() => pick(p.id)}
                        className="sr-only"
                      />
                      {t(p.name)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div ref={detail} className="mt-6 scroll-mt-20 border-t border-[var(--line)] pt-6">
        <h3 className="text-2xl font-bold">{t(path.name)}</h3>
        <p className="prose-col mt-1 text-[var(--muted)]">{t(path.blurb)}</p>
        <PassStrip path={path} />
        <div className="mt-6">
          <Sequence
            key={path.id}
            lanes={path.lanes}
            steps={path.steps}
            ariaLabel={{
              en: `Sequence diagram: ${path.name.en}`,
              ja: `シーケンス図: ${path.name.ja}`,
            }}
          />
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {t({ en: "Source: ", ja: "出典: " })}
          <Src href={path.source.href}>{path.source.label}</Src>
        </p>
      </div>
    </Figure>
  );
}

/** The path summarised as a printed pass: what you'd want on one line. */
function PassStrip({ path }: { path: PathDef }) {
  const { t } = useLang();
  const cells: { k: L; v: string; mono?: boolean }[] = [
    { k: { en: "STS operation", ja: "STS の操作" }, v: path.stsApi, mono: true },
    ...(path.frontDoor
      ? [
          {
            k: { en: "You talk to", ja: "やり取りする相手" },
            v: path.frontDoor,
            mono: true,
          },
        ]
      : []),
    {
      k: { en: "Who calls STS", ja: "STS を呼ぶのは" },
      v: t(CALLER_LABEL[path.stsCaller]),
    },
    { k: { en: "Request", ja: "リクエスト" }, v: t(SIGNED_LABEL[path.signed]) },
    { k: { en: "Endpoint", ja: "エンドポイント" }, v: path.endpoint, mono: true },
    { k: { en: "Lifetime", ja: "有効期間" }, v: t(path.duration) },
    { k: { en: "Keys live in", ja: "キーの置き場所" }, v: t(path.delivery) },
    { k: { en: "Refresh", ja: "更新" }, v: t(path.refresh) },
  ];
  return (
    <div className="guilloche mt-4 flex overflow-hidden rounded-xl border border-[var(--line)]">
      <dl className="grid flex-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.k.en} className="min-w-0">
            <dt className="text-xs font-semibold text-[var(--muted)]">{t(c.k)}</dt>
            <dd
              className={`text-sm leading-snug font-semibold break-words ${c.mono ? "font-mono text-[0.8rem]" : ""}`}
            >
              {c.v}
            </dd>
          </div>
        ))}
      </dl>
      <div aria-hidden className="perforated hidden w-4 sm:block" />
      <div
        aria-hidden
        className="hidden w-16 shrink-0 items-center justify-center bg-[var(--sts)] sm:flex"
      >
        <span className="font-display rotate-90 text-sm font-bold whitespace-nowrap text-[var(--on-color)]">
          {path.stsCaller === "you"
            ? t({ en: "you call STS", ja: "自分で呼ぶ" })
            : t({ en: "called for you", ja: "AWS が代わりに呼ぶ" })}
        </span>
      </div>
    </div>
  );
}

function WhoCallsMatrix() {
  const { t } = useLang();
  const narrow = useNarrow();
  const callerTag = (p: (typeof PATHS)[number]) => (
    <span
      className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap"
      style={{ color: p.stsCaller === "you" ? "var(--caller)" : "var(--role)" }}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: p.stsCaller === "you" ? "var(--caller)" : "var(--role)" }}
      />
      {t(CALLER_LABEL[p.stsCaller])}
    </span>
  );
  // Five columns do not fit a phone; each path becomes a small slip instead.
  if (narrow)
    return (
      <Figure
        title={{
          en: "Who calls STS, path by path",
          ja: "経路ごとの「STS を呼ぶのは誰か」",
        }}
        hint={{
          en: "When an AWS service calls STS for you, your code never sees the call; it only sees where the keys were left.",
          ja: "AWS のサービスが代わりに呼ぶ経路では、あなたのコードから STS 呼び出しは見えません。見えるのはキーが置かれた場所だけです。",
        }}
      >
        <ul className="space-y-2">
          {PATHS.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-l-4 border-[var(--line)] px-3 py-2 text-sm"
              style={{
                borderLeftColor: p.stsCaller === "you" ? "var(--caller)" : "var(--role)",
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">{t(p.name)}</span>
                {callerTag(p)}
              </div>
              <div className="mt-1 font-mono text-[0.76rem] text-[var(--muted)]">
                {p.stsApi}
              </div>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[0.8rem]">
                <dt className="text-[var(--muted)]">
                  {t({ en: "Keys", ja: "置き場所" })}
                </dt>
                <dd>{t(p.delivery)}</dd>
                <dt className="text-[var(--muted)]">
                  {t({ en: "Lifetime", ja: "有効期間" })}
                </dt>
                <dd>{t(p.duration)}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </Figure>
    );
  return (
    <Figure
      title={{
        en: "Who calls STS, path by path",
        ja: "経路ごとの「STS を呼ぶのは誰か」",
      }}
      hint={{
        en: "When an AWS service calls STS for you, your code never sees the call; it only sees where the keys were left.",
        ja: "AWS のサービスが代わりに呼ぶ経路では、あなたのコードから STS 呼び出しは見えません。見えるのはキーが置かれた場所だけです。",
      }}
    >
      <div tabIndex={0} className="scroll-x">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--line)] text-[var(--muted)]">
              <th scope="col" className="py-2 pr-3 font-semibold">
                {t({ en: "Path", ja: "経路" })}
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                {t({ en: "Who calls STS", ja: "STS を呼ぶのは" })}
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                {t({ en: "STS operation", ja: "STS の操作" })}
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                {t({ en: "Keys live in", ja: "キーの置き場所" })}
              </th>
              <th scope="col" className="py-2 font-semibold">
                {t({ en: "Lifetime", ja: "有効期間" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {PATHS.map((p) => (
              <tr key={p.id} className="border-b border-[var(--line)] align-top">
                <th scope="row" className="min-w-44 py-2 pr-3 font-semibold">
                  {t(p.name)}
                </th>
                <td className="min-w-32 py-2 pr-3">
                  <span
                    className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap"
                    style={{
                      color: p.stsCaller === "you" ? "var(--caller)" : "var(--role)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        background:
                          p.stsCaller === "you" ? "var(--caller)" : "var(--role)",
                      }}
                    />
                    {t(CALLER_LABEL[p.stsCaller])}
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono text-[0.78rem]">{p.stsApi}</td>
                <td className="py-2 pr-3">{t(p.delivery)}</td>
                <td className="py-2">{t(p.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Figure>
  );
}

const TOGGLES: { key: Exclude<keyof Sources, "profile">; label: L; hint: string }[] = [
  {
    key: "envKeys",
    label: { en: "Access keys in env", ja: "環境変数にアクセスキー" },
    hint: "AWS_ACCESS_KEY_ID",
  },
  {
    key: "webIdentity",
    label: { en: "Web identity env", ja: "Web ID の環境変数" },
    hint: "AWS_WEB_IDENTITY_TOKEN_FILE",
  },
  {
    key: "container",
    label: { en: "Container credentials URI", ja: "コンテナ認証情報の URI" },
    hint: "AWS_CONTAINER_CREDENTIALS_*_URI",
  },
  {
    key: "imds",
    label: { en: "Running on EC2 (IMDS)", ja: "EC2 上で実行 (IMDS)" },
    hint: "169.254.169.254",
  },
];

function ChainLab() {
  const { t } = useLang();
  const [sdk, setSdk] = useState<Sdk>("cli");
  const [s, setS] = useState<Sources>({
    envKeys: false,
    webIdentity: true,
    profile: "none",
    container: true,
    imds: true,
  });
  const r = resolve(sdk, s);

  return (
    <Figure
      title={{
        en: "Which credentials does the SDK pick?",
        ja: "SDK はどの認証情報を拾うか",
      }}
      hint={{
        en: "Each SDK walks a fixed list and stops at the first source that has credentials. Turn sources on and off to see what wins and what gets shadowed.",
        ja: "SDK は決まった順番で探し、最初に見つかった認証情報で止まります。ソースを切り替えて、どれが勝ちどれが隠れるかを見てください。",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-5">
          <Segmented
            label={{ en: "SDK or tool", ja: "SDK / ツール" }}
            value={sdk}
            onChange={setSdk}
            options={(Object.keys(SDK_LABEL) as Sdk[]).map((k) => ({
              value: k,
              label: { en: SDK_LABEL[k], ja: SDK_LABEL[k] },
            }))}
          />
          <Segmented<ProfileKind>
            label={{ en: "Active profile contains", ja: "使うプロファイルの中身" }}
            value={s.profile}
            onChange={(profile) => setS({ ...s, profile })}
            options={[
              { value: "none", label: { en: "Nothing", ja: "なし" } },
              { value: "static", label: { en: "Static keys", ja: "静的キー" } },
              { value: "role", label: { en: "role_arn", ja: "role_arn" } },
              { value: "sso", label: { en: "SSO", ja: "SSO" } },
            ]}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-[var(--muted)]">
              {t({ en: "Also present", ja: "ほかにあるもの" })}
            </legend>
            <div className="space-y-1.5">
              {TOGGLES.map((tg) => (
                <label
                  key={tg.key}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={s[tg.key]}
                    onChange={(e) => setS({ ...s, [tg.key]: e.target.checked })}
                    className="size-4 accent-[var(--sts)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{t(tg.label)}</span>
                    <span className="block truncate font-mono text-[0.72rem] text-[var(--muted)]">
                      {tg.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <ol
            className="space-y-2"
            aria-label={t({ en: "Provider chain", ja: "プロバイダチェーン" })}
          >
            {r.order.map((p, n) => {
              const win = p === r.winner;
              const shadow = r.shadowed.includes(p);
              const winIdx = r.winner ? r.order.indexOf(r.winner) : -1;
              const skipped = winIdx >= 0 && n > winIdx;
              return (
                <li
                  key={p}
                  className="flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors"
                  style={{
                    borderColor: win
                      ? "var(--resource)"
                      : shadow
                        ? "var(--deny)"
                        : "var(--line)",
                    background: win
                      ? "color-mix(in oklab, var(--resource) 12%, var(--surface))"
                      : skipped && !shadow
                        ? "var(--sunk)"
                        : "var(--surface)",
                    borderStyle: skipped && !shadow ? "dashed" : "solid",
                  }}
                >
                  <span className="w-6 font-mono text-sm text-[var(--muted)] tabular-nums">
                    {n + 1}
                  </span>
                  <span className="flex-1 font-semibold">{t(PROVIDER_LABEL[p])}</span>
                  <span
                    className="text-xs font-bold"
                    style={{
                      color: win
                        ? "var(--resource)"
                        : shadow
                          ? "var(--deny)"
                          : "var(--muted)",
                    }}
                  >
                    {win
                      ? t({ en: "Wins", ja: "採用" })
                      : shadow
                        ? t({ en: "Has keys, never asked", ja: "あるのに使われない" })
                        : skipped
                          ? t({ en: "Not reached", ja: "到達しない" })
                          : t({ en: "Nothing here", ja: "なし" })}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="prose-col mt-4" aria-live="polite">
            {r.winner
              ? t({
                  en: `${SDK_LABEL[sdk]} signs with ${PROVIDER_LABEL[r.winner].en.toLowerCase()}.`,
                  ja: `${SDK_LABEL[sdk]} は「${PROVIDER_LABEL[r.winner].ja}」の認証情報で署名します。`,
                })
              : t({
                  en: `${SDK_LABEL[sdk]} finds nothing and the call fails with "Unable to locate credentials".`,
                  ja: `${SDK_LABEL[sdk]} は何も見つけられず、「Unable to locate credentials」で失敗します。`,
                })}
            {r.shadowed.length > 0 &&
              t({
                en: " The red rows also hold credentials but are never consulted: this is how a stale env var or a leftover IRSA setting silently wins.",
                ja: " 赤い行にも認証情報はありますが、参照されません。古い環境変数や IRSA の設定の残りが、気づかないうちに勝ってしまうのはこのせいです。",
              })}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {t({
              en: "Simplified: command-line options, code parameters and Java system properties come before everything shown. Java and Go read one profile in a single step, whatever it holds.",
              ja: "簡略化しています。コマンドラインオプション・コード内の引数・Java のシステムプロパティは、ここに出したものより常に先に来ます。Java と Go はプロファイルの中身が何であれ 1 ステップで読みます。",
            })}{" "}
            <Src href="https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html">
              {t({ en: "SDK reference", ja: "SDK リファレンス" })}
            </Src>
          </p>
        </div>
      </div>
    </Figure>
  );
}
