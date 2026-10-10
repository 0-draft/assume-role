import type { L } from "@/i18n/lang";
import type { Lane, Message } from "@/components/ui/Sequence";

/**
 * Every way a workload or a human ends up holding STS credentials, as data.
 * Source: docs/05-credential-paths.md. Account IDs, keys and tokens are fake.
 *
 * Lane colours follow one rule across all paths:
 *   caller   = the workload or human that ends up using the credentials
 *   idp      = whoever vouches for identity (OIDC issuer, SAML IdP, portal, Sign-In)
 *   role     = the AWS-side component that assumes the role or delivers its
 *              credentials for you (EC2 service, IMDS, agents, EKS Auth)
 *   sts      = STS itself
 *   resource = the API finally called (or an external service)
 */

export type Group = "aws" | "outside" | "human" | "special";

/** Who sends the STS request. */
export type StsCaller = "service" | "you";

export interface PathDef {
  id: string;
  group: Group;
  name: L;
  blurb: L;
  /** The STS operation behind this path (always set, even if called for you). */
  stsApi: string;
  /** A non-STS front door you actually talk to, when there is one. */
  frontDoor?: string;
  stsCaller: StsCaller;
  /** Is the request to the front door / STS signed with AWS credentials? */
  signed: "signed" | "unsigned" | "n/a";
  endpoint: string;
  duration: L;
  delivery: L;
  refresh: L;
  lanes: Lane[];
  steps: Message[];
  source: { label: string; href: string };
}

const same = (s: string): L => ({ en: s, ja: s });

const lane = (
  id: string,
  actor: Lane["actor"],
  en: string,
  ja: string,
  sub?: string,
): Lane => ({
  id,
  actor,
  label: { en, ja },
  sub,
});

const m = (
  from: string,
  to: string,
  label: string,
  detail: L,
  extra: Partial<Pick<Message, "payload" | "reply">> = {},
): Message => ({ from, to, label: same(label), detail, ...extra });

const STS_REGIONAL = "sts.<region>.amazonaws.com";

const CREDS_XML = `<Credentials>
  <AccessKeyId>ASIAIOSFODNN7EXAMPLE</AccessKeyId>
  <SecretAccessKey>wJalr...EXAMPLEKEY</SecretAccessKey>
  <SessionToken>IQoJb3JpZ2luX2VjEXAMPLE...</SessionToken>
  <Expiration>2026-10-10T13:00:00Z</Expiration>
</Credentials>`;

export const PATHS: PathDef[] = [
  // ───────────── Workloads on AWS ─────────────
  {
    id: "ec2",
    group: "aws",
    name: {
      en: "EC2 instance profile (IMDSv2)",
      ja: "EC2 インスタンスプロファイル (IMDSv2)",
    },
    blurb: {
      en: "Your code never calls STS. The EC2 service assumes the role and parks the result in the Instance Metadata Service.",
      ja: "あなたのコードは STS を呼びません。EC2 サービスがロールを引き受け、その結果をインスタンスメタデータサービス (IMDS) に置いておきます。",
    },
    stsApi: "AssumeRole",
    frontDoor: "IMDS 169.254.169.254",
    stsCaller: "service",
    signed: "n/a",
    endpoint: "169.254.169.254 / [fd00:ec2::254]",
    duration: {
      en: "Not a fixed documented number; rotated automatically",
      ja: "決まった値は文書化されていない。自動でローテーション",
    },
    delivery: { en: "IMDS (HTTP on the host)", ja: "IMDS (ホスト上の HTTP)" },
    refresh: {
      en: "New credentials appear at least 5 min before the old ones expire",
      ja: "古い認証情報の失効 5 分以上前に新しいものが置かれる",
    },
    lanes: [
      lane("app", "caller", "App (SDK)", "アプリ (SDK)"),
      lane("imds", "role", "IMDS", "IMDS", "169.254.169.254"),
      lane("ec2", "role", "EC2 service", "EC2 サービス"),
      lane("sts", "sts", "STS", "STS"),
      lane("api", "resource", "AWS API", "AWS API"),
    ],
    steps: [
      m("ec2", "sts", "AssumeRole(instance role)", {
        en: "When the instance launches with an instance profile, the EC2 service calls `AssumeRole`. The role's trust policy must allow `ec2.amazonaws.com`, and whoever attached the profile needed `iam:PassRole`.",
        ja: "インスタンスプロファイル付きで起動すると、EC2 サービスが `AssumeRole` を呼びます。ロールの信頼ポリシーは `ec2.amazonaws.com` を許可している必要があり、プロファイルを付けた人には `iam:PassRole` が要ります。",
      }),
      m(
        "sts",
        "ec2",
        "ASIA… + SessionToken",
        {
          en: "STS returns a temporary key (`ASIA…`), secret and session token. The role session name is the instance ID.",
          ja: "STS が一時キー (`ASIA…`)・シークレット・セッショントークンを返します。ロールセッション名はインスタンス ID になります。",
        },
        { reply: true },
      ),
      m("ec2", "imds", "publish iam/security-credentials/<role>", {
        en: "EC2 publishes the credentials inside the metadata service of that one instance. All processes on the host share this single role.",
        ja: "EC2 はその認証情報を、そのインスタンスのメタデータサービスに置きます。ホスト上の全プロセスがこの 1 つのロールを共有します。",
      }),
      m(
        "app",
        "imds",
        "PUT /latest/api/token",
        {
          en: "IMDSv2 starts with a PUT for a session token (TTL 1 s to 21600 s). The PUT response only survives `HttpPutResponseHopLimit` IP hops, which is what keeps bridged containers out when the limit is 1.",
          ja: "IMDSv2 はまずセッショントークンを PUT で取ります (TTL 1〜21600 秒)。PUT の応答は `HttpPutResponseHopLimit` 分の IP ホップしか届きません。上限 1 ならブリッジ接続のコンテナからは取れません。",
        },
        {
          payload: {
            label: "HTTP",
            body: `PUT /latest/api/token HTTP/1.1
Host: 169.254.169.254
X-aws-ec2-metadata-token-ttl-seconds: 21600`,
          },
        },
      ),
      m(
        "app",
        "imds",
        "GET …/iam/security-credentials/<role>",
        {
          en: "With the token in a header, the SDK reads the role's credentials. Policies can tell IMDSv1 from v2 deliveries via `ec2:RoleDelivery` (`1.0` / `2.0`).",
          ja: "SDK はトークンをヘッダーに付けてロールの認証情報を読みます。ポリシーでは `ec2:RoleDelivery` (`1.0` / `2.0`) で、IMDSv1 と v2 のどちらで渡されたかを区別できます。",
        },
        {
          payload: {
            label: "GET /latest/meta-data/iam/security-credentials/app-role",
            body: `{
  "Code": "Success",
  "LastUpdated": "2026-10-10T10:01:12Z",
  "Type": "AWS-HMAC",
  "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalr...EXAMPLEKEY",
  "Token": "IQoJb3JpZ2luX2VjEXAMPLE...",
  "Expiration": "2026-10-10T16:27:44Z"
}`,
          },
        },
      ),
      m("app", "api", "SigV4 + X-Amz-Security-Token", {
        en: "Requests are signed with the temporary key. They carry `ec2:SourceInstanceARN`, `aws:EC2InstanceSourceVPC` and `aws:EC2InstanceSourcePrivateIPv4`, which an SCP can compare with `aws:SourceVpc` / `aws:VpcSourceIp` so stolen credentials stop working elsewhere.",
        ja: "リクエストは一時キーで署名されます。`ec2:SourceInstanceARN`・`aws:EC2InstanceSourceVPC`・`aws:EC2InstanceSourcePrivateIPv4` が付くので、SCP で `aws:SourceVpc` / `aws:VpcSourceIp` と突き合わせれば、盗まれた認証情報を外で使えなくできます。",
      }),
    ],
    source: {
      label: "EC2: retrieve security credentials from instance metadata",
      href: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-metadata-security-credentials.html",
    },
  },
  {
    id: "lambda",
    group: "aws",
    name: { en: "Lambda execution role", ja: "Lambda 実行ロール" },
    blurb: {
      en: "Lambda assumes the execution role when it initialises an environment and hands the result to your handler as environment variables.",
      ja: "Lambda は実行環境の初期化時に実行ロールを引き受け、結果を環境変数としてハンドラに渡します。",
    },
    stsApi: "AssumeRole",
    stsCaller: "service",
    signed: "n/a",
    endpoint: "internal (Lambda service)",
    duration: {
      en: "Per execution environment (exact value not documented)",
      ja: "実行環境ごと (具体的な値は文書化されていない)",
    },
    delivery: {
      en: "Env vars AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN",
      ja: "環境変数 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN",
    },
    refresh: {
      en: "Handled by Lambda; with SnapStart the runtime switches to container credentials",
      ja: "Lambda が管理。SnapStart 有効時はコンテナ認証情報方式に切り替わる",
    },
    lanes: [
      lane("fn", "caller", "Handler (SDK)", "ハンドラ (SDK)"),
      lane("lambda", "role", "Lambda service", "Lambda サービス"),
      lane("sts", "sts", "STS", "STS"),
      lane("api", "resource", "AWS API", "AWS API"),
    ],
    steps: [
      m("lambda", "sts", "AssumeRole(execution role)", {
        en: "On environment init, Lambda assumes the function's execution role. The trust principal is `lambda.amazonaws.com`.",
        ja: "実行環境の初期化時に Lambda が実行ロールを引き受けます。信頼するプリンシパルは `lambda.amazonaws.com` です。",
      }),
      m(
        "sts",
        "lambda",
        "ASIA… + SessionToken",
        {
          en: "Ordinary temporary credentials come back.",
          ja: "普通の一時認証情報が返ります。",
        },
        { reply: true },
      ),
      m(
        "lambda",
        "fn",
        "env AWS_ACCESS_KEY_ID …",
        {
          en: "They are placed in the sandbox as environment variables. With SnapStart, Lambda uses `AWS_CONTAINER_CREDENTIALS_FULL_URI` plus an auth token instead, so a restored snapshot never carries expired keys.",
          ja: "サンドボックスに環境変数として置かれます。SnapStart 有効時は代わりに `AWS_CONTAINER_CREDENTIALS_FULL_URI` と認証トークンを使い、復元したスナップショットが期限切れキーを持ち込まないようにしています。",
        },
        {
          payload: {
            label: "environment",
            body: `AWS_ACCESS_KEY_ID=ASIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalr...EXAMPLEKEY
AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEXAMPLE...`,
          },
        },
      ),
      m("fn", "api", "SigV4 (lambda:SourceFunctionArn)", {
        en: "The SDK's default chain finds the env vars first. Requests carry `lambda:SourceFunctionArn`, usable in resource policies and SCPs. Never log the environment: child processes and crash dumps inherit it.",
        ja: "SDK の既定のチェーンが最初に環境変数を見つけます。リクエストには `lambda:SourceFunctionArn` が付き、リソースポリシーや SCP で使えます。環境変数はログに出さないでください。子プロセスやクラッシュダンプにも引き継がれます。",
      }),
    ],
    source: {
      label: "Lambda: SnapStart and credentials",
      href: "https://docs.aws.amazon.com/lambda/latest/dg/snapstart-activate.html",
    },
  },
  {
    id: "ecs",
    group: "aws",
    name: { en: "ECS task role", ja: "ECS タスクロール" },
    blurb: {
      en: "ECS assumes the task role and the ECS or Fargate agent serves the credentials on a link-local endpoint inside the task.",
      ja: "ECS がタスクロールを引き受け、ECS / Fargate エージェントがタスク内のリンクローカルなエンドポイントで認証情報を配ります。",
    },
    stsApi: "AssumeRole",
    frontDoor: "169.254.170.2",
    stsCaller: "service",
    signed: "n/a",
    endpoint: "http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
    duration: { en: "Rotated by the agent", ja: "エージェントがローテーション" },
    delivery: {
      en: "Container credentials endpoint",
      ja: "コンテナ認証情報エンドポイント",
    },
    refresh: {
      en: "The SDK re-fetches from the agent before expiry",
      ja: "失効前に SDK がエージェントから取り直す",
    },
    lanes: [
      lane("app", "caller", "Container (SDK)", "コンテナ (SDK)"),
      lane(
        "agent",
        "role",
        "ECS / Fargate agent",
        "ECS / Fargate エージェント",
        "169.254.170.2",
      ),
      lane("ecs", "role", "ECS control plane", "ECS コントロールプレーン"),
      lane("sts", "sts", "STS", "STS"),
    ],
    steps: [
      m("ecs", "sts", "AssumeRole(taskRoleArn)", {
        en: "ECS assumes `taskRoleArn` as `ecs-tasks.amazonaws.com`. Add `aws:SourceAccount` / `aws:SourceArn` conditions to the trust policy.",
        ja: "ECS が `ecs-tasks.amazonaws.com` として `taskRoleArn` を引き受けます。信頼ポリシーには `aws:SourceAccount` / `aws:SourceArn` の条件を付けます。",
      }),
      m(
        "sts",
        "ecs",
        "ASIA… + SessionToken",
        {
          en: "Temporary credentials come back. Sessions carry a `taskArn` in CloudTrail, so you can see which task used the role.",
          ja: "一時認証情報が返ります。CloudTrail のセッションには `taskArn` が入るので、どのタスクが使ったか分かります。",
        },
        { reply: true },
      ),
      m("ecs", "agent", "credentials for task", {
        en: "The control plane hands them to the agent on the host or in Fargate. How exactly is not documented (unverified).",
        ja: "コントロールプレーンがホスト上 (または Fargate) のエージェントに渡します。具体的な経路は文書化されていません (未検証)。",
      }),
      m("app", "agent", "GET 169.254.170.2/v2/credentials/<id>", {
        en: "The SDK appends `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` to `169.254.170.2`. That variable is only in PID 1's environment, so a shell from `exec` may not see it.",
        ja: "SDK は `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` を `169.254.170.2` に付けて取りに行きます。この変数は PID 1 の環境にしかないので、`exec` で入ったシェルからは見えないことがあります。",
      }),
      m(
        "agent",
        "app",
        "{RoleArn, AccessKeyId, Token, Expiration}",
        {
          en: "On ECS on EC2 there is no isolation between tasks: a container can reach other tasks' credentials and the instance role via IMDS unless you block it. Fargate isolates per task.",
          ja: "EC2 上の ECS ではタスク間の分離がありません。対策しないとコンテナから他タスクの認証情報や IMDS 経由のインスタンスロールに届きます。Fargate はタスクごとに分離されます。",
        },
        {
          reply: true,
          payload: {
            label: "200 OK",
            body: `{
  "RoleArn": "arn:aws:iam::123456789012:role/app-task",
  "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalr...EXAMPLEKEY",
  "Token": "IQoJb3JpZ2luX2VjEXAMPLE...",
  "Expiration": "2026-10-10T16:00:00Z"
}`,
          },
        },
      ),
    ],
    source: {
      label: "ECS: task IAM role",
      href: "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html",
    },
  },
  {
    id: "irsa",
    group: "aws",
    name: { en: "EKS IRSA", ja: "EKS IRSA" },
    blurb: {
      en: "Plain web identity federation: the pod's own SDK sends its service-account JWT to STS.",
      ja: "素の Web ID フェデレーションです。Pod の SDK 自身がサービスアカウントの JWT を STS に送ります。",
    },
    stsApi: "AssumeRoleWithWebIdentity",
    stsCaller: "you",
    signed: "unsigned",
    endpoint: STS_REGIONAL,
    duration: {
      en: "1 h default, up to the role max (12 h)",
      ja: "既定 1 時間、ロール上限 (12 時間) まで",
    },
    delivery: {
      en: "In memory; token file + AWS_ROLE_ARN env",
      ja: "メモリ上。トークンファイルと AWS_ROLE_ARN 環境変数",
    },
    refresh: {
      en: "kubelet rotates the token at 80% of TTL or 24 h; the SDK calls STS again",
      ja: "kubelet が TTL の 80% か 24 時間でトークンを更新し、SDK が STS を再度呼ぶ",
    },
    lanes: [
      lane("kubelet", "idp", "kubelet / API server", "kubelet / API サーバー"),
      lane("pod", "caller", "Pod (SDK)", "Pod (SDK)"),
      lane("sts", "sts", "STS", "STS", STS_REGIONAL),
      lane(
        "oidc",
        "idp",
        "Cluster OIDC issuer",
        "クラスタの OIDC 発行者",
        "oidc.eks.<region>.amazonaws.com",
      ),
    ],
    steps: [
      m(
        "kubelet",
        "pod",
        "projected token (aud sts.amazonaws.com)",
        {
          en: "A mutating webhook reads the service account's `eks.amazonaws.com/role-arn` annotation, sets `AWS_ROLE_ARN` and `AWS_WEB_IDENTITY_TOKEN_FILE`, and kubelet mounts a projected token.",
          ja: "Mutating Webhook がサービスアカウントの `eks.amazonaws.com/role-arn` アノテーションを読んで `AWS_ROLE_ARN` と `AWS_WEB_IDENTITY_TOKEN_FILE` を設定し、kubelet が投影トークン (projected token) をマウントします。",
        },
        {
          payload: {
            label: "decoded JWT payload",
            body: `{
  "iss": "https://oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE",
  "aud": ["sts.amazonaws.com"],
  "sub": "system:serviceaccount:payments:api",
  "exp": 1760180400
}`,
          },
        },
      ),
      m(
        "pod",
        "sts",
        "AssumeRoleWithWebIdentity",
        {
          en: "The SDK sends the JWT to STS. The call is **unsigned**: the token is the only proof, so the trust policy is the only gate.",
          ja: "SDK が JWT を STS に送ります。この呼び出しは **署名なし** です。トークンだけが証明なので、信頼ポリシーが唯一の関門になります。",
        },
        {
          payload: {
            label: "POST / (form-encoded, no SigV4)",
            body: `Action=AssumeRoleWithWebIdentity
&Version=2011-06-15
&RoleArn=arn:aws:iam::123456789012:role/payments-api
&RoleSessionName=botocore-session-1760176800
&WebIdentityToken=eyJhbGciOiJSUzI1NiIsImtpZCI6IkVYQU1QTEUifQ...`,
          },
        },
      ),
      m("sts", "oidc", "GET /.well-known/openid-configuration + JWKS", {
        en: "STS finds the IAM OIDC provider matching `iss`, fetches the issuer's keys and verifies the signature.",
        ja: "STS は `iss` に一致する IAM OIDC プロバイダを探し、発行者の鍵を取って署名を検証します。",
      }),
      m(
        "sts",
        "pod",
        "assumed-role/payments-api/…",
        {
          en: "If `<issuer>:sub` and `<issuer>:aud` match the trust policy, credentials come back. Without a `sub` condition, any service account in the cluster could assume the role.",
          ja: "`<issuer>:sub` と `<issuer>:aud` が信頼ポリシーに合えば認証情報が返ります。`sub` の条件がないと、クラスタ内のどのサービスアカウントでもこのロールを引き受けられてしまいます。",
        },
        {
          reply: true,
          payload: { label: "AssumeRoleWithWebIdentityResult", body: CREDS_XML },
        },
      ),
    ],
    source: {
      label: "EKS: configure Pods to use a service account",
      href: "https://docs.aws.amazon.com/eks/latest/userguide/pod-configuration.html",
    },
  },
  {
    id: "podid",
    group: "aws",
    name: { en: "EKS Pod Identity", ja: "EKS Pod Identity" },
    blurb: {
      en: "Not a direct STS call from the pod. A node-local agent calls the EKS Auth API, and EKS assumes the role.",
      ja: "Pod から STS を直接呼ぶ仕組みではありません。ノード上のエージェントが EKS Auth API を呼び、EKS がロールを引き受けます。",
    },
    stsApi: "AssumeRole + TagSession",
    frontDoor: "eks-auth:AssumeRoleForPodIdentity",
    stsCaller: "service",
    signed: "signed",
    endpoint: "eks-auth.<region>.api.aws",
    duration: { en: "Managed by the agent", ja: "エージェントが管理" },
    delivery: {
      en: "Container credentials endpoint 169.254.170.23",
      ja: "コンテナ認証情報エンドポイント 169.254.170.23",
    },
    refresh: {
      en: "The SDK re-fetches from the agent",
      ja: "SDK がエージェントから取り直す",
    },
    lanes: [
      lane("pod", "caller", "Pod (SDK)", "Pod (SDK)"),
      lane(
        "agent",
        "role",
        "Pod Identity agent",
        "Pod Identity エージェント",
        "169.254.170.23",
      ),
      lane("eksauth", "role", "EKS Auth", "EKS Auth", "eks-auth.<region>.api.aws"),
      lane("sts", "sts", "STS", "STS"),
    ],
    steps: [
      m(
        "pod",
        "agent",
        "GET /v1/credentials (Authorization: SA token)",
        {
          en: "EKS sets `AWS_CONTAINER_CREDENTIALS_FULL_URI` and a token file with audience `pods.eks.amazonaws.com` (86400 s). The SDK's container provider sends that token to the agent.",
          ja: "EKS は `AWS_CONTAINER_CREDENTIALS_FULL_URI` と、audience が `pods.eks.amazonaws.com` (86400 秒) のトークンファイルを設定します。SDK のコンテナプロバイダがそのトークンをエージェントに送ります。",
        },
        {
          payload: {
            label: "pod environment",
            body: `AWS_CONTAINER_CREDENTIALS_FULL_URI=http://169.254.170.23/v1/credentials
AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE=/var/run/secrets/pods.eks.amazonaws.com/serviceaccount/eks-pod-identity-token`,
          },
        },
      ),
      m(
        "agent",
        "eksauth",
        "POST /clusters/<c>/assume-role-for-pod-identity",
        {
          en: "The agent calls `AssumeRoleForPodIdentity`, signed with the **node role**. This API is only used by the agent.",
          ja: "エージェントが **ノードロール** で署名して `AssumeRoleForPodIdentity` を呼びます。この API はエージェント専用です。",
        },
        {
          payload: {
            label:
              "POST https://eks-auth.us-east-1.api.aws/clusters/prod/assume-role-for-pod-identity",
            body: `{ "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IkVYQU1QTEUifQ..." }`,
          },
        },
      ),
      m("eksauth", "sts", "AssumeRole + TagSession", {
        en: "EKS assumes the associated role as `pods.eks.amazonaws.com`, which must be trusted for `sts:AssumeRole` and `sts:TagSession`. Six session tags are added: cluster ARN and name, namespace, service account, pod name and pod UID.",
        ja: "EKS が `pods.eks.amazonaws.com` として関連付けられたロールを引き受けます。信頼ポリシーで `sts:AssumeRole` と `sts:TagSession` の許可が要ります。セッションタグが 6 つ付きます (クラスタ ARN・クラスタ名・名前空間・サービスアカウント・Pod 名・Pod UID)。",
      }),
      m(
        "sts",
        "eksauth",
        "credentials",
        {
          en: "The session name is `eks-<cluster>-<pod>-<uuid>`. With `targetRoleArn`, EKS chains into a cross-account role.",
          ja: "セッション名は `eks-<cluster>-<pod>-<uuid>` です。`targetRoleArn` を設定すると EKS が別アカウントのロールへ連鎖します。",
        },
        { reply: true },
      ),
      m(
        "eksauth",
        "agent",
        "credentials + subject{namespace, serviceAccount}",
        {
          en: "EKS Auth returns the credentials plus the pod's subject.",
          ja: "EKS Auth が認証情報と Pod の subject を返します。",
        },
        { reply: true },
      ),
      m(
        "agent",
        "pod",
        "container-credentials JSON",
        {
          en: "The pod gets ordinary container credentials. Anything earlier in the SDK chain (env keys, IRSA env vars) still wins, so a pod can silently keep using the old path.",
          ja: "Pod には普通のコンテナ認証情報が届きます。SDK チェーンの前の方 (環境変数のキーや IRSA の環境変数) が残っているとそちらが勝つので、気づかず古い経路を使い続けることがあります。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "EKS: how Pod Identity works",
      href: "https://docs.aws.amazon.com/eks/latest/userguide/pod-id-how-it-works.html",
    },
  },
  // ───────────── Outside AWS ─────────────
  {
    id: "rolesanywhere",
    group: "outside",
    name: { en: "IAM Roles Anywhere", ja: "IAM Roles Anywhere" },
    blurb: {
      en: "On-premises workloads prove they hold an X.509 private key. CreateSession is an X.509 wrapper around AssumeRole.",
      ja: "オンプレミスのワークロードが X.509 秘密鍵の所持を証明します。CreateSession は AssumeRole を X.509 で包んだ API です。",
    },
    stsApi: "AssumeRole",
    frontDoor: "rolesanywhere:CreateSession",
    stsCaller: "service",
    signed: "signed",
    endpoint: "rolesanywhere.<region>.amazonaws.com",
    duration: {
      en: "900 to 43200 s: min(profile, request), never above the role max",
      ja: "900〜43200 秒。プロファイルとリクエストの小さい方。ロール上限は超えない",
    },
    delivery: {
      en: "credential_process, a local IMDS-compatible server, or the credentials file",
      ja: "credential_process、ローカルの IMDS 互換サーバー、または credentials ファイル",
    },
    refresh: {
      en: "The signing helper calls CreateSession again",
      ja: "署名ヘルパーが CreateSession を再度呼ぶ",
    },
    lanes: [
      lane("app", "caller", "Workload (SDK)", "ワークロード (SDK)"),
      lane("helper", "caller", "aws_signing_helper", "aws_signing_helper"),
      lane("ra", "role", "Roles Anywhere", "Roles Anywhere"),
      lane("sts", "sts", "STS", "STS"),
    ],
    steps: [
      m("app", "helper", "credential_process", {
        en: "The SDK runs the helper. Modes: `credential-process`, `serve` (an IMDSv2-compatible server, default `127.0.0.1:9911`) or `update` (writes the credentials file).",
        ja: "SDK がヘルパーを実行します。モードは `credential-process`、`serve` (IMDSv2 互換サーバー、既定 `127.0.0.1:9911`)、`update` (credentials ファイルに書く) の 3 つです。",
      }),
      m(
        "helper",
        "ra",
        "POST /sessions (X-Amz-X509)",
        {
          en: "The request carries the certificate in `X-Amz-X509` and is signed with the certificate's private key.",
          ja: "証明書を `X-Amz-X509` に載せ、証明書の秘密鍵でリクエストに署名します。",
        },
        {
          payload: {
            label: "POST https://rolesanywhere.us-east-1.amazonaws.com/sessions",
            body: `X-Amz-X509: MIIC...base64 DER...
{
  "profileArn": "arn:aws:rolesanywhere:us-east-1:123456789012:profile/EXAMPLE",
  "roleArn": "arn:aws:iam::123456789012:role/onprem-batch",
  "trustAnchorArn": "arn:aws:rolesanywhere:us-east-1:123456789012:trust-anchor/EXAMPLE",
  "durationSeconds": 3600
}`,
          },
        },
      ),
      m("ra", "sts", "AssumeRole (tags from cert)", {
        en: "After validating the chain, CRL, profile and trust anchor, Roles Anywhere assumes the role as `rolesanywhere.amazonaws.com`. Subject, Issuer and SAN fields become principal tags such as `aws:PrincipalTag/x509Subject/CN`. The default session name is the certificate serial number.",
        ja: "証明書チェーン・CRL・プロファイル・トラストアンカーを検証したら、Roles Anywhere が `rolesanywhere.amazonaws.com` としてロールを引き受けます。Subject・Issuer・SAN が `aws:PrincipalTag/x509Subject/CN` のようなプリンシパルタグになります。既定のセッション名は証明書のシリアル番号です。",
      }),
      m(
        "sts",
        "ra",
        "credentials",
        { en: "Ordinary temporary credentials.", ja: "普通の一時認証情報が返ります。" },
        { reply: true },
      ),
      m(
        "ra",
        "helper",
        "201 {credentialSet: [...]}",
        {
          en: "Without a condition on certificate attributes, any certificate from that CA can assume the role.",
          ja: "証明書の属性で条件を付けないと、その CA が出したどの証明書でもロールを引き受けられます。",
        },
        { reply: true },
      ),
      m(
        "helper",
        "app",
        '{"Version":1, AccessKeyId, …}',
        {
          en: "The helper prints the `credential_process` JSON the SDK expects.",
          ja: "ヘルパーが SDK の期待する `credential_process` 形式の JSON を出力します。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "Roles Anywhere: CreateSession",
      href: "https://docs.aws.amazon.com/rolesanywhere/latest/userguide/authentication-create-session.html",
    },
  },
  {
    id: "github",
    group: "outside",
    name: { en: "GitHub Actions OIDC", ja: "GitHub Actions OIDC" },
    blurb: {
      en: "The runner asks GitHub for a JWT and trades it for role credentials. No AWS secret ever lives in the repository.",
      ja: "ランナーが GitHub に JWT を発行してもらい、ロールの認証情報と交換します。リポジトリに AWS のシークレットを置かずに済みます。",
    },
    stsApi: "AssumeRoleWithWebIdentity",
    stsCaller: "you",
    signed: "unsigned",
    endpoint: STS_REGIONAL,
    duration: {
      en: "3600 s default in configure-aws-credentials (900 to 43200, never above the role max)",
      ja: "configure-aws-credentials の既定は 3600 秒 (900〜43200、ロール上限は超えない)",
    },
    delivery: { en: "Env vars for later steps", ja: "後続ステップ向けの環境変数" },
    refresh: { en: "None; the job ends first", ja: "なし。先にジョブが終わる" },
    lanes: [
      lane("runner", "caller", "Runner", "ランナー"),
      lane(
        "gh",
        "idp",
        "GitHub OIDC",
        "GitHub OIDC",
        "token.actions.githubusercontent.com",
      ),
      lane("sts", "sts", "STS", "STS", STS_REGIONAL),
      lane("iam", "role", "IAM", "IAM"),
    ],
    steps: [
      m(
        "runner",
        "gh",
        "request ID token (aud sts.amazonaws.com)",
        {
          en: "The job needs `permissions: id-token: write`. `aws-actions/configure-aws-credentials` (v6) asks for audience `sts.amazonaws.com`.",
          ja: "ジョブに `permissions: id-token: write` が必要です。`aws-actions/configure-aws-credentials` (v6) が audience `sts.amazonaws.com` でトークンを要求します。",
        },
        {
          payload: {
            label: "workflow.yml",
            body: `permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: arn:aws:iam::123456789012:role/deploy
      aws-region: us-east-1`,
          },
        },
      ),
      m(
        "gh",
        "runner",
        "JWT",
        {
          en: "The token's `sub` encodes repository and trigger, e.g. `repo:my-org/my-app:ref:refs/heads/main`. Repositories created, renamed or transferred after 2026-07-15 send `repo:my-org@<id>/my-app@<id>:…` instead.",
          ja: "トークンの `sub` にはリポジトリとトリガーが入ります (例: `repo:my-org/my-app:ref:refs/heads/main`)。2026-07-15 以降に作成・リネーム・移管されたリポジトリは `repo:my-org@<id>/my-app@<id>:…` 形式になります。",
        },
        {
          reply: true,
          payload: {
            label: "decoded JWT payload",
            body: `{
  "iss": "https://token.actions.githubusercontent.com",
  "aud": "sts.amazonaws.com",
  "sub": "repo:my-org/my-app:ref:refs/heads/main",
  "repository": "my-org/my-app",
  "ref": "refs/heads/main"
}`,
          },
        },
      ),
      m("runner", "sts", "AssumeRoleWithWebIdentity", {
        en: "Unsigned call. The default role session name is `GitHubActions`.",
        ja: "署名なしの呼び出しです。既定のロールセッション名は `GitHubActions` です。",
      }),
      m("sts", "iam", "match iss, aud, sub against trust policy", {
        en: "STS checks `aud` against the OIDC provider's client ID list, verifies the signature (TLS checked against trusted root CAs, so no thumbprint needed), then evaluates `token.actions.githubusercontent.com:sub`. IAM refuses to save a trust policy for this provider without a non-wildcard `sub` condition.",
        ja: "STS は `aud` を OIDC プロバイダのクライアント ID リストと照合し、署名を検証し (TLS は信頼済みルート CA で検証するのでサムプリント不要)、`token.actions.githubusercontent.com:sub` を評価します。IAM はワイルドカードだけでない `sub` 条件がないと、このプロバイダ向けの信頼ポリシーを保存させません。",
      }),
      m(
        "sts",
        "runner",
        "assumed-role/deploy/GitHubActions",
        {
          en: "Credentials are exported for the following steps. If `DurationSeconds` exceeds the role max, STS rejects the call instead of clamping it.",
          ja: "認証情報が後続ステップに export されます。`DurationSeconds` がロール上限を超えると、STS は切り詰めずにエラーにします。",
        },
        {
          reply: true,
          payload: { label: "AssumeRoleWithWebIdentityResult", body: CREDS_XML },
        },
      ),
    ],
    source: {
      label: "aws-actions/configure-aws-credentials",
      href: "https://github.com/aws-actions/configure-aws-credentials",
    },
  },
  {
    id: "gitlab",
    group: "outside",
    name: { en: "GitLab CI / HCP Terraform", ja: "GitLab CI / HCP Terraform" },
    blurb: {
      en: "Same shape as GitHub: a CI-issued JWT traded for role credentials. Only the issuer, audience and sub format differ.",
      ja: "形は GitHub と同じで、CI が発行した JWT をロール認証情報と交換します。違うのは発行者・audience・sub の形式だけです。",
    },
    stsApi: "AssumeRoleWithWebIdentity",
    stsCaller: "you",
    signed: "unsigned",
    endpoint: STS_REGIONAL,
    duration: {
      en: "1 h default, up to the role max",
      ja: "既定 1 時間、ロール上限まで",
    },
    delivery: {
      en: "Env vars / provider config in the job",
      ja: "ジョブ内の環境変数やプロバイダ設定",
    },
    refresh: { en: "None; per job or run", ja: "なし。ジョブ / Run ごと" },
    lanes: [
      lane("job", "caller", "CI job", "CI ジョブ"),
      lane("ci", "idp", "CI OIDC issuer", "CI の OIDC 発行者"),
      lane("sts", "sts", "STS", "STS", STS_REGIONAL),
    ],
    steps: [
      m(
        "job",
        "ci",
        "ID token",
        {
          en: "GitLab: issuer `https://gitlab.com` (or your self-managed URL), audience set in `id_tokens`, `sub` = `project_path:<group>/<project>:ref_type:branch:ref:<name>`. HCP Terraform: issuer `https://app.terraform.io`, audience `aws.workload.identity`, `sub` = `organization:<org>:project:<p>:workspace:<ws>:run_phase:<plan|apply>`.",
          ja: "GitLab: 発行者は `https://gitlab.com` (セルフマネージドならその URL)、audience は `id_tokens` で設定、`sub` は `project_path:<group>/<project>:ref_type:branch:ref:<name>`。HCP Terraform: 発行者 `https://app.terraform.io`、audience `aws.workload.identity`、`sub` は `organization:<org>:project:<p>:workspace:<ws>:run_phase:<plan|apply>`。",
        },
        {
          payload: {
            label: ".gitlab-ci.yml",
            body: `deploy:
  id_tokens:
    AWS_TOKEN:
      aud: https://gitlab.com
  script:
    - >
      aws sts assume-role-with-web-identity
      --role-arn arn:aws:iam::123456789012:role/gitlab-deploy
      --role-session-name "gitlab-$CI_JOB_ID"
      --web-identity-token "$AWS_TOKEN"`,
          },
        },
      ),
      m("job", "sts", "AssumeRoleWithWebIdentity", {
        en: "Unsigned. HCP Terraform does this for you when `TFC_AWS_PROVIDER_AUTH=true` and `TFC_AWS_RUN_ROLE_ARN` are set (optionally separate plan and apply roles).",
        ja: "署名なしの呼び出しです。HCP Terraform では `TFC_AWS_PROVIDER_AUTH=true` と `TFC_AWS_RUN_ROLE_ARN` を設定すれば、この呼び出しを代わりに行います (plan と apply で別ロールにもできます)。",
      }),
      m(
        "sts",
        "job",
        "credentials",
        {
          en: "Wildcarding the project or workspace part of `sub` lets other projects and forks assume your role.",
          ja: "`sub` のプロジェクトやワークスペースの部分をワイルドカードにすると、他のプロジェクトやフォークからもロールを引き受けられてしまいます。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "HCP Terraform: AWS dynamic credentials",
      href: "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration",
    },
  },
  // ───────────── Humans ─────────────
  {
    id: "idc-console",
    group: "human",
    name: { en: "IAM Identity Center, console", ja: "IAM Identity Center (コンソール)" },
    blurb: {
      en: "Clicking an account in the access portal is SAML federation under the hood, into a role named AWSReservedSSO_*.",
      ja: "アクセスポータルでアカウントをクリックすると、裏では AWSReservedSSO_* ロールへの SAML フェデレーションが走ります。",
    },
    stsApi: "AssumeRoleWithSAML",
    frontDoor: "access portal Federate",
    stsCaller: "service",
    signed: "unsigned",
    endpoint: "<start-url>.awsapps.com/start",
    duration: {
      en: "Permission set session: 1 h default, up to 12 h",
      ja: "許可セットのセッション: 既定 1 時間、最大 12 時間",
    },
    delivery: { en: "Console session (browser)", ja: "コンソールセッション (ブラウザ)" },
    refresh: { en: "Sign in again from the portal", ja: "ポータルから入り直す" },
    lanes: [
      lane("user", "caller", "You (browser)", "あなた (ブラウザ)"),
      lane("portal", "idp", "Access portal", "アクセスポータル"),
      lane("sts", "sts", "STS", "STS"),
      lane("console", "resource", "Console", "コンソール"),
    ],
    steps: [
      m("user", "portal", "sign in", {
        en: "Sign in with the Identity Center directory or your external IdP. The portal session lasts 8 h by default (15 min to 7 days).",
        ja: "Identity Center のディレクトリか外部 IdP でサインインします。ポータルのセッションは既定 8 時間です (15 分〜7 日)。",
      }),
      m("user", "portal", "click account + permission set", {
        en: "Each assignment exists in the target account as a role `AWSReservedSSO_<PermissionSet>_<hash>` trusting a SAML provider `AWSSSO_<id>_DO_NOT_DELETE`.",
        ja: "各割り当ては、対象アカウントに `AWSReservedSSO_<PermissionSet>_<hash>` というロールとして存在し、SAML プロバイダ `AWSSSO_<id>_DO_NOT_DELETE` を信頼しています。",
      }),
      m("portal", "sts", "AssumeRoleWithSAML", {
        en: "CloudTrail logs this as `AssumeRoleWithSAML` with the `AWSSSO_…_DO_NOT_DELETE` provider. You cannot call `AssumeRoleWithSAML` yourself against these roles.",
        ja: "CloudTrail には `AWSSSO_…_DO_NOT_DELETE` プロバイダでの `AssumeRoleWithSAML` として記録されます。これらのロールに自分で `AssumeRoleWithSAML` を呼ぶことはできません。",
      }),
      m(
        "sts",
        "console",
        "role session (SAMLUser)",
        {
          en: 'You land in the console as a role session. Editing `AWSReservedSSO_*` roles in IAM fails with "protected role"; change the permission set instead.',
          ja: "ロールセッションとしてコンソールに入ります。IAM で `AWSReservedSSO_*` ロールを編集しようとすると「protected role」で失敗します。許可セット側を変えてください。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "Knowledge Center: Identity Center federation",
      href: "https://repost.aws/knowledge-center/iam-identity-center-federation",
    },
  },
  {
    id: "sso-cli",
    group: "human",
    name: { en: "aws sso login (CLI)", ja: "aws sso login (CLI)" },
    blurb: {
      en: "The CLI gets an OAuth token from Identity Center, then trades it for role credentials at the portal API. You never see an STS call.",
      ja: "CLI が Identity Center から OAuth トークンを取り、ポータル API でロール認証情報と交換します。STS の呼び出しは表に出てきません。",
    },
    stsApi: "Internal to Identity Center (SAML-based)",
    frontDoor: "sso:GetRoleCredentials",
    stsCaller: "service",
    signed: "n/a",
    endpoint: "portal.sso.<region>.amazonaws.com",
    duration: {
      en: "Permission set session: 1 h to 12 h",
      ja: "許可セットのセッション: 1〜12 時間",
    },
    delivery: {
      en: "Token in ~/.aws/sso/cache, credentials in memory",
      ja: "トークンは ~/.aws/sso/cache、認証情報はメモリ上",
    },
    refresh: {
      en: "With sso-session the CLI refreshes the token",
      ja: "sso-session 設定ならトークンを自動更新",
    },
    lanes: [
      lane("cli", "caller", "CLI / SDK", "CLI / SDK"),
      lane("oidc", "idp", "SSO OIDC", "SSO OIDC", "oidc.<region>.amazonaws.com"),
      lane("browser", "caller", "Browser", "ブラウザ"),
      lane(
        "portal",
        "role",
        "Portal API",
        "ポータル API",
        "portal.sso.<region>.amazonaws.com",
      ),
    ],
    steps: [
      m("cli", "oidc", "RegisterClient", {
        en: "The CLI registers itself as an OAuth client.",
        ja: "CLI が自分を OAuth クライアントとして登録します。",
      }),
      m("cli", "browser", "open /authorize (PKCE)", {
        en: "PKCE authorization code is the default since CLI 2.22.0. `--use-device-code` falls back to the device grant for hosts without a browser.",
        ja: "CLI 2.22.0 以降は PKCE の認可コードフローが既定です。ブラウザのないホストでは `--use-device-code` でデバイス認可に戻せます。",
      }),
      m(
        "browser",
        "cli",
        "code to 127.0.0.1/oauth/callback",
        {
          en: "After you approve, the code comes back to a local listener.",
          ja: "承認するとコードがローカルのリスナーに戻ってきます。",
        },
        { reply: true },
      ),
      m("cli", "oidc", "CreateToken(code, verifier)", {
        en: "The access token (and refresh token) is cached in `~/.aws/sso/cache/<sha1>.json`.",
        ja: "アクセストークン (とリフレッシュトークン) が `~/.aws/sso/cache/<sha1>.json` にキャッシュされます。",
      }),
      m(
        "cli",
        "portal",
        "GET /federation/credentials",
        {
          en: "This is `sso:GetRoleCredentials`, authorised by a bearer token, not SigV4. Its CloudTrail event source is `sso.amazonaws.com`. Whether the target account also logs `AssumeRoleWithSAML` here is unverified.",
          ja: "これが `sso:GetRoleCredentials` です。SigV4 ではなくベアラートークンで認可されます。CloudTrail のイベントソースは `sso.amazonaws.com` です。対象アカウント側にも `AssumeRoleWithSAML` が記録されるかは未検証です。",
        },
        {
          payload: {
            label: "HTTP",
            body: `GET /federation/credentials?account_id=123456789012&role_name=Developer HTTP/1.1
Host: portal.sso.us-east-1.amazonaws.com
x-amz-sso_bearer_token: aoaAAAAAGEXAMPLE...`,
          },
        },
      ),
      m(
        "portal",
        "cli",
        "{roleCredentials}",
        {
          en: "Ordinary temporary role credentials.",
          ja: "ロールの普通の一時認証情報が返ります。",
        },
        {
          reply: true,
          payload: {
            label: "200 OK",
            body: `{
  "roleCredentials": {
    "accessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalr...EXAMPLEKEY",
    "sessionToken": "IQoJb3JpZ2luX2VjEXAMPLE...",
    "expiration": 1760184000000
  }
}`,
          },
        },
      ),
    ],
    source: {
      label: "CLI: configure IAM Identity Center",
      href: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html",
    },
  },
  {
    id: "aws-login",
    group: "human",
    name: { en: "aws login (2025)", ja: "aws login (2025)" },
    blurb: {
      en: "Reuses a console sign-in to mint CLI and SDK credentials, for people who don't use Identity Center. Needs CLI 2.32.0 or later.",
      ja: "コンソールのサインインを使い回して CLI / SDK 用の認証情報を作ります。Identity Center を使っていない人向けで、CLI 2.32.0 以降が必要です。",
    },
    stsApi: "Internal to AWS Sign-In (not documented)",
    frontDoor: "signin:CreateOAuth2Token",
    stsCaller: "service",
    signed: "n/a",
    endpoint: "signin.<region>.amazonaws.com",
    duration: {
      en: "Refreshed every 15 min; session up to 12 h",
      ja: "15 分ごとに更新。セッションは最大 12 時間",
    },
    delivery: { en: "~/.aws/login/cache", ja: "~/.aws/login/cache" },
    refresh: { en: "Every 15 min, as needed", ja: "必要に応じて 15 分ごと" },
    lanes: [
      lane("cli", "caller", "CLI / SDK", "CLI / SDK"),
      lane("browser", "caller", "Browser", "ブラウザ"),
      lane(
        "signin",
        "idp",
        "AWS Sign-In",
        "AWS Sign-In",
        "signin.<region>.amazonaws.com",
      ),
    ],
    steps: [
      m("cli", "browser", "open /authorize (PKCE)", {
        en: "`aws login` starts an OAuth 2.0 authorization-code flow with PKCE. `--remote` lets you paste the code from another device.",
        ja: "`aws login` が PKCE 付き OAuth 2.0 認可コードフローを始めます。`--remote` なら別端末からコードを貼り付けられます。",
      }),
      m("browser", "signin", "pick a console session", {
        en: "Choose an active console session (root, IAM user or federated role) or sign in. This needs `signin:AuthorizeOAuth2Access`; the managed policy `SignInLocalDevelopmentAccess` grants it.",
        ja: "有効なコンソールセッション (ルート、IAM ユーザー、フェデレーションしたロール) を選ぶかサインインします。`signin:AuthorizeOAuth2Access` が必要で、マネージドポリシー `SignInLocalDevelopmentAccess` で付与できます。",
      }),
      m(
        "browser",
        "cli",
        "authorization code",
        {
          en: "The code returns to localhost (or is pasted with `--remote`).",
          ja: "コードが localhost に戻ります (`--remote` なら手で貼り付けます)。",
        },
        { reply: true },
      ),
      m("cli", "signin", "CreateOAuth2Token", {
        en: "Which STS operation Sign-In uses internally is not documented. Deny `signin:AuthorizeOAuth2Access` and `signin:CreateOAuth2Token` in an SCP to turn the feature off org-wide.",
        ja: "Sign-In が内部でどの STS 操作を使うかは公開されていません。組織全体で無効にしたければ SCP で `signin:AuthorizeOAuth2Access` と `signin:CreateOAuth2Token` を拒否します。",
      }),
      m(
        "signin",
        "cli",
        "credentials + refresh metadata",
        {
          en: "Cached in `~/.aws/login/cache`; the profile gets `login_session = <arn>`.",
          ja: "`~/.aws/login/cache` にキャッシュされ、プロファイルに `login_session = <arn>` が書かれます。",
        },
        {
          reply: true,
          payload: {
            label: "~/.aws/config",
            body: `[default]
login_session = arn:aws:iam::123456789012:user/alice
region = us-east-1`,
          },
        },
      ),
    ],
    source: {
      label: "CLI: sign in with console credentials",
      href: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html",
    },
  },
  {
    id: "saml",
    group: "human",
    name: {
      en: "SAML 2.0 IdP (Okta, Entra ID, AD FS)",
      ja: "SAML 2.0 IdP (Okta, Entra ID, AD FS)",
    },
    blurb: {
      en: "The IdP signs an assertion, the browser posts it to AWS Sign-In, and Sign-In trades it for role credentials.",
      ja: "IdP がアサーションに署名し、ブラウザがそれを AWS Sign-In に POST し、Sign-In がロール認証情報と交換します。",
    },
    stsApi: "AssumeRoleWithSAML",
    frontDoor: "signin.aws.amazon.com/saml",
    stsCaller: "service",
    signed: "unsigned",
    endpoint: "https://<region>.signin.aws.amazon.com/saml",
    duration: {
      en: "3600 s default, 900 s to the role max, capped by SessionNotOnOrAfter",
      ja: "既定 3600 秒。900 秒〜ロール上限で、SessionNotOnOrAfter が上限になる",
    },
    delivery: { en: "Console session", ja: "コンソールセッション" },
    refresh: { en: "Sign in again via the IdP", ja: "IdP から入り直す" },
    lanes: [
      lane("user", "caller", "You (browser)", "あなた (ブラウザ)"),
      lane("idp", "idp", "SAML IdP", "SAML IdP"),
      lane("signin", "role", "AWS Sign-In", "AWS Sign-In"),
      lane("sts", "sts", "STS", "STS"),
    ],
    steps: [
      m("user", "idp", "authenticate", {
        en: "IdP-initiated or SP-initiated sign-in.",
        ja: "IdP 起点でも SP 起点でもかまいません。",
      }),
      m(
        "idp",
        "user",
        "auto-POST SAMLResponse",
        {
          en: "Required attributes: `https://aws.amazon.com/SAML/Attributes/Role` (role ARN plus provider ARN) and `.../RoleSessionName`. Optional: `SessionDuration` (900 to 43200 s, console only), `SourceIdentity`, `PrincipalTag:*`.",
          ja: "必須属性は `https://aws.amazon.com/SAML/Attributes/Role` (ロール ARN とプロバイダ ARN) と `.../RoleSessionName` です。任意で `SessionDuration` (900〜43200 秒、コンソールのみ)、`SourceIdentity`、`PrincipalTag:*` も渡せます。",
        },
        {
          reply: true,
          payload: {
            label: "SAML attribute (excerpt)",
            body: `<Attribute Name="https://aws.amazon.com/SAML/Attributes/Role">
  <AttributeValue>arn:aws:iam::123456789012:role/Engineer,arn:aws:iam::123456789012:saml-provider/Okta</AttributeValue>
</Attribute>
<Attribute Name="https://aws.amazon.com/SAML/Attributes/RoleSessionName">
  <AttributeValue>alice@example.com</AttributeValue>
</Attribute>`,
          },
        },
      ),
      m("user", "signin", "POST /saml", {
        en: "The browser posts the assertion to `https://<region>.signin.aws.amazon.com/saml`.",
        ja: "ブラウザがアサーションを `https://<region>.signin.aws.amazon.com/saml` に POST します。",
      }),
      m("signin", "sts", "AssumeRoleWithSAML", {
        en: "No AWS credentials needed: STS validates the assertion with the keys in the SAML provider's metadata. The trust policy should check `SAML:aud = https://signin.aws.amazon.com/saml`.",
        ja: "AWS の認証情報は不要です。STS は SAML プロバイダのメタデータにある鍵でアサーションを検証します。信頼ポリシーでは `SAML:aud = https://signin.aws.amazon.com/saml` を確認します。",
      }),
      m(
        "sts",
        "signin",
        "role credentials",
        {
          en: "The `NameID` lands in CloudTrail, so prefer a persistent, non-PII format. These credentials cannot call `GetFederationToken` or `GetSessionToken`.",
          ja: "`NameID` は CloudTrail に残るので、永続的で個人情報を含まない形式にしておきます。この認証情報では `GetFederationToken` も `GetSessionToken` も呼べません。",
        },
        { reply: true },
      ),
      m(
        "signin",
        "user",
        "console (role picker if several Role values)",
        {
          en: "If the assertion lists several roles, you pick one.",
          ja: "アサーションに複数のロールがあれば選択画面が出ます。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "IAM: configure SAML assertions",
      href: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_saml_assertions.html",
    },
  },
  {
    id: "broker",
    group: "human",
    name: { en: "Custom broker console URL", ja: "自前ブローカーのコンソール URL" },
    blurb: {
      en: "A home-grown SSO calls STS, swaps the credentials for a sign-in token at the federation endpoint, and redirects the user into the console.",
      ja: "自前の SSO が STS を呼び、フェデレーションエンドポイントで認証情報をサインイントークンに替え、ユーザーをコンソールへリダイレクトします。",
    },
    stsApi: "AssumeRole or GetFederationToken",
    frontDoor: "signin.aws.amazon.com/federation",
    stsCaller: "you",
    signed: "signed",
    endpoint: STS_REGIONAL,
    duration: {
      en: "Sign-in URL valid 15 min; console up to 12 h (36 h with GetFederationToken)",
      ja: "サインイン URL は 15 分有効。コンソールは最大 12 時間 (GetFederationToken なら 36 時間)",
    },
    delivery: { en: "Console session", ja: "コンソールセッション" },
    refresh: { en: "The broker issues a new URL", ja: "ブローカーが URL を出し直す" },
    lanes: [
      lane("user", "caller", "User", "ユーザー"),
      lane("broker", "idp", "Your broker", "自前ブローカー"),
      lane("sts", "sts", "STS", "STS"),
      lane(
        "fed",
        "role",
        "Federation endpoint",
        "フェデレーションエンドポイント",
        "signin.aws.amazon.com",
      ),
    ],
    steps: [
      m("user", "broker", "authenticate (corporate)", {
        en: "The user signs in to your own system.",
        ja: "ユーザーが自社のシステムにサインインします。",
      }),
      m("broker", "sts", "AssumeRole (recommended)", {
        en: "`AssumeRole` is recommended. `GetFederationToken` needs long-term IAM user keys sitting in the broker.",
        ja: "推奨は `AssumeRole` です。`GetFederationToken` を使うとブローカーに IAM ユーザーの長期キーを置くことになります。",
      }),
      m(
        "broker",
        "fed",
        "Action=getSigninToken",
        {
          en: "`SessionDuration` (900 to 43200) only works with `AssumeRole*` credentials and must not be passed with `GetFederationToken` or role-chained credentials, or the call fails.",
          ja: "`SessionDuration` (900〜43200) は `AssumeRole*` の認証情報でだけ使えます。`GetFederationToken` やロールチェーンの認証情報で渡すと失敗します。",
        },
        {
          payload: {
            label: "GET",
            body: `https://signin.aws.amazon.com/federation?Action=getSigninToken
  &SessionDuration=1800
  &Session={"sessionId":"ASIAIOSFODNN7EXAMPLE","sessionKey":"wJalr...EXAMPLEKEY","sessionToken":"IQoJ...EXAMPLE"}`,
          },
        },
      ),
      m(
        "fed",
        "broker",
        '{"SigninToken":"…"}',
        {
          en: "The sign-in token is valid for 15 minutes.",
          ja: "サインイントークンの有効期限は 15 分です。",
        },
        { reply: true },
      ),
      m(
        "broker",
        "user",
        "302 Action=login&SigninToken=…",
        {
          en: "The redirect URL is a bearer secret: anyone holding it within 15 minutes gets the console.",
          ja: "このリダイレクト URL はベアラートークンと同じで、15 分以内なら持っている人は誰でもコンソールに入れます。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "IAM: custom identity broker console access",
      href: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html",
    },
  },
  {
    id: "mfa",
    group: "human",
    name: {
      en: "IAM user + MFA (GetSessionToken)",
      ja: "IAM ユーザー + MFA (GetSessionToken)",
    },
    blurb: {
      en: "Long-term keys plus a TOTP code buy a temporary session with MFA context.",
      ja: "長期キーと TOTP コードで、MFA 済みの一時セッションを手に入れます。",
    },
    stsApi: "GetSessionToken",
    stsCaller: "you",
    signed: "signed",
    endpoint: STS_REGIONAL,
    duration: {
      en: "43200 s default, 900 to 129600 s (root: 900 to 3600 s)",
      ja: "既定 43200 秒、900〜129600 秒 (ルートは 900〜3600 秒)",
    },
    delivery: {
      en: "Env vars or a profile you write",
      ja: "環境変数か、自分で書くプロファイル",
    },
    refresh: { en: "Run it again with a new code", ja: "新しいコードでもう一度実行" },
    lanes: [
      lane("user", "caller", "You (CLI)", "あなた (CLI)"),
      lane("sts", "sts", "STS", "STS"),
      lane("api", "resource", "AWS API", "AWS API"),
    ],
    steps: [
      m(
        "user",
        "sts",
        "GetSessionToken(SerialNumber, TokenCode)",
        {
          en: "Signed with the IAM user's long-term `AKIA…` keys. `aws configure mfa-login` wraps this (OTP devices only, not passkeys).",
          ja: "IAM ユーザーの長期キー `AKIA…` で署名します。`aws configure mfa-login` がこれをラップしています (OTP デバイスのみ、パスキー不可)。",
        },
        {
          payload: {
            label: "shell",
            body: `aws sts get-session-token \\
  --serial-number arn:aws:iam::123456789012:mfa/alice \\
  --token-code 123456`,
          },
        },
      ),
      m(
        "sts",
        "user",
        "ASIA… credentials",
        {
          en: "Without MFA these credentials cannot call IAM. Of STS they can only call `AssumeRole` and `GetCallerIdentity`.",
          ja: "MFA なしだとこの認証情報で IAM は呼べません。STS で呼べるのは `AssumeRole` と `GetCallerIdentity` だけです。",
        },
        { reply: true, payload: { label: "GetSessionTokenResult", body: CREDS_XML } },
      ),
      m("user", "api", "SigV4 (aws:MultiFactorAuthPresent = true)", {
        en: "Later requests carry `aws:MultiFactorAuthPresent` and `aws:MultiFactorAuthAge`, which policies can require. An alternative is `mfa_serial` in a `role_arn` profile so the CLI passes the code to `AssumeRole`.",
        ja: "以降のリクエストには `aws:MultiFactorAuthPresent` と `aws:MultiFactorAuthAge` が付き、ポリシーで要求できます。別の方法として、`role_arn` プロファイルに `mfa_serial` を書けば CLI が `AssumeRole` にコードを渡します。",
      }),
    ],
    source: {
      label: "STS API: GetSessionToken",
      href: "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html",
    },
  },
  {
    id: "cognito-enhanced",
    group: "human",
    name: {
      en: "Cognito identity pool, enhanced flow",
      ja: "Cognito ID プール (拡張フロー)",
    },
    blurb: {
      en: "A mobile or web app trades an IdP token for AWS credentials. Cognito calls STS for you.",
      ja: "モバイル / Web アプリが IdP のトークンを AWS 認証情報に替えます。STS は Cognito が代わりに呼びます。",
    },
    stsApi: "AssumeRoleWithWebIdentity",
    frontDoor: "cognito-identity:GetCredentialsForIdentity",
    stsCaller: "service",
    signed: "unsigned",
    endpoint: "cognito-identity.<region>.amazonaws.com",
    duration: { en: "1 h", ja: "1 時間" },
    delivery: { en: "In app memory", ja: "アプリのメモリ上" },
    refresh: {
      en: "The app calls GetCredentialsForIdentity again",
      ja: "アプリが GetCredentialsForIdentity を再度呼ぶ",
    },
    lanes: [
      lane("app", "caller", "App", "アプリ"),
      lane("cognito", "idp", "Cognito identity", "Cognito ID"),
      lane("sts", "sts", "STS", "STS"),
    ],
    steps: [
      m("app", "cognito", "GetId(IdentityPoolId, Logins)", {
        en: "No AWS credentials needed. `Logins` holds the IdP token (user pool ID token, OIDC, SAML or social).",
        ja: "AWS の認証情報は不要です。`Logins` には IdP のトークン (ユーザープールの ID トークン、OIDC、SAML、ソーシャル) が入ります。",
      }),
      m("app", "cognito", "GetCredentialsForIdentity", {
        en: "Cognito picks the role (default, rules, or from the token).",
        ja: "Cognito がロールを選びます (既定、ルール、またはトークンから)。",
      }),
      m("cognito", "sts", "AssumeRoleWithWebIdentity", {
        en: "Cognito calls STS on the app's behalf and applies its own scope-down session policy; you cannot set your own. The role must trust `cognito-identity.amazonaws.com` with conditions on `:aud` (the pool ID) and `:amr`.",
        ja: "Cognito がアプリの代わりに STS を呼び、独自に権限を絞るセッションポリシーを適用します (自分では設定できません)。ロールは `cognito-identity.amazonaws.com` を信頼し、`:aud` (プール ID) と `:amr` で条件を付けます。",
      }),
      m(
        "sts",
        "cognito",
        "credentials",
        { en: "Valid for one hour.", ja: "有効期限は 1 時間です。" },
        { reply: true },
      ),
      m(
        "cognito",
        "app",
        "{Credentials, IdentityId}",
        {
          en: "Missing the `aud` condition lets identities from other pools in.",
          ja: "`aud` の条件がないと、別のプールの ID でも入れてしまいます。",
        },
        { reply: true },
      ),
    ],
    source: {
      label: "Cognito: identity pool authentication flow",
      href: "https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html",
    },
  },
  {
    id: "cognito-basic",
    group: "human",
    name: {
      en: "Cognito identity pool, basic flow",
      ja: "Cognito ID プール (ベーシックフロー)",
    },
    blurb: {
      en: "The classic flow: Cognito only issues an OIDC token, and the app calls STS itself with a role it chooses.",
      ja: "従来のフローです。Cognito は OIDC トークンを出すだけで、アプリが自分で選んだロールで STS を呼びます。",
    },
    stsApi: "AssumeRoleWithWebIdentity",
    frontDoor: "cognito-identity:GetOpenIdToken",
    stsCaller: "you",
    signed: "unsigned",
    endpoint: STS_REGIONAL,
    duration: {
      en: "OpenID token 10 min; credentials per request",
      ja: "OpenID トークンは 10 分。認証情報はリクエスト次第",
    },
    delivery: { en: "In app memory", ja: "アプリのメモリ上" },
    refresh: { en: "Repeat the flow", ja: "フローをやり直す" },
    lanes: [
      lane("app", "caller", "App", "アプリ"),
      lane("cognito", "idp", "Cognito identity", "Cognito ID"),
      lane("sts", "sts", "STS", "STS"),
    ],
    steps: [
      m("app", "cognito", "GetId", {
        en: "Get an identity ID.",
        ja: "identity ID を取得します。",
      }),
      m("app", "cognito", "GetOpenIdToken", {
        en: "Cognito issues its own OIDC token, valid for 10 minutes.",
        ja: "Cognito が独自の OIDC トークンを出します。有効期限は 10 分です。",
      }),
      m("app", "sts", "AssumeRoleWithWebIdentity(RoleArn chosen by app)", {
        en: "The app picks the role. This flow is not allowed when the pool has role mappings, and AWS advises not enabling it by default.",
        ja: "ロールはアプリが選びます。プールにロールマッピングがあるとこのフローは使えず、AWS も既定で有効にしないよう勧めています。",
      }),
      m(
        "sts",
        "app",
        "credentials",
        { en: "Ordinary temporary credentials.", ja: "普通の一時認証情報が返ります。" },
        { reply: true },
      ),
    ],
    source: {
      label: "Cognito: identity pool authentication flow",
      href: "https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html",
    },
  },
  // ───────────── Special ─────────────
  {
    id: "assumeroot",
    group: "special",
    name: {
      en: "AssumeRoot (centralized root access)",
      ja: "AssumeRoot (ルートアクセスの一元管理)",
    },
    blurb: {
      en: "From the management or delegated admin account, get a root session in a member account scoped to one task.",
      ja: "管理アカウントか委任管理者アカウントから、メンバーアカウントのルートセッションを 1 タスク限定で取得します。",
    },
    stsApi: "AssumeRoot",
    stsCaller: "you",
    signed: "signed",
    endpoint: `${STS_REGIONAL} (Regional only)`,
    duration: { en: "Up to 900 s (default 900 s)", ja: "最大 900 秒 (既定 900 秒)" },
    delivery: { en: "Your shell or script", ja: "シェルやスクリプト" },
    refresh: {
      en: "None; call again for the next task",
      ja: "なし。次のタスクでまた呼ぶ",
    },
    lanes: [
      lane("admin", "caller", "Admin (mgmt / delegated)", "管理者 (管理 / 委任)"),
      lane("sts", "sts", "STS", "STS", STS_REGIONAL),
      lane("member", "resource", "Member account", "メンバーアカウント"),
    ],
    steps: [
      m(
        "admin",
        "sts",
        "AssumeRoot(TargetPrincipal, TaskPolicyArn)",
        {
          en: "The global endpoint is not supported, and root credentials cannot call it. `TaskPolicyArn` must be one of five `root-task` policies: `IAMAuditRootUserCredentials`, `IAMCreateRootUserPassword`, `IAMDeleteRootUserCredentials`, `S3UnlockBucketPolicy`, `SQSUnlockQueuePolicy`.",
          ja: "グローバルエンドポイントは非対応で、ルート認証情報からは呼べません。`TaskPolicyArn` は 5 つの `root-task` ポリシー (`IAMAuditRootUserCredentials`、`IAMCreateRootUserPassword`、`IAMDeleteRootUserCredentials`、`S3UnlockBucketPolicy`、`SQSUnlockQueuePolicy`) のどれかです。",
        },
        {
          payload: {
            label: "shell",
            body: `aws sts assume-root \\
  --region us-east-1 \\
  --target-principal 444455556666 \\
  --task-policy-arn arn=arn:aws:iam::aws:policy/root-task/S3UnlockBucketPolicy`,
          },
        },
      ),
      m(
        "sts",
        "admin",
        "root credentials (task-scoped)",
        {
          en: "Limit which task policies a caller may use with `sts:TaskPolicyArn`. SCPs and VPC endpoint policies still apply during the session.",
          ja: "`sts:TaskPolicyArn` で使えるタスクポリシーを絞れます。セッション中も SCP や VPC エンドポイントポリシーは効きます。",
        },
        { reply: true },
      ),
      m("admin", "member", "the one privileged task", {
        en: "For example, delete a bucket policy that locked everyone out.",
        ja: "たとえば、全員を締め出してしまったバケットポリシーを削除します。",
      }),
    ],
    source: {
      label: "STS API: AssumeRoot",
      href: "https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html",
    },
  },
  {
    id: "outbound",
    group: "special",
    name: {
      en: "Outbound federation (GetWebIdentityToken)",
      ja: "アウトバウンドフェデレーション (GetWebIdentityToken)",
    },
    blurb: {
      en: "The reverse direction: AWS issues a JWT for your role so an external service can trust it. You get a token, not AWS credentials.",
      ja: "逆向きの流れです。AWS があなたのロール向けに JWT を発行し、外部サービスがそれを信頼します。手に入るのは AWS の認証情報ではなくトークンです。",
    },
    stsApi: "GetWebIdentityToken",
    stsCaller: "you",
    signed: "signed",
    endpoint: `${STS_REGIONAL} (Regional only)`,
    duration: {
      en: "JWT: 60 to 3600 s, default 300 s",
      ja: "JWT: 60〜3600 秒、既定 300 秒",
    },
    delivery: {
      en: "A JWT you hand to the external service",
      ja: "外部サービスに渡す JWT",
    },
    refresh: { en: "Call again before it expires", ja: "失効前にもう一度呼ぶ" },
    lanes: [
      lane("app", "caller", "Your workload", "あなたのワークロード"),
      lane("sts", "sts", "STS", "STS", STS_REGIONAL),
      lane("ext", "resource", "External service", "外部サービス"),
      lane(
        "issuer",
        "idp",
        "AWS token issuer",
        "AWS のトークン発行者",
        "<id>.tokens.sts.global.api.aws",
      ),
    ],
    steps: [
      m(
        "app",
        "sts",
        "GetWebIdentityToken(Audience, SigningAlgorithm)",
        {
          en: "An admin first enables outbound identity federation, which gives the account an issuer `https://<account-unique-id>.tokens.sts.global.api.aws`. The call is signed with your existing role credentials: `Audience` 1 to 10 values, `SigningAlgorithm` `RS256` or `ES384`, up to 50 `Tags`.",
          ja: "まず管理者がアウトバウンド ID フェデレーションを有効にし、アカウント固有の発行者 `https://<account-unique-id>.tokens.sts.global.api.aws` ができます。呼び出しは今持っているロールの認証情報で署名します。`Audience` は 1〜10 個、`SigningAlgorithm` は `RS256` か `ES384`、`Tags` は最大 50 個です。",
        },
        {
          payload: {
            label: "shell",
            body: `aws sts get-web-identity-token \\
  --region us-east-1 \\
  --audience https://api.example.com \\
  --signing-algorithm ES384 \\
  --duration-seconds 300`,
          },
        },
      ),
      m(
        "sts",
        "app",
        "{WebIdentityToken: JWT, Expiration}",
        {
          en: "`sub` is your principal ARN. AWS-specific claims sit under the `https://sts.amazonaws.com/` namespace (`aws_account`, `org_id`, `principal_tags`, `source_region` and more). A token cannot outlive the calling session (`SessionDurationEscalation`).",
          ja: "`sub` はプリンシパルの ARN です。AWS 固有のクレームは `https://sts.amazonaws.com/` 名前空間の下に入ります (`aws_account`、`org_id`、`principal_tags`、`source_region` など)。トークンの有効期限は呼び出し元セッションを超えられません (`SessionDurationEscalation`)。",
        },
        {
          reply: true,
          payload: {
            label: "decoded JWT payload (excerpt)",
            body: `{
  "iss": "https://EXAMPLE1-2b3c-4d5e.tokens.sts.global.api.aws",
  "aud": "https://api.example.com",
  "sub": "arn:aws:iam::123456789012:role/reporter",
  "https://sts.amazonaws.com/": {
    "aws_account": "123456789012",
    "source_region": "us-east-1"
  }
}`,
          },
        },
      ),
      m("app", "ext", "Authorization: Bearer <JWT>", {
        en: "Present the token to the external service.",
        ja: "外部サービスにトークンを提示します。",
      }),
      m("ext", "issuer", "GET /.well-known/jwks.json", {
        en: "The service verifies the signature, `iss`, `aud`, `sub` and `exp`. It must pin your account's issuer: trusting all of `*.tokens.sts.global.api.aws` would trust every AWS account.",
        ja: "サービス側は署名・`iss`・`aud`・`sub`・`exp` を検証します。発行者はアカウント固有のものに固定してください。`*.tokens.sts.global.api.aws` 全体を信頼すると、すべての AWS アカウントを信頼したことになります。",
      }),
    ],
    source: {
      label: "STS API: GetWebIdentityToken",
      href: "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html",
    },
  },
];

export const GROUPS: { id: Group; label: L }[] = [
  { id: "aws", label: { en: "Workloads on AWS", ja: "AWS 上のワークロード" } },
  { id: "outside", label: { en: "Workloads outside AWS", ja: "AWS の外のワークロード" } },
  { id: "human", label: { en: "Humans", ja: "人間" } },
  { id: "special", label: { en: "Special", ja: "特殊なもの" } },
];

export const CALLER_LABEL: Record<StsCaller, L> = {
  you: { en: "Your code", ja: "あなたのコード" },
  service: { en: "AWS service", ja: "AWS のサービス" },
};

export const SIGNED_LABEL: Record<PathDef["signed"], L> = {
  signed: { en: "SigV4-signed", ja: "SigV4 署名あり" },
  unsigned: { en: "Unsigned (token is the proof)", ja: "署名なし (トークンが証明)" },
  "n/a": { en: "Not your request", ja: "自分では送らない" },
};

export const pathById = (id: string) => PATHS.find((p) => p.id === id);
