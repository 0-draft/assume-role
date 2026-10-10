import type { Lane, Message } from "@/components/ui/Sequence";

const ROLE_A = "arn:aws:iam::111122223333:role/VendorScanner";

export const DEPUTY_LANES: Lane[] = [
  {
    id: "a",
    label: { en: "Customer A", ja: "顧客 A" },
    actor: "role",
    sub: "111122223333",
  },
  {
    id: "vendor",
    label: { en: "SaaS vendor", ja: "SaaS ベンダー" },
    actor: "caller",
    sub: "999988887777",
  },
  {
    id: "b",
    label: { en: "Customer B (attacker)", ja: "顧客 B (攻撃者)" },
    actor: "deny",
    sub: "444455556666",
  },
  {
    id: "sts",
    label: { en: "AWS STS", ja: "AWS STS" },
    actor: "sts",
    sub: "sts.<region>.amazonaws.com",
  },
];

export const DEPUTY_STEPS: Message[] = [
  {
    from: "vendor",
    to: "a",
    label: { en: "your ExternalId: ext-A", ja: "あなたの ExternalId: ext-A" },
    detail: {
      en: "The vendor generates a unique external ID for each customer and keeps it under its own control. Customers do not choose it.",
      ja: "ベンダーは顧客ごとに一意な外部 ID を生成し、自分の管理下に置きます。顧客が自分で決めるものではありません。",
    },
  },
  {
    from: "a",
    to: "vendor",
    label: {
      en: `role ARN: …:role/VendorScanner`,
      ja: `ロール ARN: …:role/VendorScanner`,
    },
    detail: {
      en: "Customer A creates a role that trusts the vendor's account and requires `sts:ExternalId` = ext-A, then registers the role ARN with the vendor.",
      ja: "顧客 A はベンダーのアカウントを信頼し、`sts:ExternalId` = ext-A を必須にしたロールを作り、そのロール ARN をベンダーに登録します。",
    },
    payload: {
      label: "trust policy (customer A)",
      body: JSON.stringify(
        {
          Effect: "Allow",
          Principal: { AWS: "arn:aws:iam::999988887777:role/VendorScanner" },
          Action: "sts:AssumeRole",
          Condition: { StringEquals: { "sts:ExternalId": "ext-A" } },
        },
        null,
        2,
      ),
    },
  },
  {
    from: "b",
    to: "vendor",
    label: { en: "my role ARN: (A's ARN)", ja: "私のロール ARN: (A の ARN)" },
    detail: {
      en: "Customer B signs up and registers **A's** role ARN as its own. Role ARNs are not secrets: they show up in docs, screenshots and error messages.",
      ja: "顧客 B は登録時に **A の** ロール ARN を自分のものとして入力します。ロール ARN は秘密ではありません。ドキュメントやスクリーンショット、エラーメッセージに普通に出てきます。",
    },
  },
  {
    from: "vendor",
    to: "sts",
    label: {
      en: "AssumeRole(A's role, ExternalId=ext-B)",
      ja: "AssumeRole(A のロール, ExternalId=ext-B)",
    },
    detail: {
      en: "When the vendor runs B's job it always sends the external ID **it issued to B**. Without that rule, the vendor would happily act as a confused deputy and read A's account for B.",
      ja: "B のジョブを実行するとき、ベンダーは必ず **B に発行した** 外部 ID を送ります。この決まりがなければ、ベンダーは混乱した代理人 (Confused Deputy) として B のために A のアカウントを読んでしまいます。",
    },
    payload: {
      label: "request",
      body: `aws sts assume-role \\\n  --role-arn ${ROLE_A} \\\n  --role-session-name job-for-customer-b \\\n  --external-id ext-B`,
    },
  },
  {
    from: "sts",
    to: "sts",
    label: {
      en: "ext-B ≠ ext-A",
      ja: "ext-B ≠ ext-A",
    },
    detail: {
      en: "STS evaluates A's trust policy. The principal matches (it really is the vendor), but the `sts:ExternalId` condition does not.",
      ja: "STS が A の信頼ポリシーを評価します。プリンシパルは一致します (本当にベンダーなので) が、`sts:ExternalId` の条件が一致しません。",
    },
  },
  {
    from: "sts",
    to: "vendor",
    reply: true,
    label: { en: "AccessDenied", ja: "AccessDenied" },
    detail: {
      en: "Denied. B never gets into A's account. Jobs the vendor runs for A send ext-A and still succeed.",
      ja: "拒否。B は A のアカウントに入れません。ベンダーが A のために動かすジョブは ext-A を送るので、これまでどおり成功します。",
    },
    payload: {
      label: "error",
      body: `An error occurred (AccessDenied) when calling the AssumeRole operation:\nUser: arn:aws:sts::999988887777:assumed-role/VendorScanner/worker\nis not authorized to perform: sts:AssumeRole on resource:\n${ROLE_A}`,
    },
  },
];
