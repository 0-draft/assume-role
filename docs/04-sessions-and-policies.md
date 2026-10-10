# STS Session Mechanics and Policy Evaluation

This chapter covers what happens after AWS STS returns credentials: who is allowed to obtain a session, what the session can do, which attributes (tags, source identity, context) ride inside the session token, how long a session lives, and how to kill it. Every claim cites official AWS documentation as of 2026-10-10. Anything not confirmed in AWS documentation is marked "(unverified)".

## 1. Two gates: the trust policy and the caller's identity policy

Every `AssumeRole*` call passes two independent authorization checks:

1. **Trust policy of the target role** (a resource-based policy attached to the role) must allow the caller's principal to perform `sts:AssumeRole`, `sts:AssumeRoleWithSAML`, or `sts:AssumeRoleWithWebIdentity`, plus any permission-only actions the request triggers (`sts:TagSession`, `sts:SetSourceIdentity`, `sts:SetContext`).
2. **Identity-based policy of the caller** must allow the same action on the role ARN, with the exceptions described below.

The role trust policy is special among resource-based policies: IAM role trust policies and AWS KMS key policies "must explicitly allow access for principals", even within the same account ([policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)). An identity policy granting `sts:AssumeRole` on `*` is useless if the trust policy does not name the caller.

### 1.1 Principal types in a trust policy

| Principal key | Example value | Used with | Notes |
| --- | --- | --- | --- |
| `AWS` (account) | `arn:aws:iam::111122223333:root` or `111122223333` | `sts:AssumeRole` | Delegates to the account, not to the root user; the account must then grant `sts:AssumeRole` to its own identities ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)) |
| `AWS` (role) | `arn:aws:iam::111122223333:role/Deployer` | `sts:AssumeRole` | Stored as the role's unique ID (`AROA...`) when saved |
| `AWS` (user) | `arn:aws:iam::111122223333:user/alice` | `sts:AssumeRole` | Stored as the user's unique ID (`AIDA...`); user name part is case sensitive |
| `AWS` (role session) | `arn:aws:sts::111122223333:assumed-role/Deployer/ci-run-42` | `sts:AssumeRole` | Allowed, but AWS recommends role principals instead of session principals |
| `AWS` (STS federated user) | `arn:aws:sts::111122223333:federated-user/jane` | resource policies | Session from `GetFederationToken`; cannot assume roles (see section 6) |
| `Service` | `ec2.amazonaws.com`, `lambda.amazonaws.com` | `sts:AssumeRole` | `"Service": "*"` is not allowed; use the non-regional service principal in trust policies |
| `Federated` (SAML) | `arn:aws:iam::111122223333:saml-provider/Okta` | `sts:AssumeRoleWithSAML` | Provider must exist in IAM |
| `Federated` (OIDC) | `arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com` | `sts:AssumeRoleWithWebIdentity` | OIDC provider must be in the same account as the role ([trust policy blog](https://aws.amazon.com/blogs/security/how-to-use-trust-policies-with-iam-roles/)) |
| `Federated` (built-in OIDC) | `cognito-identity.amazonaws.com`, `accounts.google.com`, `www.amazon.com`, `graph.facebook.com` | `sts:AssumeRoleWithWebIdentity` | Four built-in IdPs need no IAM provider resource |
| `*` | `"Principal": "*"` | any | Strongly discouraged for trust policies; must be constrained by `Condition` |

Wildcards cannot match part of a principal ARN, and user groups cannot be principals ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)).

### 1.2 Actions that appear in trust policies

The [Service Authorization Reference for STS](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html) maps one `AssumeRole` API call to up to four IAM actions:

| API operation | IAM action(s) authorized | Access level |
| --- | --- | --- |
| `AssumeRole` | `sts:AssumeRole`, `sts:SetContext`, `sts:SetSourceIdentity`, `sts:TagSession` | Write / Tagging |
| `AssumeRoleWithSAML` | `sts:AssumeRoleWithSAML` (+ `sts:TagSession`, `sts:SetSourceIdentity` when used) | Write |
| `AssumeRoleWithWebIdentity` | `sts:AssumeRoleWithWebIdentity` (+ `sts:TagSession`, `sts:SetSourceIdentity` when used) | Write |
| `GetFederationToken` | `sts:GetFederationToken`, `sts:TagSession` | Write / Tagging |
| `AssumeRoot` | `sts:AssumeRoot` (condition key `sts:TaskPolicyArn`) | Write |

`sts:TagSession`, `sts:SetSourceIdentity`, and `sts:SetContext` are permission-only actions: they are never called directly, they are evaluated only when the request carries tags, a source identity, or provided contexts ([Service Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)).

### 1.3 Same-account vs cross-account

| Scenario | Trust policy must | Caller identity policy must |
| --- | --- | --- |
| Same account, trust policy names the specific user/role ARN | Allow the principal | Nothing required ("that principal doesn't need an explicit entitlement in its identity-attached policy", [trust policy blog](https://aws.amazon.com/blogs/security/how-to-use-trust-policies-with-iam-roles/)) |
| Same account, trust policy names the account (`:root`) | Allow the account | Allow `sts:AssumeRole` on the role ARN ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)) |
| Cross account (any form) | Allow the other account or a principal in it | Allow `sts:AssumeRole` on the role ARN; the administrator of the caller's account "must attach a policy that allows the user to call `AssumeRole` for the ARN of the role in the other account" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)) |

The same-account shortcut exists because "the role's trust policy acts as an IAM resource-based policy. When a resource-based policy grants access to a principal in the same account, no additional identity-based policy is required" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). A permissions boundary on the caller still applies: "If a permissions boundary is set for the user, then it must allow the `sts:AssumeRole` action" ([Update a role trust policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_update-role-trust-policy.html)). SCPs on the caller's account and RCPs on the role's account also apply (section 2).

The same two-sided rule applies to permission-only actions. For source identity across accounts, `sts:SetSourceIdentity` must be in both "the permissions policy of the principal in the originating account and in the role trust policy of the role in the target account" ([source identity guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html)).

### 1.4 Roles no longer implicitly trust themselves (September 21, 2022)

Before September 21, 2022, a role whose identity policy allowed `sts:AssumeRole` on itself could assume itself even if its trust policy did not name it. AWS changed this: for "any new role, or any role that has not recently assumed itself while relying on the old behavior", the trust policy must explicitly name the role ([Announcing an update to IAM role trust policy behavior](https://aws.amazon.com/blogs/security/announcing-an-update-to-iam-role-trust-policy-behavior/)). A small allow list of legacy roles kept the old behavior; for those, CloudTrail `AssumeRole` events carry `additionalEventData.explicitTrustGrant` (`false` when the legacy path was used, `true` when the trust policy now allows it explicitly) ([CloudTrail integration](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).

Self-assumption is still useful when you want to re-scope your own session with session tags or a session policy: "if you intend to pass session tags or a session policy, you need to assume the current role again" ([Update a role trust policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_update-role-trust-policy.html)).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSelfAssumeForScopeDown",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/BatchWorker" },
      "Action": ["sts:AssumeRole", "sts:TagSession"]
    }
  ]
}
```

## 2. Effective permissions of a session

### 2.1 Policy types that touch a role session

| Policy type | Attached to | Grants? | Effect on the session |
| --- | --- | --- | --- |
| Role identity policies (inline + managed) | The role | Yes | Upper bound of what the session can do via identity |
| Session policy (inline `Policy` + up to 10 `PolicyArns`) | The session, at creation | No | Intersected with identity policies |
| Permissions boundary | The role | No | Intersected with identity policies |
| SCP | Caller's account / OU / root | No | Must allow; does not affect management-account principals or service-linked roles ([SCPs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)) |
| RCP | Resource's account / OU / root | No | Must allow; STS was a launch service for RCPs ([RCP launch blog](https://aws.amazon.com/blogs/aws/introducing-resource-control-policies-rcps-a-new-authorization-policy/)) |
| Resource-based policy | The target resource | Yes | Can add permissions; how much depends on which ARN it names (2.3) |

### 2.2 Evaluation order (single account)

The AWS enforcement code evaluates, in this order ([policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)):

1. **Explicit deny anywhere** (SCPs, RCPs, resource-based, identity-based, permissions boundary, session policy) -> final **Deny**.
2. **RCPs**: no applicable `Allow` -> **Deny**. `RCPFullAWSAccess` is attached automatically when RCPs are enabled and cannot be detached.
3. **SCPs**: no applicable `Allow` -> **Deny**.
4. **Resource-based policy**: an `Allow` that names the IAM user or the session principal directly can produce **Allow** even if identity, boundary, or session policy implicitly deny.
5. **Identity-based policies**: no `Allow` -> **Deny**.
6. **Permissions boundary**: present and does not allow -> **Deny**.
7. **Session policy**: if the principal is a session principal and a session policy was passed, it must allow. If no session policy was passed, "a default session policy is created" and evaluation returns **Allow**.

For cross-account requests, both the identity side (trusted account) and the resource-based policy (trusting account) must allow ([policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)).

### 2.3 Diagram: what a role session can do

The effective permission set is easiest to picture as nested filters. Text description for a visualization:

```text
                         +----------------------------------------------+
 Request from a          |  1. Any explicit Deny? (SCP, RCP, resource,  |--yes--> DENY
 role session  --------> |     identity, boundary, session policy)      |
                         +----------------------+-----------------------+
                                                | no
                         +----------------------v-----------------------+
                         |  2. RCP on resource account allows?          |--no---> DENY
                         +----------------------+-----------------------+
                                                | yes
                         +----------------------v-----------------------+
                         |  3. SCP on caller account allows?            |--no---> DENY
                         +----------------------+-----------------------+
                                                | yes
                         +----------------------v-----------------------+
                         |  4. Resource policy names the SESSION ARN    |--yes--> ALLOW
                         |     (same account)?                          |         (not limited by
                         +----------------------+-----------------------+          boundary/session policy)
                                                | no
                         +----------------------v-----------------------+
                         |  5. ALLOWED = (identity policies             |
                         |               OR resource policy naming      |
                         |                  the ROLE ARN)               |
                         |            AND permissions boundary          |
                         |            AND session policies              |
                         +----------------------------------------------+
```

As a set formula (same account, no explicit deny, SCP and RCP allow):

```text
Effective(session) = ResourcePolicy(session ARN)
                   ∪ ( (Identity ∪ ResourcePolicy(role ARN)) ∩ Boundary ∩ SessionPolicy )
```

### 2.4 Session ARN vs role ARN in resource-based policies

This distinction changes the result ([IAM policies overview](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html), [policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)):

- **Resource policy names the role ARN** (`arn:aws:iam::111122223333:role/R`, either in `Principal` or via `aws:PrincipalArn`): permissions are "added to the role or user's identity-based policy before the session is created", so they are limited by an implicit deny in a permissions boundary or session policy.
- **Resource policy names the session ARN** (`arn:aws:sts::111122223333:assumed-role/R/session`): permissions are "added after the session is created" and "are not limited by the session policy". Within the same account they are also not limited by an implicit deny in identity policies or the permissions boundary.
- **Exception**: `"Principal": "*"` combined with an `aws:PrincipalArn` condition on the role ARN is not limited by boundaries or session policies unless they contain an explicit deny ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)).
- **STS federated users** follow the same split: granting the `federated-user` ARN grants the session directly; granting the ARN of the IAM user who federated is limited by boundary and session policy.

## 3. Session policies

Session policies are passed at session creation and can only reduce permissions: "You cannot use session policies to grant more permissions than those allowed by the identity-based policy of the role that is being assumed" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). They are supported on `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, and are required in practice on `GetFederationToken` (without them a federated user has no permissions) ([IAM policies overview](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)).

### 3.1 Limits

| Item | Limit | Source |
| --- | --- | --- |
| Inline session policies per call | 1 JSON document (`Policy`) | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |
| Managed session policies per call | 10 ARNs (`PolicyArns`), same account as the role | [AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) |
| Plaintext size | Inline JSON + all managed ARN characters combined <= 2,048 characters | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |
| Allowed characters | Tab, LF, CR, and U+0020 through U+00FF | [AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) |
| Session token size | Separate, undocumented byte limit; session policies and tags both count | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |

### 3.2 Packed policy size and token utilization

AWS packs (compresses) session policies and session tags into the session token. Passing a policy within the 2,048-character limit can still fail with `PackedPolicyTooLarge` (HTTP 400): "The request was rejected because the session token exceeded the maximum allowed size... Session policies and session tags add to the session token size... You might receive this error even though you meet the individual session policy and session tag limits" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)).

Response fields that report this:

| Field | Meaning | Status |
| --- | --- | --- |
| `PackedPolicySize` | Percentage (0-100) of the maximum allowed token size consumed | Deprecated; "Use `SessionTokenUtilization` instead" |
| `SessionTokenUtilization` | Percentage (0-100) of the maximum allowed token size consumed | Current |
| `SessionTokenSize` | Size in bytes of the returned session token | Current |

A newer request parameter, `MinimumSessionTokenSize` (0-4,096 bytes), pads the session token to at least that size "regardless of its actual content" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). AWS also warns that "The size of the security token that AWS STS API operations return is not fixed. We strongly recommend that you make no assumptions about the maximum size", and that the AWS Management Console "might increase the session token size by adding session information" ([Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)). Marking a tag as transitive "does not impact its packed binary size" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)).

### 3.3 Example: scope a broad CI role down per job

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::111122223333:role/CiDeployer \
  --role-session-name build-8812 \
  --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject"],"Resource":"arn:aws:s3:::artifacts-bucket/build-8812/*"}]}' \
  --policy-arns arn=arn:aws:iam::111122223333:policy/DenyIamWrites \
  --duration-seconds 900 \
  --query '{Arn:AssumedRoleUser.Arn,Util:SessionTokenUtilization}'
```

The resulting session can write only under `build-8812/` and only if `CiDeployer`'s identity policies also allow it.

## 4. Session tags

Session tags are key-value attributes stored in the session. Requests made with the session include them as `aws:PrincipalTag/<key>` ([session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)).

### 4.1 Sources of principal tags in a session

1. Session tags passed in the current request.
2. Incoming transitive session tags inherited from the previous session in a role chain.
3. IAM tags attached to the assumed role.

A session tag with the same key as a role tag overrides it, and tag keys are case-insensitive but case-preserving (`Department` and `department` collide) ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). If the caller passes a session tag whose key matches an inherited transitive tag, "the operation fails" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)).

### 4.2 Limits and rules

| Rule | Value | Source |
| --- | --- | --- |
| Max session tags per request | 50 | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |
| Tag key length | 128 characters | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |
| Tag value length | 256 characters (may be empty) | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |
| Max `TransitiveTagKeys` | 50 items, each 1-128 characters | [AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) |
| Multi-valued tags | Not supported | [session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html) |
| Console Switch Role | Cannot pass session tags | [session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html) |
| Size | Counts toward the packed session token size | [session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html) |

### 4.3 How each API carries tags

| Operation | How tags are passed | How transitive keys are set |
| --- | --- | --- |
| `AssumeRole` | `Tags` / `--tags` | `TransitiveTagKeys` / `--transitive-tag-keys` |
| `AssumeRoleWithSAML` | SAML attribute `https://aws.amazon.com/SAML/Attributes/PrincipalTag:{TagKey}` | SAML attribute `https://aws.amazon.com/SAML/Attributes/TransitiveTagKeys` (multi-valued) |
| `AssumeRoleWithWebIdentity` | JWT claim `https://aws.amazon.com/tags` (nested `principal_tags`) or flattened `https://aws.amazon.com/tags/principal_tags/{TagKey}` | `transitive_tag_keys` (nested) or `https://aws.amazon.com/tags/transitive_tag_keys` (flattened) |
| `GetFederationToken` | `Tags` / `--tags` | Not supported (cannot chain) |

Source: [session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html). The flattened OIDC format exists for IdPs such as Microsoft Entra ID that cannot emit nested JSON claims. Note that the AWS nested-claim example shows each `principal_tags` value as a one-element array (`"Project": ["Automation"]`) while the prose says each tag is "a single string value".

```json
{
  "sub": "johndoe",
  "aud": "ac_oic_client",
  "iss": "https://idp.example.com",
  "https://aws.amazon.com/tags": {
    "principal_tags": {
      "Project": ["Automation"],
      "CostCenter": ["987654"]
    },
    "transitive_tag_keys": ["Project"]
  }
}
```

### 4.4 Permissions to tag a session

`sts:TagSession` must be allowed in addition to the assume action. Every role trusting an IdP that sends tags must allow `sts:TagSession` in its trust policy, otherwise the assume call fails; AWS suggests a separate IdP instance if you do not want to update every role ([session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)).

Condition keys usable with `sts:TagSession`: `aws:PrincipalTag`, `aws:RequestTag/${TagKey}`, `aws:ResourceTag/${TagKey}`, `aws:TagKeys`, `sts:TransitiveTagKeys` (plus `iam:ResourceTag/${TagKey}` and `saml:aud` per the [Service Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeWithRequiredTags",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/Broker" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringLike": {
          "aws:RequestTag/Project": "*",
          "aws:RequestTag/CostCenter": "*"
        }
      }
    },
    {
      "Sid": "AllowOnlyApprovedTagsAndTransitiveKeys",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/Broker" },
      "Action": "sts:TagSession",
      "Condition": {
        "ForAllValues:StringEquals": {
          "aws:TagKeys": ["Project", "CostCenter", "Department"],
          "sts:TransitiveTagKeys": ["Project"]
        },
        "StringEquals": {
          "aws:RequestTag/Department": ["Engineering", "Marketing"]
        }
      }
    }
  ]
}
```

To require at least one transitive key, add `"Null": {"sts:TransitiveTagKeys": "false"}` ([session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)).

### 4.5 Transitive tags in a role chain

By default STS does not pass tags to the next session. Only session tags marked transitive propagate; role tags can never be transitive (re-pass them as session tags if you need them downstream). In the AWS example ([session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)):

| Step | Call | Principal tags of the new session | Transitive |
| --- | --- | --- | --- |
| 1 | User assumes `Role1` with `Star=1`, `Heart=1`, transitive `Star Heart` | `Star=1`, `Heart=1` (+ `Role1` tags) | `Star`, `Heart` |
| 2 | Session1 assumes `Role2` (tagged `Sun=2`), no new tags | `Star=1`, `Heart=1`, `Sun=2` | `Star`, `Heart` |
| 3 | Session2 assumes `Role3` (tagged `Star=3`, `Lightning`) | `Star=1` (inherited overrides role tag), `Heart=1`, `Lightning` | `Star`, `Heart` |

Passing `Sun=2` in step 3 is allowed (Sun is not inherited); passing `Star` in step 3 fails because it is an inherited key. Transitive tags "replace matching `ResourceTag` values after the evaluation of the role trust policy" ([session tags guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)).

### 4.6 ABAC with session tags

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SameProjectOnly",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances"],
      "Resource": "arn:aws:ec2:*:111122223333:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/Project": "${aws:PrincipalTag/Project}"
        }
      }
    }
  ]
}
```

## 5. Source identity and provided contexts

### 5.1 Source identity

Source identity is a caller-supplied string (usually a human username or email) stored in the session. Its key properties ([source identity guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html)):

- Set at assume time; **cannot be changed** for the life of the session.
- **Persists across role chaining**. Attempting to set a different value on a chained call is denied; omitting it keeps the original.
- Requires `sts:SetSourceIdentity`. For role chaining and cross-account, it must be allowed both in the caller's permissions policy and in the target role's trust policy.
- Every role connected to an IdP that sends a source identity must allow `sts:SetSourceIdentity` in its trust policy, or the `AssumeRole*` call fails.
- In the initial request the key is `sts:SourceIdentity`; in all later requests made with the session it is `aws:SourceIdentity`. During a chained assume, both are present.
- Cannot start with `aws:`; allowed characters are alphanumerics and `_ + = , . @ -`.
- Length: the STS API reference says 2-64 characters ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)); the IAM User Guide says 2-256 characters ([source identity guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html)). Use <= 64 to be safe.
- Logged in CloudTrail: `requestParameters.sourceIdentity` on the `AssumeRole` event, and `userIdentity.sessionContext.sourceIdentity` on every action taken with the session.
- Not captured by CloudTrail when an AWS service or service-linked role acts on behalf of the identity.
- The console Switch Role feature cannot assume a role that requires a source identity.

| Operation | How source identity is passed |
| --- | --- |
| `AssumeRole` | `SourceIdentity` parameter / `--source-identity` |
| `AssumeRoleWithSAML` | SAML attribute `https://aws.amazon.com/SAML/Attributes/SourceIdentity` |
| `AssumeRoleWithWebIdentity` | JWT claim `https://aws.amazon.com/source_identity` |

Trust policy that only lets a SAML IdP set an approved source identity:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::111122223333:saml-provider/CorpIdP" },
      "Action": ["sts:AssumeRoleWithSAML", "sts:SetSourceIdentity"],
      "Condition": {
        "StringEquals": { "SAML:aud": "https://signin.aws.amazon.com/saml" },
        "StringLike": { "sts:SourceIdentity": "*@example.com" }
      }
    }
  ]
}
```

Unlike `sts:RoleSessionName`, which the caller picks per call, source identity is immutable, which is why AWS recommends it "when you want to control the identity that assumes a role" ([source identity guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html)).

### 5.2 Provided contexts and `sts:SetContext` (trusted identity propagation)

`AssumeRole` accepts `ProvidedContexts` (1-5 items), each a `ProviderArn` plus a `ContextAssertion` "signed and encrypted by AWS STS" ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). The main provider is IAM Identity Center (`arn:aws:iam::aws:contextProvider/IdentityCenter`). An application obtains an Identity Center token (for example via `CreateTokenWithIAM`), extracts the `sts:identity_context` claim, and passes it as the context assertion. The result is an **identity-enhanced IAM role session**: services that support user-based authorization can authorize the Identity Center user, and CloudTrail logs the user ID ([identity-enhanced role sessions](https://docs.aws.amazon.com/singlesignon/latest/userguide/trustedidentitypropagation-identity-enhanced-iam-role-sessions.html)). `sts:audit_context` is supported only for backward compatibility; a session can hold one or the other, not both.

The role trust policy must allow `sts:SetContext`. Relevant condition keys ([IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html), [STS keys for Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/condition-context-keys-sts-idc.html)):

- `sts:RequestContextProviders` (ArrayOfARN): the provider ARNs in the request.
- `sts:RequestContext/${ContextKey}` (String): key-value pairs inside the signed assertion, for example `sts:RequestContext/identitystore:UserId`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/AnalyticsApp" },
      "Action": ["sts:AssumeRole", "sts:SetContext"],
      "Condition": {
        "ForAllValues:ArnEquals": {
          "sts:RequestContextProviders": ["arn:aws:iam::aws:contextProvider/IdentityCenter"]
        },
        "Null": { "sts:RequestContextProviders": "false" }
      }
    }
  ]
}
```

AWS recommends the `Null` check because `ForAllValues` evaluates to true when the key is missing ([IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)). The context key-value pairs appear in CloudTrail under `AdditionalEventData`.

## 6. Role chaining

**Definition**: "Role chaining is when you use a role to assume a second role. You can perform role chaining through the AWS Management Console by switching roles, the AWS CLI, or API" ([IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)).

**One-hour cap**: chained sessions are limited to a maximum of one hour "regardless of the maximum session duration configured for individual roles". If you pass `DurationSeconds` greater than 3600 on a chained call, "the operation fails" ([IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html), [AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). The cap cannot be raised ([re:Post](https://repost.aws/knowledge-center/iam-role-chaining-limit)).

What counts and what does not:

| Situation | Role chaining? | Source |
| --- | --- | --- |
| IAM user long-term keys -> `AssumeRole` | No | [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) |
| SAML or OIDC token -> `AssumeRoleWithSAML` / `AssumeRoleWithWebIdentity` | No | [trust policy blog](https://aws.amazon.com/blogs/security/how-to-use-trust-policies-with-iam-roles/) ("Roles that are assumed by other means are not considered role chaining") |
| Role session credentials -> `AssumeRole` (CLI, SDK, console Switch Role) | Yes | [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) |
| AWS service assuming a service role (EC2 instance profile, Lambda execution role) | No, and "The maximum session duration setting doesn't limit sessions assumed by AWS services" | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html), [custom broker console URL](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html) |
| Code on EC2/Lambda uses its service-role credentials to call `AssumeRole` on a second role | Yes, confirmed for EC2: AWS lists "The requested DurationSeconds exceeds the 1 hour session limit for roles" among instance-profile errors. Lambda is not called out explicitly, but follows the same definition | [Knowledge Center](https://repost.aws/knowledge-center/iam-role-instance-profile), [AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-use-trust-policies-with-iam-roles/) |
| `GetFederationToken` credentials -> `AssumeRole` | Not possible: federated-user credentials cannot call STS except `GetCallerIdentity` | [GetFederationToken (SDK ref)](https://docs.aws.amazon.com/sdk-for-ruby/v3/api/Aws/STS/Client.html) |
| Role session -> custom broker `getSigninToken` with `SessionDuration` | Fails ("Do not use the `SessionDuration` HTTP parameter when you get temporary credentials through role chaining") | [custom broker console URL](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html) |

What propagates through a chain:

| Attribute | Propagates? |
| --- | --- |
| Transitive session tags | Yes; cannot be overridden downstream |
| Non-transitive session tags | No |
| Role tags | No (never transitive) |
| Source identity | Yes; immutable |
| Session policy | No; each hop passes its own |
| `DurationSeconds` | Capped at 3600 per hop |

## 7. Session duration

| Credential source | Default | Range | Notes |
| --- | --- | --- | --- |
| `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` | 3600 s | 900 s up to the role's `MaxSessionDuration` | `MaxSessionDuration` is 1-12 h (3600-43200 s); requesting more than the role allows fails ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)) |
| Role chaining | 3600 s | 900-3600 s | Hard cap ([IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)) |
| `AssumeRoleWithSAML` | 3600 s | Also bounded by the assertion's `SessionNotOnOrAfter`, whichever is shorter | [SDK ref](https://docs.aws.amazon.com/sdk-for-kotlin/api/latest/sts/aws.sdk.kotlin.services.sts.model/-assume-role-with-saml-request/duration-seconds.html) |
| `GetSessionToken` (IAM user) | 43200 s | 900-129600 s (36 h) | Root: 900-3600 s ([SDK ref](https://docs.aws.amazon.com/sdk-for-ruby/v2/api/Aws/STS/Client.html)) |
| `GetFederationToken` (IAM user) | 43200 s | 900-129600 s | Root: max 3600 s ([request temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_request.html)) |
| `AssumeRoot` | 900 s | 0-900 s | Regional endpoint only ([AssumeRoot API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)) |
| Console Switch Role (IAM user) | n/a | Role max or remaining user session, whichever is less | [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) |
| SAML console sign-in (`SessionDuration` attribute) | 3600 s | 900-43200 s | Lesser of `SessionDuration` and `SessionNotOnOrAfter` wins ([SAML assertions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_saml_assertions.html)) |
| Custom broker console URL (`SessionDuration` on `getSigninToken`) | Credential lifetime | 900-43200 s, must be less than the role's maximum | Sign-in URL itself valid 15 minutes ([custom broker console URL](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)) |

The `DurationSeconds` of the STS call is separate from the console session length requested from the federation endpoint ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)). For the custom broker flow, the documentation states that `SessionDuration` "cannot be greater than or equal to the maximum session duration setting for the role" ([custom broker console URL](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)).

```bash
# Raise a role's maximum session duration to 8 hours
aws iam update-role --role-name DataEngineer --max-session-duration 28800
```

## 8. External ID and the confused deputy problem

### 8.1 Cross-account confused deputy

A SaaS vendor that assumes roles in many customer accounts can be tricked by customer B into using customer A's role ARN (role ARNs are not secret). The fix is an `ExternalId` that the vendor generates per customer, keeps under its own control, and always sends: "The `ExternalId` value must be unique among Example Corp's customers and controlled by Example Corp, not its customers" ([confused deputy](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)). The customer adds `sts:ExternalId` to the trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::999988887777:role/VendorScanner" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": { "sts:ExternalId": "c0b6f9d2-6a1e-4f7d-9a51-2b1d0e6c7a33" }
      }
    }
  ]
}
```

External ID constraints: 2-1,224 characters, pattern `[\w+=,.@:\/-]*` ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html), [Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)). The key `sts:ExternalId` is present only when the caller supplies an external ID ([IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)).

### 8.2 Cross-service confused deputy

When a service principal assumes your role or calls your resource, the policy authorizes the service, not the customer who configured it. AWS recommends `aws:SourceArn`, `aws:SourceAccount`, `aws:SourceOrgID`, and `aws:SourceOrgPaths` wherever a service principal is granted access ([confused deputy](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)). These keys are only present when the request is made by an AWS service principal on behalf of a resource ([global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)). In a trust policy, `aws:SourceArn` and `aws:SourceAccount` "are evaluated independently. Any request to use the service role must satisfy both conditions" ([CloudFormation confused deputy](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cross-service-confused-deputy-prevention.html)).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "logs.amazonaws.com" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "111122223333" },
        "ArnLike": { "aws:SourceArn": "arn:aws:logs:us-east-1:111122223333:log-group:*" }
      }
    }
  ]
}
```

Example adapted from [CloudWatch pipelines IAM reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/pipeline-iam-reference.html). Whether a given service populates these keys on `sts:AssumeRole` is service-specific; check that service's documentation.

## 9. MFA in sessions

`aws:MultiFactorAuthPresent` (Boolean) and `aws:MultiFactorAuthAge` (Numeric, seconds since MFA) exist only in requests signed with temporary credentials ([global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)).

| Session type | MFA keys | Source |
| --- | --- | --- |
| IAM user long-term access keys | Absent | [global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html) |
| `GetSessionToken` with `SerialNumber` + `TokenCode` | Present, `true`; can be checked on every API call | [MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html) |
| `AssumeRole` with `SerialNumber` + `TokenCode` | Checked at assume time in the trust policy; see the documentation conflict below | [MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html) |
| `AssumeRole` / `GetSessionToken` without MFA | Present, `false` | [MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html) |
| IAM user console session, service-forwarded calls | Present (temporary credentials are used behind the scenes); `false` when no MFA | [global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html) |
| `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` | Not present: "AWS cannot determine whether that provider required MFA"; pass the IdP's auth method as a session tag instead | [MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html) |
| `GetFederationToken` | No MFA support | [MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html) |
| Root user credentials | MFA-protected API access not available | [MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html) |

Documentation conflict: the MFA guide says "The temporary credentials returned by `AssumeRole` do not include MFA information in the context, so you cannot check individual API operations for MFA", while the global condition keys page lists `AssumeRole` temporary credentials among those for which `aws:MultiFactorAuthPresent` applies, and CloudTrail records `mfaAuthenticated: true` for actions taken with an MFA-assumed role ([MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html), [global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)). Treat per-call MFA checks on role sessions as (unverified) and enforce MFA in the trust policy, which AWS documents unambiguously.

Two cautions from AWS: a cross-account trust policy requiring MFA is only as strong as the trusted account, because "Any identity in the trusted account that has permission to create virtual MFA devices can construct an MFA claim"; and `"Deny" + "Bool": {"aws:MultiFactorAuthPresent": "false"}` does not deny long-term keys, so use `BoolIfExists` for deny statements ([MFA-protected API access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html), [global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::444455556666:root" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "Bool": { "aws:MultiFactorAuthPresent": "true" },
        "NumericLessThan": { "aws:MultiFactorAuthAge": "3600" }
      }
    }
  ]
}
```

## 10. Condition key catalog

### 10.1 `sts:` keys (Service Authorization Reference)

| Key | Type | Where it appears | Purpose |
| --- | --- | --- | --- |
| `sts:ExternalId` | String | `AssumeRole` | Third-party external ID |
| `sts:RoleSessionName` | String | `AssumeRole*` (console, CLI, API) | Enforce session naming, e.g. `${aws:username}` |
| `sts:SourceIdentity` | String | `AssumeRole*`, `sts:SetSourceIdentity` | Value being set in this request |
| `sts:TransitiveTagKeys` | ArrayOfString | `AssumeRole*`, `sts:TagSession` | Which tag keys may or must be transitive |
| `sts:RequestContext/${ContextKey}` | String | `sts:SetContext` | Values inside a trusted context assertion |
| `sts:RequestContextProviders` | ArrayOfARN | `sts:SetContext` | Context provider ARNs |
| `sts:RoleAuthorizedByIdp` | Bool | `AssumeRoleWithWebIdentity` | `true` if the token's `https://aws.amazon.com/roles` claim lists the requested role |
| `sts:TaskPolicyArn` | ARN | `AssumeRoot` | Which root task policy may be used |
| `sts:AWSServiceName` | String | `sts:GetServiceBearerToken` | Service the bearer token is for (e.g. CodeArtifact) |
| `sts:DurationSeconds` | Numeric | `sts:GetServiceBearerToken`, `GetWebIdentityToken` | Token lifetime; "not applicable for AWS STS assume-role operations" |
| `sts:IdentityTokenAudience` | ArrayOfString | `GetWebIdentityToken` | Allowed `aud` for outbound JWTs |
| `sts:SigningAlgorithm` | String | `GetWebIdentityToken` | `ES384` or `RS256` |

Sources: [Service Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html), [IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html). `sts:RoleAuthorizedByIdp` is always present on `AssumeRoleWithWebIdentity`, so use `Bool`, not `BoolIfExists`; if the claim exists but does not list the role, the call fails with `InvalidIdentityToken`.

### 10.2 Federation keys in trust policies

| Family | Keys (examples) | Notes |
| --- | --- | --- |
| SAML | `saml:aud`, `saml:iss`, `saml:sub`, `saml:sub_type`, `saml:namequalifier`, `saml:doc`, `saml:edupersonaffiliation`, `saml:cn`, `saml:mail`, ... | `saml:aud` comes from the assertion's `Recipient`, not `Audience`; only `saml:namequalifier`, `saml:sub`, `saml:sub_type` remain available after the initial authentication ([IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)) |
| Generic OIDC | `<provider>:aud`, `<provider>:sub`, `<provider>:amr`, `<provider>:oaud`, `<provider>:email` | `aud`, `sub`, `amr` available in session; `email`, `oaud` trust-policy only ([IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)) |
| GitHub Actions | `token.actions.githubusercontent.com:aud`, `:sub`, `:repository`, `:repository_id`, `:repository_owner_id`, `:ref`, `:environment`, `:job_workflow_ref`, `:workflow`, `:actor`, `:actor_id`, `:enterprise_id` | Also `token.actions.githubusercontent.com/${SubPath}:*`, `token.actions.${Domain}.ghe.com:*`, `github.com/enterprises/${EnterpriseName}:*` |
| Google | `accounts.google.com:aud`, `:oaud`, `:sub`, `:google/organization_number` | `aud` maps to `azp` when `azp` is set |
| Amazon Cognito | `cognito-identity.amazonaws.com:aud`, `:sub`, `:amr` | `amr` contains `authenticated`/`unauthenticated` |
| GitLab | `gitlab.com:namespace_id`, `:project_id`, `:ref_protected`, `:pipeline_source`, `:user_login`, ... | |
| Others | `graph.facebook.com:app_id`, `www.amazon.com:app_id`, `agent.buildkite.com:*`, `oidc.circleci.com/org/${OrgId}:oidc.circleci.com/project-id`, `idcs-*.identity.oraclecloud.com:rpst_id` | |

Source for the provider-specific keys: [Service Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html).

GitHub Actions trust policy pinned to one repository and branch:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:example-org/infra:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

### 10.3 Global keys relevant to sessions

| Key | Type | Present when | Use |
| --- | --- | --- | --- |
| `aws:TokenIssueTime` | Date | Temporary credentials only | Revoke older sessions |
| `aws:MultiFactorAuthPresent` | Bool | Temporary credentials only | MFA enforcement |
| `aws:MultiFactorAuthAge` | Numeric | Temporary credentials with MFA | MFA freshness |
| `aws:SourceIdentity` | String | Session has a source identity | Per-human controls on shared roles |
| `aws:PrincipalTag/<key>` | String | Principal has tags | ABAC |
| `aws:RequestTag/<key>`, `aws:TagKeys` | String / ArrayOfString | Request carries tags | Control session tags |
| `aws:FederatedProvider` | String or ARN | OIDC-assumed session and its trust evaluation | `cognito-identity.amazonaws.com` for built-ins; provider ARN for custom IdPs |
| `aws:PrincipalType` | String | Always | `Account`, `User`, `FederatedUser`, `AssumedRole`, `Anonymous` |
| `aws:userid` | String | Always | See 10.4 |
| `aws:PrincipalArn` | ARN | Signed requests | Matches the **role** ARN for role sessions; not converted to unique IDs |
| `aws:AssumedRoot` | Bool | Credentials from `AssumeRoot` only | Distinguish centralized root sessions |
| `aws:Ec2InstanceSourceVpc` | String | Requests signed with EC2 role credentials | Pin credentials to the VPC they were delivered to |
| `aws:Ec2InstanceSourcePrivateIPv4` | IP | Requests signed with EC2 role credentials | Pin to delivery IP; always pair with the VPC key |
| `aws:SourceArn`, `aws:SourceAccount` | ARN / String | Service-principal requests on behalf of a resource | Cross-service confused deputy |
| `aws:SignInSessionArn` | ARN | AWS Sign-In OAuth sessions (e.g. `aws login`) | Deny one sign-in session |

Source: [global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html).

### 10.4 `aws:userid` and ARN formats per principal type

| Principal | `aws:PrincipalType` | `aws:userid` | Session ARN |
| --- | --- | --- | --- |
| Root user | `Account` | Account ID | `arn:aws:iam::111122223333:root` |
| IAM user | `User` | Unique ID (`AIDA...`) | `arn:aws:iam::111122223333:user/alice` |
| `AssumeRole` session | `AssumedRole` | `AROA...:RoleSessionName` | `arn:aws:sts::111122223333:assumed-role/RoleName/RoleSessionName` |
| SAML session | `AssumedRole` | `AROA...:` value of the `RoleSessionName` SAML attribute | `arn:aws:sts::111122223333:assumed-role/RoleName/SessionName` |
| OIDC session | `AssumedRole` | `AROA...:RoleSessionName` | `arn:aws:sts::111122223333:assumed-role/RoleName/RoleSessionName` |
| EC2 instance role | `AssumedRole` | `AROA...:i-0abc...` (instance ID) | `arn:aws:sts::111122223333:assumed-role/RoleName/i-0abc...` |
| `GetFederationToken` | `FederatedUser` | `111122223333:caller-specified-name` | `arn:aws:sts::111122223333:federated-user/name` |

Sources: [policy variables (principal key values)](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html), [Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html), [AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html). The EC2 row is confirmed by an AWS Knowledge Center example: `arn:aws:sts::123456789012:assumed-role/ExampleInstanceRole/i-01773d4a8ed647342` ([re:Post](https://repost.aws/knowledge-center/iam-ec2-user-role-credentials)). `RoleSessionName` is 2-64 characters, pattern `[\w+=,.@-]*`, and is visible to and logged by the role-owning account in cross-account use ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)).

### 10.5 Why session ARNs make poor trust principals

- **Role and user ARNs are converted to unique IDs.** When you save a trust policy naming `role/Deployer`, IAM stores `AROA...`. If the role is deleted and recreated with the same name, the policy no longer matches and shows the raw ID; you must re-save the ARN ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html), [re:Post](https://repost.aws/knowledge-center/iam-trust-policy-error)). This is a deliberate defense against privilege escalation by recreating a principal.
- **Session names are chosen by the caller**, so a session ARN is only meaningful if the administrator controls how sessions are issued; otherwise AWS says to "specify the role ARN as a principal in the `aws:PrincipalArn` condition key" ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)).
- **AWS guidance**: "AWS recommends using IAM role principals in your policies instead of role session principals wherever possible" ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)).
- **Name-based matching survives recreation.** "Because AWS does not convert condition key ARNs to IDs, permissions granted to the role ARN persist if you delete the role and then create a new role with the same name" ([Principal element](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)). That is convenient, but it also means a recreated role inherits access. Whether session ARNs in `Principal` are stored by name or ID is not documented (unverified).

## 11. Revoking sessions

STS credentials cannot be individually invalidated. They are "valid until they expire", but "Permissions assigned to temporary security credentials are evaluated each time they are used to make an AWS request", so you revoke by changing policy ([disabling permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html)).

### 11.1 Revoke active sessions (`AWSRevokeOlderSessions`)

The IAM console **Revoke sessions** tab attaches an inline policy named `AWSRevokeOlderSessions` to the role. It denies all actions to sessions whose `aws:TokenIssueTime` is before "approximately 30 seconds into the future" (to cover propagation delay). Clicking again refreshes the timestamp. It requires `iam:PutRolePolicy` and cannot be used on service-linked roles or on Identity Center permission-set roles (revoke those in Identity Center) ([revoke sessions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)). The equivalent policy:

```json
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "DateLessThan": { "aws:TokenIssueTime": "2026-10-10T09:00:00Z" }
    }
  }
}
```

```bash
aws iam put-role-policy \
  --role-name Deployer \
  --policy-name AWSRevokeOlderSessions \
  --policy-document file://revoke.json
# The CLI caches assumed-role credentials until they expire
rm -r ~/.aws/cli/cache
```

### 11.2 Other levers

| Lever | Scope | Notes |
| --- | --- | --- |
| Edit/deny-all the role's identity policy (e.g. `AWSDenyAll`) | All sessions of the role, past and future | "the changes affect the permissions of all temporary security credentials associated with the role, including credentials that were issued before" |
| Deny by `aws:PrincipalArn` | All sessions of a role/user/federated user | In identity or resource policies |
| Deny by `aws:SourceIdentity` | One human across shared roles and chains | Requires source identity to have been set |
| Deny by `aws:userid` | One specific session (`AROA...:session-name`) | Surgical |
| Explicit deny in resource policies | Needed if a resource policy grants the session directly | Identity-side changes do not override a resource-policy allow for the session ARN |
| Update trust policy | Stops new sessions only | Existing sessions unaffected |
| Delete the role | Existing sessions stop working: "users would no longer be able to … access their AWS environment" ([AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-revoke-federated-users-active-aws-sessions/)) | AWS recommends deny + revoke rather than delete to "disable a role" ([delete roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_manage_delete.html)) |

Sources: [disabling permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html), [revoke sessions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html). Policy updates are eventually consistent: "It might take a few minutes for policy updates to take effect" ([disabling permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html)).

Two sessions you cannot rein in by policy: credentials from `GetFederationToken` or `GetSessionToken` called as the root user, because "You cannot change the permissions for an AWS account root user" ([disabling permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html)).

## 12. Expiry, caching, refresh, and clock skew

- **Expiration** is returned in `Credentials.Expiration`. After it, every signed request fails and the client must obtain new credentials ([AssumeRole API](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)).
- **SDK refresh**: "When using one of the standardized credential providers, the AWS SDKs always attempt to renew credentials automatically when they expire" ([SDK credential providers](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)). The pre-expiry refresh window varies by SDK and is not in the shared SDK reference: botocore refreshes at 15 minutes (advisory) and 10 minutes (mandatory) before expiry (`_DEFAULT_ADVISORY_REFRESH_TIMEOUT` / `_DEFAULT_MANDATORY_REFRESH_TIMEOUT` in [botocore/credentials.py](https://github.com/boto/botocore/blob/develop/botocore/credentials.py)), while Go v2 uses a configurable `ExpiryWindow`.
- **MFA and refresh**: an assume-role provider given a static `TokenCode` cannot refresh, because the code is single-use ([Go SDK stscreds](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/stscreds/index.html)).
- **CLI cache**: the AWS CLI caches assumed-role credentials under `~/.aws/cli/cache` until they expire, which is why revocation guidance tells users to delete that directory ([revoke sessions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)).
- **Credentials are bearer secrets**: the session token must accompany the access key in `X-Amz-Security-Token`, and it is covered by the SigV4 signature ([STS common parameters](https://docs.aws.amazon.com/STS/latest/APIReference/CommonParameters.html)).
- **Clock skew**: signed requests carry `X-Amz-Date`; requests too far from AWS time fail with `RequestTimeTooSkewed` or similar. Amazon S3 documents a 15-minute window ([S3 authentication](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/RESTAuthentication.html)); an AWS Mobile blog cites a five-minute variance for AWS requests in general ([Managing device time](https://aws.amazon.com/blogs/mobile/managing-device-time-with-the-aws-mobile-sdks/)). The window is service-dependent; keep hosts on NTP. Skew also affects `aws:TokenIssueTime` comparisons and `aws:CurrentTime` conditions.
- **Request quotas**: STS calls made with AWS credentials share 600 requests per second per account per Region across `AssumeRole`, `GetCallerIdentity`, `GetSessionToken`, and others; service-principal calls do not count ([Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)). Caching and reusing credentials until near expiry avoids throttling.

## 13. Quick reference of limits

| Item | Limit |
| --- | --- |
| `DurationSeconds` (`AssumeRole*`) | 900 s to role max; default 3600 s |
| Role `MaxSessionDuration` | 3600-43200 s |
| Role chaining | Max 3600 s |
| `GetSessionToken` / `GetFederationToken` | 900-129600 s, default 43200 s; root max 3600 s |
| `AssumeRoot` | Max 900 s |
| Console session via SAML / broker | 900-43200 s |
| Federation sign-in URL validity | 15 minutes |
| Inline session policy | 1 document |
| Managed session policies | 10 ARNs |
| Session policy plaintext (inline + ARNs) | 2,048 characters |
| Session tags | 50; key 128 chars; value 256 chars |
| Transitive tag keys | 50 |
| `RoleSessionName` | 2-64 chars |
| `SourceIdentity` | 2-64 chars (API reference); 2-256 (User Guide) |
| `ExternalId` | 2-1,224 chars |
| `ProvidedContexts` | 1-5 items |
| `MinimumSessionTokenSize` | 0-4,096 bytes |
| SAML response (base64) | 100,000 chars |
| Role trust policy length | 2,048 chars default, up to 8,192 via quota |
| STS request rate | 600 RPS per account per Region (default) |

## Sources

- [AssumeRole API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [AssumeRoot API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)
- [STS common parameters](https://docs.aws.amazon.com/STS/latest/APIReference/CommonParameters.html)
- [Service Authorization Reference: AWS Security Token Service](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)
- [IAM and AWS STS quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)
- [Pass session tags in AWS STS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)
- [Monitor and control actions taken with assumed roles (source identity)](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html)
- [IAM and AWS STS condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)
- [AWS global condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)
- [IAM policy elements: variables and tags (principal key values)](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html)
- [AWS JSON policy elements: Principal](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html)
- [Policy evaluation logic (enforcement code)](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)
- [Policies and permissions in IAM (session policies)](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)
- [IAM roles (role chaining definition)](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [Update a role trust policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_update-role-trust-policy.html)
- [The confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)
- [Secure API access with MFA](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html)
- [Revoke IAM role temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)
- [Disabling permissions for temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html)
- [Delete roles or instance profiles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_manage_delete.html)
- [Request temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_request.html)
- [Enable custom identity broker access to the AWS console](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)
- [Configure SAML assertions for the authentication response](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_saml_assertions.html)
- [Logging IAM and AWS STS API calls with CloudTrail](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)
- [Identity-enhanced IAM role sessions (IAM Identity Center)](https://docs.aws.amazon.com/singlesignon/latest/userguide/trustedidentitypropagation-identity-enhanced-iam-role-sessions.html)
- [AWS STS condition context keys for IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/condition-context-keys-sts-idc.html)
- [Service control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [Resource control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html)
- [AWS SDKs and Tools standardized credential providers](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)
- [CloudFormation cross-service confused deputy prevention](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cross-service-confused-deputy-prevention.html)
- [CloudWatch pipelines IAM reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/pipeline-iam-reference.html)
- [Amazon S3 REST authentication (time stamp requirement)](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/RESTAuthentication.html)
- [AWS Security Blog: Announcing an update to IAM role trust policy behavior](https://aws.amazon.com/blogs/security/announcing-an-update-to-iam-role-trust-policy-behavior/)
- [AWS Security Blog: How to use trust policies with IAM roles](https://aws.amazon.com/blogs/security/how-to-use-trust-policies-with-iam-roles/)
- [AWS News Blog: Introducing resource control policies](https://aws.amazon.com/blogs/aws/introducing-resource-control-policies-rcps-a-new-authorization-policy/)
- [AWS Mobile Blog: Managing device time with the AWS Mobile SDKs](https://aws.amazon.com/blogs/mobile/managing-device-time-with-the-aws-mobile-sdks/)
- [AWS re:Post: Can I increase the duration of the IAM role chaining session?](https://repost.aws/knowledge-center/iam-role-chaining-limit)
- [AWS re:Post: IAM trust policy error "Invalid principal in policy"](https://repost.aws/knowledge-center/iam-trust-policy-error)
