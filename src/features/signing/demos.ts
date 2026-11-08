import type { L } from "@/i18n/lang";
import {
  EMPTY_PAYLOAD_SHA256,
  type SigV4Credentials,
  type SigV4Options,
  type SigV4Request,
} from "./sigv4";

/**
 * The signed requests the Signing chapter draws, as data. Every wire message is
 * the real shape of the call. Authorization headers are never written here: the
 * lab signs each request in the browser and splices the result in, so what the
 * page shows is what the algorithm actually produces.
 *
 * Every key is AWS's own published example value. Nothing here is a secret.
 */

export const DEMO_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
export const LONG_TERM_KEY = "AKIAIOSFODNN7EXAMPLE";
export const TEMP_KEY = "ASIAIOSFODNN7EXAMPLE";
export const SESSION_TOKEN =
  "IQoJb3JpZ2luX2VjEBYaCXVzLWVhc3QtMSJHMEUCIQDEXAMPLEEXAMPLEEXAMPLE";
export const DATETIME = "20260919T120000Z";

/** How an annotated token on the wire is coloured. */
export type Tone = "key" | "warn" | "good" | "info";

export const TONE_VAR: Record<Tone, string> = {
  key: "var(--role)",
  warn: "var(--deny)",
  good: "var(--resource)",
  info: "var(--idp)",
};

/** Highlights a literal substring of the wire text and explains it. */
export interface Annotation {
  match: string;
  note: L;
  tone?: Tone;
}

export interface WireMessage {
  /** Request line or status line, verbatim. */
  start: string;
  headers: Array<[string, string]>;
  body?: string;
  annotations?: Annotation[];
}

/** What AWS does with the message on its side of the wire. */
export interface ServerNote {
  title: L;
  detail: L;
  tone?: Tone;
}

export interface SigningDemo {
  id: string;
  label: L;
  /** One line under the selector: what is different about this request. */
  blurb: L;
  request: SigV4Request;
  credentials: SigV4Credentials;
  options: SigV4Options;
  /** The request as it goes on the wire, minus the computed Authorization. */
  wire: WireMessage;
  serverSide: ServerNote[];
}

/** Renders a wire message as text, the way the lab shows it. */
export function wireText(
  message: WireMessage,
  extraHeaders: Array<[string, string]> = [],
): string {
  const headers = [...message.headers, ...extraHeaders]
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
  const head = `${message.start}\n${headers}`;
  return message.body ? `${head}\n\n${message.body}` : head;
}

const S3_HOST = "my-bucket.s3.us-east-1.amazonaws.com";
const S3_OPTIONS: SigV4Options = {
  region: "us-east-1",
  service: "s3",
  datetime: DATETIME,
  doubleEncodePath: false,
};
const s3Get = (): SigV4Request => ({
  method: "GET",
  path: "/key.txt",
  headers: {
    host: S3_HOST,
    "x-amz-content-sha256": EMPTY_PAYLOAD_SHA256,
    "x-amz-date": DATETIME,
  },
});

const ASSUME_ROLE_BODY =
  "Action=AssumeRole&RoleArn=arn%3Aaws%3Aiam%3A%3A111111111111%3Arole%2FAppRole&RoleSessionName=demo-session&Version=2011-06-15";

export const SIGNING_DEMOS: SigningDemo[] = [
  {
    id: "long-term",
    label: { en: "Long-term key → S3", ja: "長期キー → S3" },
    blurb: {
      en: "Two components only, so there is no `X-Amz-Security-Token` header. The signing maths is otherwise identical to the temporary-credential case.",
      ja: "要素が 2 つだけなので `X-Amz-Security-Token` ヘッダーがありません。それ以外の署名計算は一時認証情報の場合とまったく同じです。",
    },
    request: s3Get(),
    credentials: { accessKeyId: LONG_TERM_KEY, secretAccessKey: DEMO_SECRET },
    options: S3_OPTIONS,
    wire: {
      start: "GET /key.txt HTTP/1.1",
      headers: [
        ["Host", S3_HOST],
        ["X-Amz-Content-Sha256", EMPTY_PAYLOAD_SHA256],
        ["X-Amz-Date", DATETIME],
      ],
      annotations: [
        {
          match: "X-Amz-Date",
          tone: "info",
          note: {
            en: "S3 rejects a timestamp more than 15 minutes from its own clock with `RequestTimeTooSkewed`. AWS's general guidance is tighter: in most cases a signed request must arrive within five minutes. Either way the point is to bound how long an intercepted request stays replayable.",
            ja: "S3 は自分の時計から 15 分以上ずれたタイムスタンプを `RequestTimeTooSkewed` で拒否します。AWS の一般的な案内はもっと厳しく、多くの場合は署名から 5 分以内に届く必要があります。どちらにせよ狙いは、傍受されたリクエストを使い回せる時間を区切ることです。",
          },
        },
        {
          match: "X-Amz-Content-Sha256",
          tone: "info",
          note: {
            en: "SHA-256 of the body. An empty body still hashes, which is why the constant `e3b0c442…` shows up everywhere.",
            ja: "ボディの SHA-256 です。空のボディでもハッシュは取るので、定数 `e3b0c442…` があちこちに出てきます。",
          },
        },
      ],
    },
    serverSide: [
      {
        title: {
          en: "Look the secret up by key ID",
          ja: "キー ID からシークレットを引く",
        },
        detail: {
          en: "`Credential=` names `AKIA…`, so AWS fetches the stored secret for that IAM user and recomputes. There is no session to resolve.",
          ja: "`Credential=` が `AKIA…` なので、AWS はその IAM ユーザーの保管済みシークレットを引いて再計算します。解決すべきセッションはありません。",
        },
      },
      {
        title: {
          en: "The principal is the user itself",
          ja: "プリンシパルはユーザーそのもの",
        },
        detail: {
          en: "No role, no session name. CloudTrail records `user/app-user`, so attribution stops at the key rather than at a person.",
          ja: "ロールもセッション名もありません。CloudTrail には `user/app-user` としか残らないので、追跡はキーで止まり、人まで届きません。",
        },
        tone: "warn",
      },
    ],
  },
  {
    id: "assume-role",
    label: { en: "AssumeRole → STS", ja: "AssumeRole → STS" },
    blurb: {
      en: "STS is an ordinary AWS service, so the call that hands out temporary credentials is itself signed with credentials you already hold. The service in the credential scope is `sts`, and the form body is hashed into the signature.",
      ja: "STS も普通の AWS サービスなので、一時認証情報をもらう呼び出し自体を、すでに持っている認証情報で署名します。credential scope のサービス名は `sts` で、フォームのボディもハッシュされて署名に入ります。",
    },
    request: {
      method: "POST",
      path: "/",
      headers: {
        host: "sts.us-east-1.amazonaws.com",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        "x-amz-date": DATETIME,
      },
      body: ASSUME_ROLE_BODY,
    },
    credentials: { accessKeyId: LONG_TERM_KEY, secretAccessKey: DEMO_SECRET },
    options: { region: "us-east-1", service: "sts", datetime: DATETIME },
    wire: {
      start: "POST / HTTP/1.1",
      headers: [
        ["Host", "sts.us-east-1.amazonaws.com"],
        ["Content-Type", "application/x-www-form-urlencoded; charset=utf-8"],
        ["X-Amz-Date", DATETIME],
      ],
      body: ASSUME_ROLE_BODY,
      annotations: [
        {
          match: "RoleSessionName=demo-session",
          tone: "key",
          note: {
            en: "This string becomes the session half of `assumed-role/AppRole/demo-session` in CloudTrail. The caller picks it, so it is only as trustworthy as the caller.",
            ja: "この文字列が CloudTrail の `assumed-role/AppRole/demo-session` の後半になります。呼び出し側が自由に決めるので、信頼できる度合いは呼び出し側と同じです。",
          },
        },
      ],
    },
    serverSide: [
      {
        title: { en: "Authenticate the caller first", ja: "まず呼び出し元を認証する" },
        detail: {
          en: "STS verifies the SigV4 signature to establish who is asking. Only then is the question of whether they may assume the role reachable: the trust policy and the caller's own `sts:AssumeRole` permission come after.",
          ja: "STS は SigV4 署名を検証して、誰が頼んでいるかを確定します。ロールを引き受けてよいかという問いに進めるのはその後で、信頼ポリシーと呼び出し元自身の `sts:AssumeRole` 権限はそこで評価されます。",
        },
      },
      {
        title: { en: "Mint the session", ja: "セッションを発行する" },
        detail: {
          en: "A fresh secret is generated and bound, with the session's policies and expiry, to the session token the caller will send back on every request. The response carries an `ASIA…` key ID that is different from the one that signed this request.",
          ja: "新しいシークレットが生成され、セッションのポリシーと有効期限とともにセッショントークンに結び付けられます。呼び出し側は以後、そのトークンを毎回送り返します。レスポンスの `ASIA…` キー ID は、このリクエストに署名したキーとは別物です。",
        },
        tone: "good",
      },
    ],
  },
  {
    id: "temporary",
    label: { en: "Temporary credentials → S3", ja: "一時認証情報 → S3" },
    blurb: {
      en: "The three parts travel together: `ASIA…` goes in `Credential=`, the secret never leaves the process, and the session token rides in its own header, which must be one of the signed headers.",
      ja: "3 つの要素がそろって初めて成立します。`ASIA…` は `Credential=` に入り、シークレットはプロセスの外に出ず、セッショントークンは専用ヘッダーに乗ります。そのヘッダーは署名対象のヘッダーに含める必要があります。",
    },
    request: s3Get(),
    credentials: {
      accessKeyId: TEMP_KEY,
      secretAccessKey: DEMO_SECRET,
      sessionToken: SESSION_TOKEN,
    },
    options: S3_OPTIONS,
    wire: {
      start: "GET /key.txt HTTP/1.1",
      headers: [
        ["Host", S3_HOST],
        ["X-Amz-Content-Sha256", EMPTY_PAYLOAD_SHA256],
        ["X-Amz-Date", DATETIME],
        ["X-Amz-Security-Token", SESSION_TOKEN],
      ],
      annotations: [
        {
          match: "X-Amz-Security-Token",
          tone: "key",
          note: {
            en: "The third component, and the one people forget. AWS does not document its format; what matters is that AWS resolves it to this session's secret and attached policies, and that it is covered by the signature.",
            ja: "3 つ目の要素で、忘れられがちなものです。AWS は中身の形式を公開していません。大事なのは、AWS がこれをこのセッションのシークレットと付随するポリシーに解決すること、そして署名の対象に含まれることです。",
          },
        },
      ],
    },
    serverSide: [
      {
        title: {
          en: "Rebuild the canonical request",
          ja: "正規リクエストを組み立て直す",
        },
        detail: {
          en: "S3 reads the method, path, query, the headers named in `SignedHeaders` and the payload hash, and assembles the identical string.",
          ja: "S3 はメソッド、パス、クエリ、`SignedHeaders` に挙がったヘッダー、ペイロードハッシュを読み、まったく同じ文字列を組み立てます。",
        },
      },
      {
        title: {
          en: "Recover the session secret",
          ja: "セッションのシークレットを復元する",
        },
        detail: {
          en: "`Credential=` names `ASIA…`, so the secret used to recompute comes from the session that `X-Amz-Security-Token` identifies, together with any session policy attached at issuance, not from a stored IAM user key.",
          ja: "`Credential=` が `ASIA…` なので、再計算に使うシークレットは保管された IAM ユーザーのキーではなく、`X-Amz-Security-Token` が示すセッションから来ます。発行時に付いたセッションポリシーも一緒に効きます。",
        },
      },
      {
        title: { en: "Compare, then authorize", ja: "照合してから認可する" },
        detail: {
          en: "The signatures match, so the principal is `assumed-role/AppRole/demo-session`. Only then are the identity policy, bucket policy, SCPs and session policy evaluated.",
          ja: "署名が一致したので、プリンシパルは `assumed-role/AppRole/demo-session` に確定します。ID ポリシー、バケットポリシー、SCP、セッションポリシーが評価されるのはその後です。",
        },
        tone: "good",
      },
    ],
  },
];

/** Where an `AKIA…` key comes from: IAM, not STS. */
export const CREATE_ACCESS_KEY: { request: WireMessage; response: WireMessage } = {
  request: {
    start: "POST / HTTP/1.1",
    headers: [
      ["Host", "iam.amazonaws.com"],
      ["Content-Type", "application/x-www-form-urlencoded; charset=utf-8"],
    ],
    body: "Action=CreateAccessKey&UserName=app-user&Version=2010-05-08",
  },
  response: {
    start: "HTTP/1.1 200 OK",
    headers: [["Content-Type", "text/xml"]],
    body: `<CreateAccessKeyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <CreateAccessKeyResult>
    <AccessKey>
      <UserName>app-user</UserName>
      <AccessKeyId>${LONG_TERM_KEY}</AccessKeyId>
      <SecretAccessKey>${DEMO_SECRET}</SecretAccessKey>
      <Status>Active</Status>
      <CreateDate>2026-09-19T12:00:00Z</CreateDate>
    </AccessKey>
  </CreateAccessKeyResult>
</CreateAccessKeyResponse>`,
    annotations: [
      {
        match: "<CreateDate>2026-09-19T12:00:00Z</CreateDate>",
        tone: "warn",
        note: {
          en: "There is a creation date and no expiry to go with it. Age is the only signal you get, which is why key-age reports exist at all.",
          ja: "作成日時はあるのに、対になる有効期限がありません。手がかりは経過時間だけです。キーの古さを報告する仕組みが必要になるのはそのためです。",
        },
      },
      {
        match: "<SecretAccessKey>",
        tone: "key",
        note: {
          en: "Shown once, in this response, and never again. AWS keeps its own copy so it can recompute signatures later; nothing about the key encodes an expiry, a role or a session.",
          ja: "表示されるのはこのレスポンスの一度きりです。AWS は後で署名を再計算するために自分の側でも保持します。キー自体には有効期限もロールもセッションも入っていません。",
        },
      },
    ],
  },
};

/** The one AWS path that skips SigV4 entirely. */
export const BEDROCK_BEARER: WireMessage = {
  start: "POST /model/us.anthropic.claude-sonnet-4-6/converse HTTP/1.1",
  headers: [
    ["Host", "bedrock-runtime.us-east-1.amazonaws.com"],
    ["Content-Type", "application/json"],
    ["Authorization", "Bearer ABSKQmVkcm9ja0FQSUtleS1leGFtcGxl..."],
  ],
  body: `{"messages":[{"role":"user","content":[{"text":"Hello"}]}]}`,
  annotations: [
    {
      match: "Bearer ABSKQmVkcm9ja0FQSUtleS1leGFtcGxl...",
      tone: "warn",
      note: {
        en: "Whoever holds this string is the caller. No signature binds it to this request, so it works for any request until it expires.",
        ja: "この文字列を持っている人が呼び出し元です。このリクエストに結び付ける署名がないので、有効期限までどのリクエストにも使えます。",
      },
    },
    {
      match: "Content-Type",
      tone: "info",
      note: {
        en: "No `X-Amz-Date` either, so there is no clock-skew window and no replay bound from a timestamp.",
        ja: "`X-Amz-Date` もありません。時刻ずれの許容幅も、タイムスタンプによるリプレイの制限も存在しません。",
      },
    },
  ],
};

export const BEDROCK_NOTES: ServerNote[] = [
  {
    title: { en: "Looked up, not recomputed", ja: "再計算ではなく照合" },
    detail: {
      en: "Bedrock validates the token itself. Nothing about the request body or headers is covered by it.",
      ja: "Bedrock はトークンそのものを検証します。リクエストのボディやヘッダーはこのトークンで一切保護されていません。",
    },
  },
  {
    title: { en: "A long-term key hides behind it", ja: "裏に長期キーが隠れている" },
    detail: {
      en: "Creating a long-term Bedrock API key creates an IAM user and attaches `AmazonBedrockLimitedAccess` to it. Short-term keys inherit the permissions of the principal that generated them and expire within 12 hours.",
      ja: "長期の Bedrock API キーを作ると、IAM ユーザーが作られて `AmazonBedrockLimitedAccess` が付きます。短期キーは生成したプリンシパルの権限を引き継ぎ、12 時間以内に失効します。",
    },
    tone: "warn",
  },
  {
    title: { en: "Deny it if you do not need it", ja: "使わないなら禁止する" },
    detail: {
      en: "AWS recommends blocking API key creation with an SCP when the use case does not require it, precisely because it walks back a no-long-term-keys posture.",
      ja: "AWS 自身が、必要ないなら SCP で作成を禁止するよう勧めています。長期キーを置かない方針を巻き戻すものだからです。",
    },
  },
];
