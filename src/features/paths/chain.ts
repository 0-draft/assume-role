import type { L } from "@/i18n/lang";

/**
 * Default credential provider chains, simplified to the sources a reader can
 * toggle. Orders follow docs/05-credential-paths.md ("Default Credential
 * Provider Chains"). Command-line options, code parameters and Java system
 * properties sit in front of every chain and are left out here.
 */

export type Sdk = "cli" | "boto3" | "java" | "go";

/** What the active profile in ~/.aws/config or ~/.aws/credentials contains. */
export type ProfileKind = "none" | "static" | "role" | "sso";

export interface Sources {
  /** AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in the environment. */
  envKeys: boolean;
  /** AWS_ROLE_ARN + AWS_WEB_IDENTITY_TOKEN_FILE in the environment (IRSA, CI). */
  webIdentity: boolean;
  profile: ProfileKind;
  /** AWS_CONTAINER_CREDENTIALS_RELATIVE_URI / _FULL_URI (ECS, Pod Identity). */
  container: boolean;
  /** Running on EC2 with IMDS reachable. */
  imds: boolean;
}

export type ProviderId =
  "env" | "role" | "webIdentity" | "static" | "sso" | "profile" | "container" | "imds";

export const PROVIDER_LABEL: Record<ProviderId, L> = {
  env: { en: "Environment variables", ja: "環境変数" },
  role: {
    en: "Assume role (role_arn profile)",
    ja: "AssumeRole (role_arn プロファイル)",
  },
  webIdentity: { en: "Web identity token", ja: "Web ID トークン" },
  static: { en: "Credentials file (static keys)", ja: "credentials ファイル (静的キー)" },
  sso: { en: "IAM Identity Center (SSO)", ja: "IAM Identity Center (SSO)" },
  profile: {
    en: "Shared profile (role, SSO, static, process, login)",
    ja: "共有プロファイル (role / SSO / 静的キー / process / login)",
  },
  container: { en: "Container credentials", ja: "コンテナ認証情報" },
  imds: { en: "EC2 instance metadata (IMDS)", ja: "EC2 インスタンスメタデータ (IMDS)" },
};

export const CHAINS: Record<Sdk, ProviderId[]> = {
  // env, assume role, web identity, credentials file, (process), config file
  // (where SSO lives), container, instance profile.
  cli: ["env", "role", "webIdentity", "static", "sso", "container", "imds"],
  // env, assume role, web identity, Identity Center, credentials file,
  // (login, config file), container, IMDS.
  boto3: ["env", "role", "webIdentity", "sso", "static", "container", "imds"],
  // Java and Go resolve one profile in a single provider whatever it holds.
  java: ["env", "webIdentity", "profile", "container", "imds"],
  go: ["env", "webIdentity", "profile", "container", "imds"],
};

export const SDK_LABEL: Record<Sdk, string> = {
  cli: "AWS CLI",
  boto3: "Boto3",
  java: "Java 2.x",
  go: "Go v2",
};

/** Does this provider find credentials given what is present? */
export function provides(p: ProviderId, s: Sources): boolean {
  switch (p) {
    case "env":
      return s.envKeys;
    case "webIdentity":
      return s.webIdentity;
    case "role":
      return s.profile === "role";
    case "static":
      return s.profile === "static";
    case "sso":
      return s.profile === "sso";
    case "profile":
      return s.profile !== "none";
    case "container":
      return s.container;
    case "imds":
      return s.imds;
  }
}

export interface Resolution {
  order: ProviderId[];
  /** First provider that finds credentials, or null when nothing does. */
  winner: ProviderId | null;
  /** Providers that also had credentials but never got asked. */
  shadowed: ProviderId[];
}

/** Walk the chain; first match wins. */
export function resolve(sdk: Sdk, s: Sources): Resolution {
  const order = CHAINS[sdk];
  const hits = order.filter((p) => provides(p, s));
  return { order, winner: hits[0] ?? null, shadowed: hits.slice(1) };
}
