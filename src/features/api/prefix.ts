import type { L } from "@/i18n/lang";

/** Kind of thing an identifier names, which decides what you can do with it. */
export type IdKind = "long-term-key" | "temp-key" | "principal" | "other";

export interface PrefixEntry {
  prefix: string;
  kind: IdKind;
  label: L;
}

/**
 * Unique ID prefixes from the IAM User Guide ("Understanding unique ID
 * prefixes"). AWS notes prefixes may vary with when an ID was created.
 */
export const PREFIXES: PrefixEntry[] = [
  {
    prefix: "ABIA",
    kind: "other",
    label: { en: "AWS STS service bearer token", ja: "AWS STS サービスベアラートークン" },
  },
  {
    prefix: "ACCA",
    kind: "other",
    label: { en: "Context-specific credential", ja: "コンテキスト固有の認証情報" },
  },
  {
    prefix: "AGPA",
    kind: "principal",
    label: { en: "User group", ja: "ユーザーグループ" },
  },
  { prefix: "AIDA", kind: "principal", label: { en: "IAM user", ja: "IAM ユーザー" } },
  {
    prefix: "AIPA",
    kind: "other",
    label: {
      en: "Amazon EC2 instance profile",
      ja: "Amazon EC2 インスタンスプロファイル",
    },
  },
  {
    prefix: "AKIA",
    kind: "long-term-key",
    label: { en: "Access key (long-term)", ja: "アクセスキー (長期)" },
  },
  {
    prefix: "ANPA",
    kind: "other",
    label: { en: "Managed policy", ja: "マネージドポリシー" },
  },
  {
    prefix: "ANVA",
    kind: "other",
    label: { en: "Version in a managed policy", ja: "マネージドポリシーのバージョン" },
  },
  { prefix: "APKA", kind: "other", label: { en: "Public key", ja: "公開鍵" } },
  { prefix: "AROA", kind: "principal", label: { en: "Role", ja: "ロール" } },
  { prefix: "ASCA", kind: "other", label: { en: "Certificate", ja: "証明書" } },
  {
    prefix: "ASIA",
    kind: "temp-key",
    label: {
      en: "Temporary (AWS STS) access key ID",
      ja: "一時 (AWS STS) アクセスキー ID",
    },
  },
];

export type Decoded =
  | { status: "empty" }
  | { status: "short" }
  | { status: "account"; account: string; name?: string }
  | { status: "unknown"; prefix: string }
  | { status: "match"; entry: PrefixEntry; session?: string };

/**
 * Identify an AWS identifier by its first four characters. Also understands
 * the two other shapes `aws:userid` takes: `AROA…:session` for role sessions
 * and `123456789012:name` for federated users.
 */
export function decodeId(raw: string): Decoded {
  const s = raw.trim();
  if (!s) return { status: "empty" };
  const acct = /^(\d{12})(?::(.+))?$/.exec(s);
  if (acct) return { status: "account", account: acct[1], name: acct[2] };
  if (s.length < 4) return { status: "short" };
  const [id, ...rest] = s.split(":");
  const prefix = id.slice(0, 4).toUpperCase();
  const entry = PREFIXES.find((p) => p.prefix === prefix);
  if (!entry) return { status: "unknown", prefix };
  const session = rest.length ? rest.join(":") : undefined;
  return session ? { status: "match", entry, session } : { status: "match", entry };
}
