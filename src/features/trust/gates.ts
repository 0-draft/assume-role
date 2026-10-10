import type { L } from "@/i18n/lang";

export type Account = "same" | "cross";
/** How the role's trust policy names the caller. */
export type Naming = "direct" | "root" | "self";

export interface GateInput {
  account: Account;
  naming: Naming;
  /** Caller's identity policy allows sts:AssumeRole on the role ARN. */
  identityAllows: boolean;
  /** Role's trust policy allows this caller (named as `naming`). */
  trustAllows: boolean;
}

export type GateState = "pass" | "fail" | "skip";

export interface GateResult {
  /** Gate 1: the caller's identity policy. */
  identity: GateState;
  /** Gate 2: the role's trust policy. */
  trust: GateState;
  allowed: boolean;
  why: L;
}

/**
 * Two-gate model of an AssumeRole call (IAM policy evaluation, ignoring SCPs,
 * RCPs and permissions boundaries, which can only deny further):
 *
 * - The trust policy must always explicitly allow the caller.
 * - Same account with the caller named directly: the trust policy acts as a
 *   resource-based policy, so no identity-policy grant is needed.
 * - Same account via `:root`, or any cross-account call: the caller's identity
 *   policy must also allow sts:AssumeRole on the role.
 * - A role assuming itself must be named in its own trust policy since
 *   2022-09-21; an identity-policy grant alone no longer works.
 */
export function evaluateGates(input: GateInput): GateResult {
  const naming: Naming =
    input.account === "cross" && input.naming === "self" ? "direct" : input.naming;
  const { account, identityAllows, trustAllows } = input;
  const needsIdentity = !(account === "same" && naming !== "root");

  if (!trustAllows) {
    if (naming === "self" && identityAllows) {
      return {
        identity: "pass",
        trust: "fail",
        allowed: false,
        why: {
          en: "Denied. Since 2022-09-21 a role no longer trusts itself implicitly: its own trust policy must name it. Before that date, the identity-policy grant alone was enough (a small allow list of legacy roles kept the old behaviour).",
          ja: "拒否。2022-09-21 以降、ロールは自分自身を暗黙には信頼しません。自分の信頼ポリシーに自分の ARN を書く必要があります。それ以前は ID ポリシーの許可だけで通っていました (旧挙動を使っていた一部のロールだけ許可リストで例外扱い)。",
        },
      };
    }
    return {
      identity: needsIdentity ? (identityAllows ? "pass" : "fail") : "skip",
      trust: "fail",
      allowed: false,
      why: {
        en: "Denied. A role's trust policy must explicitly allow the caller, even inside the same account. No identity policy can make up for a missing trust grant.",
        ja: "拒否。同じアカウント内でも、ロールの信頼ポリシーが呼び出し元を明示的に許可していなければ通りません。ID ポリシー側で何を許可しても補えません。",
      },
    };
  }

  if (!needsIdentity) {
    return {
      identity: "skip",
      trust: "pass",
      allowed: true,
      why:
        naming === "self"
          ? {
              en: "Allowed. The trust policy names the role itself, which acts as a same-account resource-based grant. Re-assuming your own role is how you scope a session down with session tags or a session policy.",
              ja: "許可。信頼ポリシーがロール自身を名指ししているので、同一アカウントのリソースベースの許可として扱われます。自分のロールを引き受け直すのは、セッションタグやセッションポリシーで権限を絞りたいときの定番です。",
            }
          : {
              en: "Allowed. In the same account, a trust policy that names this exact user or role works like a resource-based policy: no identity-policy grant is needed. A permissions boundary on the caller, if any, must still allow sts:AssumeRole.",
              ja: "許可。同一アカウントで信頼ポリシーがこのユーザーやロールを名指ししている場合、信頼ポリシーがリソースベースのポリシーとして働くので ID ポリシー側の許可は要りません。ただし呼び出し元に アクセス許可の境界 があれば、そこで sts:AssumeRole が許可されている必要があります。",
            },
    };
  }

  if (!identityAllows) {
    return {
      identity: "fail",
      trust: "pass",
      allowed: false,
      why:
        account === "cross"
          ? {
              en: "Denied. Across accounts both sides must agree: the role's account trusts the caller, and the caller's own account must grant sts:AssumeRole on that role ARN.",
              ja: "拒否。クロスアカウントでは両側の合意が必要です。ロール側のアカウントが信頼し、さらに呼び出し元のアカウントがそのロール ARN への sts:AssumeRole を許可していなければなりません。",
            }
          : {
              en: "Denied. Trusting the account (`:root`) delegates the decision to that account's administrators, so the caller's identity policy must grant sts:AssumeRole on the role.",
              ja: "拒否。アカウント (`:root`) を信頼するのは「誰に使わせるかはそのアカウントの管理者が決める」という委任なので、呼び出し元の ID ポリシーで sts:AssumeRole を許可する必要があります。",
            },
    };
  }

  return {
    identity: "pass",
    trust: "pass",
    allowed: true,
    why: {
      en: "Allowed. Both gates open: the caller's identity policy grants sts:AssumeRole on the role, and the role's trust policy allows the caller. SCPs on the caller's account and RCPs on the role's account still have to allow it.",
      ja: "許可。両方のゲートが開きました。呼び出し元の ID ポリシーがロールへの sts:AssumeRole を許可し、ロールの信頼ポリシーも呼び出し元を許可しています。呼び出し元アカウントの SCP とロール側アカウントの RCP も通る必要はあります。",
    },
  };
}
