# AWS STS API Operations: Complete Reference

_Last verified: 2026-10-10 against the AWS STS API Reference (last published 2026-10-09), the IAM User Guide, the Service Authorization Reference, and AWS What's New posts._

This chapter goes through every operation in the AWS Security Token Service (STS) API one by one. For each operation it covers who calls it, how the call is authenticated, its parameters and limits, what it returns, how long the result lasts, how it handles MFA, and what the resulting session can and cannot do. Each claim cites an official source inline. Anything that could not be confirmed against official documentation is marked **(unverified)**.

## Table of contents

- [Wire protocol and service basics](#wire-protocol-and-service-basics)
- [The complete list of operations](#the-complete-list-of-operations)
- [IAM actions, including permission-only actions](#iam-actions-including-permission-only-actions)
- [Comparison matrix](#comparison-matrix)
- [Common request and response building blocks](#common-request-and-response-building-blocks)
- [AssumeRole](#assumerole)
- [AssumeRoleWithSAML](#assumerolewithsaml)
- [AssumeRoleWithWebIdentity](#assumerolewithwebidentity)
- [AssumeRoot](#assumeroot)
- [GetSessionToken](#getsessiontoken)
- [GetFederationToken](#getfederationtoken)
- [GetDelegatedAccessToken](#getdelegatedaccesstoken)
- [GetWebIdentityToken](#getwebidentitytoken)
- [GetCallerIdentity](#getcalleridentity)
- [GetAccessKeyInfo](#getaccesskeyinfo)
- [DecodeAuthorizationMessage](#decodeauthorizationmessage)
- [Identifier prefixes and principal ARN formats](#identifier-prefixes-and-principal-arn-formats)
- [Errors](#errors)
- [Discrepancies and open questions](#discrepancies-and-open-questions)
- [Sources](#sources)

## Wire protocol and service basics

| Property | Value | Source |
| --- | --- | --- |
| API version | `2011-06-15` | [STS API Reference sample requests](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) |
| Protocol | AWS Query (`Action=...&Version=2011-06-15`, form-encoded `POST` or `GET` query string), with XML responses | [GetCallerIdentity sample request](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html), [Welcome](https://docs.aws.amazon.com/STS/latest/APIReference/Welcome.html) |
| XML namespace | `https://sts.amazonaws.com/doc/2011-06-15/` | [botocore STS model](https://github.com/boto/botocore/blob/develop/botocore/data/sts/2011-06-15/service-2.json) |
| SDK model protocol | `"protocol": "query"`, `"protocols": ["query"]` | [botocore STS model](https://github.com/boto/botocore/blob/develop/botocore/data/sts/2011-06-15/service-2.json) |
| Signing | SigV4 with signing name / endpoint prefix `sts` (credential scope `.../us-east-1/sts/aws4_request`); the SDK model also lists SigV4a (`aws.auth#sigv4`, `aws.auth#sigv4a`) | [GetCallerIdentity sample](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html), [botocore STS model](https://github.com/boto/botocore/blob/develop/botocore/data/sts/2011-06-15/service-2.json) |
| Unsigned operations | `AssumeRoleWithSAML` and `AssumeRoleWithWebIdentity` (`smithy.api#noAuth`, `authtype: none`) | [botocore STS model](https://github.com/boto/botocore/blob/develop/botocore/data/sts/2011-06-15/service-2.json) |
| Global endpoint | `https://sts.amazonaws.com/`; `AssumeRoot` and `GetWebIdentityToken` are **not** available on it | [AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html), [GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html) |

**JSON / CBOR protocol: not adopted.** Some AWS services have moved from the Query protocol to AWS JSON 1.0 or Smithy RPC v2 CBOR. CloudWatch is a recent example ([CloudWatch protocols FAQ](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-protocols-faq.html)). STS has not made this move. The current botocore STS model declares only `query` in both `protocol` and `protocols`, and every STS API Reference example still uses `Action=` and `Version=2011-06-15` with XML responses. No AWS announcement of an STS protocol migration turned up as of 2026-10-10.

A session-token size change landed on 2026-09-15. STS now enforces one 4,096-byte limit on the assembled session token. It reports `SessionTokenSize` and `SessionTokenUtilization` on session-vending responses and accepts a new `MinimumSessionTokenSize` request parameter (0 to 4096) for testing. `PackedPolicySize` is now deprecated and reports the same percentage as `SessionTokenUtilization` ([What's New, 2026-09-15](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/), [AWS Security Blog](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/)).

## The complete list of operations

The [Actions page of the STS API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html) lists exactly 11 operations. The botocore model lists the same 11 ([botocore STS model](https://github.com/boto/botocore/blob/develop/botocore/data/sts/2011-06-15/service-2.json)).

| # | Operation | Category | Launched / notable dates |
| --- | --- | --- | --- |
| 1 | `AssumeRole` | Role session (credentials) | Original API (2011-06-15 API version) |
| 2 | `AssumeRoleWithSAML` | Role session via SAML 2.0 federation | Original-era API |
| 3 | `AssumeRoleWithWebIdentity` | Role session via OIDC / OAuth 2.0 federation | Original-era API |
| 4 | `AssumeRoot` | Task-scoped root session in an Organizations member account | 2024-11-15 ([What's New](https://aws.amazon.com/about-aws/whats-new/2024/11/manage-root-access-aws-identity-access-management/), [AWS News Blog 2024-11-15](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)) |
| 5 | `DecodeAuthorizationMessage` | Utility | Original-era API |
| 6 | `GetAccessKeyInfo` | Utility | Original-era API (exact date unverified) |
| 7 | `GetCallerIdentity` | Utility (whoami) | Original-era API (exact date unverified) |
| 8 | `GetDelegatedAccessToken` | Credentials for AWS Partners via IAM temporary delegation | 2025-11-19 ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/streamline-integration-partner-products-iam-delegation/)) |
| 9 | `GetFederationToken` | Federated user session (custom broker) | Original API |
| 10 | `GetSessionToken` | MFA-backed session for IAM user / root | Original API |
| 11 | `GetWebIdentityToken` | Outbound identity federation (returns a JWT, not AWS credentials) | 2025-11-19 ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/)) |

There is no `SetContext`, `SetSourceIdentity`, `TagSession`, or `GetServiceBearerToken` **API operation**. Those exist only as IAM actions; see the next section.

## IAM actions, including permission-only actions

The [Service Authorization Reference for STS](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html) (service prefix `sts`) maps operations to IAM actions as follows.

| API operation | IAM action(s) authorized | Access level |
| --- | --- | --- |
| `AssumeRole` | `sts:AssumeRole`, plus `sts:SetContext`, `sts:SetSourceIdentity`, `sts:TagSession` when the corresponding parameters are used | Write (TagSession: Tagging, Write) |
| `AssumeRoleWithSAML` | `sts:AssumeRoleWithSAML` (evaluated in the role trust policy; not listed in the operation-to-action table because the call is unsigned) | Write |
| `AssumeRoleWithWebIdentity` | `sts:AssumeRoleWithWebIdentity` (same note as above) | Write |
| `AssumeRoot` | `sts:AssumeRoot` (resource type `root-user*`, condition key `sts:TaskPolicyArn`) | Write |
| `DecodeAuthorizationMessage` | `sts:DecodeAuthorizationMessage` | Write |
| `GetAccessKeyInfo` | `sts:GetAccessKeyInfo` | Read |
| `GetCallerIdentity` | `sts:GetCallerIdentity` (no permission actually required) | Read |
| `GetDelegatedAccessToken` | `sts:GetDelegatedAccessToken` | Write |
| `GetFederationToken` | `sts:GetFederationToken` (resource type `federated-user`), plus `sts:TagSession` | Write |
| `GetSessionToken` | `sts:GetSessionToken` (no permission actually required) | Read |
| `GetWebIdentityToken` | `sts:GetWebIdentityToken`, plus `sts:TagGetWebIdentityToken` when `Tags` are passed | Write |

### Permission-only actions

The Service Authorization Reference lists these as "defined by AWS Security Token Service but are not directly invocable through any API operation. They can only be used in IAM policy statements" ([list_sts](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)).

| Permission-only action | Purpose | Resource types | Condition keys |
| --- | --- | --- | --- |
| `sts:GetServiceBearerToken` | Obtain an STS bearer token (for example, required by CodeArtifact `GetAuthorizationToken`) | none | `sts:AWSServiceName`, `sts:DurationSeconds` |
| `sts:SetContext` | Set context keys (trusted context assertions, for example IAM Identity Center trusted identity propagation) on an STS session | `role`, `self-session` | `aws:ResourceTag/${TagKey}`, `iam:ResourceTag/${TagKey}`, `sts:RequestContext/${ContextKey}`, `sts:RequestContextProviders` |
| `sts:SetSourceIdentity` | Set a source identity on an STS session | `role` | `aws:ResourceTag/${TagKey}`, `iam:ResourceTag/${TagKey}`, `sts:SourceIdentity` |
| `sts:TagGetWebIdentityToken` | Add tags (custom claims) to the JWT from `GetWebIdentityToken` | none | `aws:RequestTag/${TagKey}`, `aws:TagKeys` |
| `sts:TagSession` | Add session tags to an STS session | `role` | `aws:RequestTag/${TagKey}`, `aws:ResourceTag/${TagKey}`, `aws:TagKeys`, `iam:ResourceTag/${TagKey}`, `saml:aud`, `sts:TransitiveTagKeys` |

`sts:TagSession` must be allowed in addition to the action that matches the API operation. When an IdP passes session tags, the trust policy of every role connected to that IdP must allow `sts:TagSession`, or `AssumeRole*` fails ([Pass session tags in AWS STS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)). `sts:GetServiceBearerToken` is required for CodeArtifact, and adding it to a CodeArtifact domain resource policy has no effect ([CodeArtifact tokens](https://docs.aws.amazon.com/codeartifact/latest/ug/tokens-authentication.html), [Service bearer tokens](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_bearer.html)).

### STS resource types

| Resource type | ARN |
| --- | --- |
| `context-provider` | `arn:${Partition}:iam::aws:contextProvider/${ContextProviderName}` |
| `federated-user` | `arn:${Partition}:sts::${Account}:federated-user/${FederatedUserName}` |
| `role` | `arn:${Partition}:iam::${Account}:role/${RoleNameWithPath}` |
| `root-user` | `arn:${Partition}:iam::${Account}:root` |
| `self-session` | `arn:${Partition}:sts::${Account}:self` |

Source: [Service Authorization Reference, STS](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html).

### STS-specific condition keys

`sts:AWSServiceName`, `sts:DurationSeconds` (bearer token and `GetWebIdentityToken`), `sts:ExternalId`, `sts:IdentityTokenAudience`, `sts:RequestContext/${ContextKey}`, `sts:RequestContextProviders`, `sts:RoleAuthorizedByIdp`, `sts:RoleSessionName`, `sts:SigningAlgorithm`, `sts:SourceIdentity`, `sts:TaskPolicyArn`, `sts:TransitiveTagKeys`. The same page also defines provider-specific keys for federation, such as `saml:*`, `accounts.google.com:*`, `cognito-identity.amazonaws.com:*`, `token.actions.githubusercontent.com:*`, `gitlab.com:*`, Buildkite, CircleCI, and OCI ([list_sts](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)).

## Comparison matrix

Durations are min / default / max. "Temp creds OK" means the operation can be called with temporary (ASIA) credentials.

| Operation | Typical caller | Request auth | Temp creds OK | Duration min / default / max | MFA params | Session policies | Session tags | Returns | Principal ARN of result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AssumeRole` | IAM user or role session (also AWS services) | SigV4 | Yes (role chaining caps at 1 h) | 900 s / 3600 s / role `MaxSessionDuration` (1 h to 12 h, 43200 s) | Yes (`SerialNumber`, `TokenCode`) | Yes (1 inline + up to 10 ARNs) | Yes (up to 50, transitive) | Credentials, AssumedRoleUser, SourceIdentity, size fields | `arn:aws:sts::ACCT:assumed-role/ROLE/SESSION` |
| `AssumeRoleWithSAML` | Anyone holding a SAML response from a trusted IdP | None (unsigned) | Not applicable | 900 s / 3600 s / min(role max, `SessionNotOnOrAfter`) | No | Yes | Yes (via SAML attributes) | Credentials, AssumedRoleUser, Issuer, Audience, Subject, SubjectType, NameQualifier, SourceIdentity | `arn:aws:sts::ACCT:assumed-role/ROLE/SESSION` |
| `AssumeRoleWithWebIdentity` | Anyone holding an OIDC ID token / OAuth 2.0 token | None (unsigned) | Not applicable | 900 s / 3600 s / role max (12 h) | No | Yes | Yes (via token claim) | Credentials, AssumedRoleUser, SubjectFromWebIdentityToken, Audience, Provider, SourceIdentity | `arn:aws:sts::ACCT:assumed-role/ROLE/SESSION` |
| `AssumeRoot` | Principal in the Organizations management account or IAM delegated admin account (not root) | SigV4, regional endpoint only | Yes (unverified; any non-root principal with `sts:AssumeRoot`) | 0 s (API range) / 900 s / 900 s | No | Task policy only (`TaskPolicyArn`, 1 of 5 AWS managed `root-task` policies) | No | Credentials, SourceIdentity, size fields | Member account root (format unverified) |
| `GetSessionToken` | IAM user (or root, not recommended) | SigV4, long-term keys | No | IAM user 900 s / 43200 s / 129600 s; root 900 s / 3600 s / 3600 s | Yes | No | No | Credentials, size fields | Same as calling IAM user (unverified) |
| `GetFederationToken` | IAM user (or root, not recommended), typically a broker | SigV4, long-term keys | No | IAM user 900 s / 43200 s / 129600 s; root 900 s / 3600 s / 3600 s | No | Yes (effectively required) | Yes (up to 50) | Credentials, FederatedUser, size fields | `arn:aws:sts::ACCT:federated-user/NAME` |
| `GetDelegatedAccessToken` | Onboarded AWS Partner account | SigV4 | Unverified | Fixed by delegation request `SessionDuration` (300 s to 43200 s), counted from token release | No | Fixed by partner policy template | No | Credentials, AssumedPrincipal | `AssumedPrincipal` ARN (format unverified) |
| `GetWebIdentityToken` | IAM role or IAM user (workload) | SigV4, regional endpoint only | Yes (token can't outlive session) | 60 s / 300 s / 3600 s (JWT lifetime) | No | No | Custom claims via `Tags` (up to 50) | `WebIdentityToken` (JWT), `Expiration` | Not applicable (JWT `sub` is principal ARN) |
| `GetCallerIdentity` | Any authenticated principal | SigV4 | Yes | Not applicable | No | No | No | Account, Arn, UserId | Not applicable |
| `GetAccessKeyInfo` | Any principal with permission | SigV4 | Yes (unverified) | Not applicable | No | No | No | Account | Not applicable |
| `DecodeAuthorizationMessage` | Any principal with permission | SigV4 | Yes (unverified) | Not applicable | No | No | No | DecodedMessage (JSON string) | Not applicable |

Sources: per-operation API Reference pages (linked in each section), [Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html), [IAM temporary delegation building guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/temporary-delegation-building-integration.html), [CreateDelegationRequest](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateDelegationRequest.html).

### What the resulting credentials can call

| Credentials from | Restrictions on the resulting session (per AWS docs) |
| --- | --- |
| `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` | Can call any AWS service except STS `GetFederationToken` and `GetSessionToken`. |
| `GetSessionToken` | Cannot call IAM APIs unless MFA information was included in the `GetSessionToken` request. Cannot call STS APIs except `AssumeRole` and `GetCallerIdentity`. Console SSO through the federation endpoint is not allowed. |
| `GetFederationToken` | Cannot call IAM APIs via CLI/API (console sessions are exempt). Cannot call STS APIs except `GetCallerIdentity`. Console SSO is allowed. Without a session policy the session has no permissions. |
| `AssumeRoot` | Scoped to the selected `root-task` managed policy (for example only deleting an S3 bucket policy). |
| `GetDelegatedAccessToken` | Scoped to the partner's pre-registered policy template as approved by the customer. |

Sources: [Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html), [GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html), [GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html), [AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html), [IAM temporary delegation partner guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-temporary-delegation-partner-guide.html).

## Common request and response building blocks

### Shared request parameters

| Parameter | Used by | Constraint |
| --- | --- | --- |
| `RoleArn` | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity | 20 to 2048 chars, required |
| `RoleSessionName` | AssumeRole, AssumeRoleWithWebIdentity (SAML takes it from the assertion attribute) | 2 to 64 chars, pattern `[\w+=,.@-]*`, required |
| `DurationSeconds` | All credential-vending operations, plus `GetWebIdentityToken` | Ranges differ per operation; see the matrix |
| `Policy` | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, GetFederationToken | Inline JSON session policy; inline + managed plaintext combined cannot exceed 2,048 characters; allowed characters are `\u0009`, `\u000A`, `\u000D` and ` ` through `ÿ` |
| `PolicyArns.member.N` | Same four | Up to 10 managed policy ARNs, which must be in the same account as the role (or IAM user for GetFederationToken) |
| `Tags.member.N` | AssumeRole, GetFederationToken, GetWebIdentityToken | Up to 50; key max 128 chars, value max 256 chars; keys case-insensitive (case preserved) |
| `TransitiveTagKeys.member.N` | AssumeRole | Up to 50 keys, each 1 to 128 chars |
| `ExternalId` | AssumeRole | 2 to 1224 chars, pattern `[\w+=,.@:\/-]*` |
| `SerialNumber` | AssumeRole, GetSessionToken | 9 to 256 chars; hardware serial (for example `GAHT12345678`) or virtual MFA ARN (`arn:aws:iam::123456789012:mfa/user`) |
| `TokenCode` | AssumeRole, GetSessionToken | Exactly 6 digits |
| `SourceIdentity` | AssumeRole | 2 to 64 chars, `[\w+=,.@-]*`, must not start with `aws:` |
| `ProvidedContexts.member.N` | AssumeRole | 1 to 5 `ProvidedContext` objects (`ProviderArn`, `ContextAssertion`) |
| `MinimumSessionTokenSize` | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, AssumeRoot, GetFederationToken, GetSessionToken | 0 to 4096 bytes; pads the session token up to this size for testing |

Sources: [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html), [AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html), [AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html), [GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html), [GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html), [AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html).

### The Credentials object

| Field | Type | Notes |
| --- | --- | --- |
| `AccessKeyId` | String, 16 to 128 chars, `[\w]*` | Temporary keys start with `ASIA` |
| `SecretAccessKey` | String | Used to sign requests |
| `SessionToken` | String | Must be sent as `X-Amz-Security-Token`; size is not fixed, currently capped at 4,096 bytes |
| `Expiration` | Timestamp | UTC expiry |

Sources: [Credentials](https://docs.aws.amazon.com/STS/latest/APIReference/API_Credentials.html), [GetAccessKeyInfo](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html), [What's New 2026-09-15](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/).

The `AssumedRoleUser` object contains `Arn` (20 to 2048 chars) and `AssumedRoleId` (2 to 193 chars, `ROLEID:SESSIONNAME`) ([AssumedRoleUser](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumedRoleUser.html)).

### Session token size fields

| Field | Meaning |
| --- | --- |
| `SessionTokenSize` | Size of the returned session token in bytes |
| `SessionTokenUtilization` | Percentage (0 to 100) of the maximum token size consumed |
| `PackedPolicySize` | Deprecated; now reports the same value as `SessionTokenUtilization` |

The API Reference lists `SessionTokenSize` and `SessionTokenUtilization` in the responses of `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, `AssumeRoot`, `GetFederationToken`, and `GetSessionToken`. It lists `PackedPolicySize` for the three `AssumeRole*` operations and `GetFederationToken`, and for `GetDelegatedAccessToken` it says the field is "not populated" ([API Reference action pages](https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html)).

## AssumeRole

Reference: [API_AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)

### Purpose and caller

`AssumeRole` returns temporary credentials for an IAM role. You typically use it within one account or for cross-account access. The caller must be an IAM user or an IAM role session that already holds temporary credentials ([Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html)). Two policies must allow the call:

- The role's **trust policy** must trust the caller, either the account or the principal directly.
- For cross-account access, the caller also needs an identity-based policy that allows `sts:AssumeRole` on the role ARN. In the same account, either of the two is enough, because the trust policy is a resource-based policy.

Temporary credentials can call it, including credentials from `GetSessionToken`. Credentials from `GetFederationToken` cannot ([Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html)).

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `RoleArn` | Yes | 20 to 2048 chars |
| `RoleSessionName` | Yes | 2 to 64 chars, `[\w+=,.@-]*`; appears in the session ARN and in cross-account CloudTrail |
| `DurationSeconds` | No | 900 to 43200, default 3600; must be at or below the role's maximum session duration (1 h to 12 h) |
| `Policy` | No | Inline session policy, combined plaintext at most 2,048 chars |
| `PolicyArns.member.N` | No | Up to 10 managed policy ARNs |
| `Tags.member.N` | No | Up to 50 session tags; they override role tags with the same key |
| `TransitiveTagKeys.member.N` | No | Up to 50 keys that persist through role chaining |
| `ExternalId` | No | 2 to 1224 chars; confused-deputy protection for third parties |
| `SerialNumber` | No | MFA device serial or ARN, 9 to 256 chars |
| `TokenCode` | No | 6-digit TOTP |
| `SourceIdentity` | No | 2 to 64 chars; persists across chained sessions; requires `sts:SetSourceIdentity` |
| `ProvidedContexts.member.N` | No | 1 to 5 trusted context assertions, for example from `arn:aws:iam::aws:contextProvider/IdentityCenter`; requires `sts:SetContext` |
| `MinimumSessionTokenSize` | No | 0 to 4096 |

### Duration rules

- The minimum is 900 s and the default is 3600 s. The maximum is the role's `MaxSessionDuration`, which can be set from 1 h to 12 h (43200 s). If you request more than that, the call fails.
- **Role chaining**, meaning `AssumeRole` called with role-session credentials, is capped at 1 hour for CLI and API sessions. A `DurationSeconds` above 3600 fails ([AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html), [re:Post role chaining](https://repost.aws/knowledge-center/iam-role-chaining-limit)).
- The console session duration is a separate setting. It is the `SessionDuration` you pass to the federation endpoint.

### MFA

The trust policy can require `"Condition": {"Bool": {"aws:MultiFactorAuthPresent": true}}`. In that case the caller must pass `SerialNumber` and `TokenCode`, or the request is denied.

### Returns

`Credentials`, `AssumedRoleUser` (`Arn`, `AssumedRoleId`), `SourceIdentity`, `PackedPolicySize` (deprecated), `SessionTokenSize`, `SessionTokenUtilization`.

### Errors

`ExpiredToken` (400), `MalformedPolicyDocument` (400), `PackedPolicyTooLarge` (400), `RegionDisabled` (403), plus common errors such as `AccessDenied`.

### Example

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/demo \
  --role-session-name alice-cli \
  --duration-seconds 3600 \
  --external-id 123ABC \
  --source-identity alice \
  --tags Key=Project,Value=Pegasus Key=Team,Value=Engineering \
  --transitive-tag-keys Project \
  --serial-number arn:aws:iam::123456789012:mfa/alice \
  --token-code 123456
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW...",
    "Expiration": "2026-10-10T13:34:41+00:00"
  },
  "AssumedRoleUser": {
    "AssumedRoleId": "AROA123EXAMPLE123:alice-cli",
    "Arn": "arn:aws:sts::123456789012:assumed-role/demo/alice-cli"
  },
  "PackedPolicySize": 12,
  "SourceIdentity": "alice",
  "SessionTokenSize": 512,
  "SessionTokenUtilization": 12
}
```

The values in this response are illustrative. The field names come from the API Reference, and the AssumedRoleId / ARN shape matches the [GetCallerIdentity example 2](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html).

## AssumeRoleWithSAML

Reference: [API_AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)

### Purpose and caller

`AssumeRoleWithSAML` exchanges a SAML 2.0 authentication response from an enterprise IdP for role credentials. **It does not require AWS credentials.** STS validates the caller by checking the assertion against the metadata document of the IAM SAML provider. Before you can call it, three things must exist:

- an IAM SAML provider entity
- a role whose trust policy names that provider
- an IdP configured to emit the attributes AWS requires

It does not work on IAM Identity Center managed roles (names starting with `AWSReservedSSO_`). CloudTrail records the assertion's `NameID`, so AWS recommends a non-PII format such as `urn:oasis:names:tc:SAML:2.0:nameid-format:persistent`.

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `RoleArn` | Yes | 20 to 2048 chars |
| `PrincipalArn` | Yes | ARN of the IAM SAML provider, 20 to 2048 chars |
| `SAMLAssertion` | Yes | Base64 SAML response, 4 to 100000 chars |
| `DurationSeconds` | No | 900 to 43200, default 3600 |
| `Policy` | No | 1 to 2048 chars |
| `PolicyArns.member.N` | No | Up to 10 |
| `MinimumSessionTokenSize` | No | 0 to 4096 |

Session tags (up to 50), transitive tags, `RoleSessionName`, and `SourceIdentity` come from attributes in the SAML assertion, not from API parameters.

### Duration

The session lasts for `DurationSeconds` (900 s up to the role maximum, default 3600 s) or until the assertion's `SessionNotOnOrAfter`, whichever is shorter.

### MFA

No MFA parameters ([Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html)). MFA is the IdP's responsibility.

### Returns

`Credentials`, `AssumedRoleUser`, plus fields copied from the assertion:

- `Audience`: the `Recipient` of `SubjectConfirmationData`
- `Issuer`
- `Subject`: the `NameID`
- `SubjectType`: for example `transient` or `persistent`; the `urn:oasis:names:tc:SAML:2.0:nameid-format:` prefix is stripped

It also returns `NameQualifier`, which is `BASE64(SHA1(Issuer + AccountId + "/" + ProviderFriendlyName))`, along with `SourceIdentity` and the size fields.

### Errors

`ExpiredToken`, `IDPRejectedClaim` (403), `InvalidIdentityToken`, `MalformedPolicyDocument`, `PackedPolicyTooLarge`, `RegionDisabled`.

### Example

```bash
aws sts assume-role-with-saml \
  --role-arn arn:aws:iam::123456789012:role/TestSaml \
  --principal-arn arn:aws:iam::123456789012:saml-provider/SAML-test \
  --saml-assertion file://samlresponse.b64 \
  --duration-seconds 3600
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAV3ZUEFP6EXAMPLE",
    "SecretAccessKey": "8P+SQvWIuLnKhh8d++jpw0nNmQRBZvNEXAMPLEKEY",
    "SessionToken": "IQoJb3JpZ2luX2VjEOz////////////////////wEXAMPLEtMSJHMEUCIDoKK3JH9uG...",
    "Expiration": "2026-10-10T20:26:47+00:00"
  },
  "AssumedRoleUser": {
    "AssumedRoleId": "AROA456EXAMPLE789:alice@example.com",
    "Arn": "arn:aws:sts::123456789012:assumed-role/TestSaml/alice@example.com"
  },
  "Subject": "SamlExample",
  "SubjectType": "transient",
  "Issuer": "https://integ.example.com/idp/shibboleth",
  "Audience": "https://signin.aws.amazon.com/saml",
  "NameQualifier": "SbdGOnUkh1i4+EXAMPLExL/jEvs=",
  "SourceIdentity": "SourceIdentityValue",
  "PackedPolicySize": 6,
  "SessionTokenSize": 480,
  "SessionTokenUtilization": 12
}
```

## AssumeRoleWithWebIdentity

Reference: [API_AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)

### Purpose and caller

`AssumeRoleWithWebIdentity` exchanges an OpenID Connect ID token, or an OAuth 2.0 access token from Login with Amazon or Facebook, for role credentials. Example token sources include GitHub Actions, Amazon EKS service accounts, Google, and Amazon Cognito. **No AWS credentials are required.** The role's trust policy must name the identity provider. For mobile apps, AWS recommends Amazon Cognito. CloudTrail records the token's subject, so AWS recommends a GUID or pairwise identifier instead of PII.

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `RoleArn` | Yes | 20 to 2048 chars |
| `RoleSessionName` | Yes | 2 to 64 chars |
| `WebIdentityToken` | Yes | 4 to 20000 chars; signed with RS256/RS384/RS512 or ES256/ES384/ES512; integer timestamps |
| `ProviderId` | No | Only for OAuth 2.0 access tokens: `www.amazon.com` or `graph.facebook.com`; omit for OIDC |
| `DurationSeconds` | No | 900 to 43200, default 3600, at most the role maximum |
| `Policy` | No | 1 to 2048 chars |
| `PolicyArns.member.N` | No | Up to 10 |
| `MinimumSessionTokenSize` | No | 0 to 4096 |

Session tags and the source identity come from claims in the token. For Cognito identity pools that assume cross-account roles, the trust policy must restrict access with `cognito-identity.amazonaws.com:aud`.

### MFA

No MFA parameters.

### Returns

`Credentials`, `AssumedRoleUser`, `SubjectFromWebIdentityToken` (the `sub` claim, 6 to 255 chars), `Audience` (the client ID), `Provider` (`iss`, or the `ProviderId` for OAuth 2.0), `SourceIdentity`, plus the size fields.

### Errors

`ExpiredToken`, `IDPCommunicationError` (400, retryable), `IDPRejectedClaim` (403), `InvalidIdentityToken`, `MalformedPolicyDocument`, `PackedPolicyTooLarge`, `RegionDisabled`.

### Example

```bash
aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::123456789012:role/FederatedWebIdentityRole \
  --role-session-name app1 \
  --web-identity-token file://id_token.jwt \
  --duration-seconds 3600
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoDYXdzEE0a8ANXXXXXXXXNO1ewxE5TijQyp+IEXAMPLE...",
    "Expiration": "2026-10-10T23:00:23+00:00"
  },
  "SubjectFromWebIdentityToken": "repo:example-org/example-repo:ref:refs/heads/main",
  "AssumedRoleUser": {
    "AssumedRoleId": "AROACLKWSDQRAOEXAMPLE:app1",
    "Arn": "arn:aws:sts::123456789012:assumed-role/FederatedWebIdentityRole/app1"
  },
  "Provider": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com",
  "Audience": "sts.amazonaws.com",
  "SourceIdentity": "SourceIdentityValue",
  "PackedPolicySize": 8,
  "SessionTokenSize": 470,
  "SessionTokenUtilization": 11
}
```

The `Provider` value here is illustrative and **(unverified)**. The API Reference says that for OIDC tokens `Provider` "contains the value of the `iss` field", but the CLI output that the SDKs commonly show for OIDC providers uses the provider ARN form.

## AssumeRoot

Reference: [API_AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)

### Purpose and caller

`AssumeRoot` returns short-term credentials for performing **privileged root-only tasks** on a member account in AWS Organizations, without that account having root credentials. You must call it with credentials from the Organizations management account or from the IAM delegated administrator account. **Root user credentials cannot call it.** You must first enable centralized root access, which includes `aws iam enable-organizations-root-sessions`. The call must go to a **Regional** STS endpoint; the global endpoint is not supported. It launched on 2024-11-14 ([What's New](https://aws.amazon.com/about-aws/whats-new/2024/11/manage-root-access-aws-identity-access-management/), [AWS News Blog](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)).

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `TargetPrincipal` | Yes | Member account ID or principal ARN, 12 to 2048 chars |
| `TaskPolicyArn` | Yes | One of the AWS managed `arn:aws:iam::aws:policy/root-task/...` policies: `IAMAuditRootUserCredentials`, `IAMCreateRootUserPassword`, `IAMDeleteRootUserCredentials`, `S3UnlockBucketPolicy`, `SQSUnlockQueuePolicy` |
| `DurationSeconds` | No | API range 0 to 900, default 900 |
| `MinimumSessionTokenSize` | No | 0 to 4096 |

The IAM action is `sts:AssumeRoot` on resource type `root-user` (`arn:aws:iam::ACCOUNT:root`), with condition key `sts:TaskPolicyArn` ([list_sts](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)).

### Duration

The maximum and default are both 900 s (15 minutes) ([AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html), [AWS Security Blog](https://aws.amazon.com/blogs/security/secure-root-user-access-for-member-accounts-in-aws-organizations/)).

### Returns

`Credentials`, `SourceIdentity`, `SessionTokenSize`, `SessionTokenUtilization`. **No `AssumedRoleUser`.**

### Errors

`ExpiredToken`, `RegionDisabled`, plus common errors.

### Example

```bash
aws sts assume-root \
  --region us-east-1 \
  --target-principal 111122223333 \
  --task-policy-arn arn=arn:aws:iam::aws:policy/root-task/S3UnlockBucketPolicy \
  --duration-seconds 900
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAJEXAMPLEXEG2JICEA",
    "SecretAccessKey": "9drTJvcXLB89EXAMPLELB8923FB892xMFI",
    "SessionToken": "AQoXdzELDDY//////////wEaoAK1wvxJY12r2IrDFT2IvAzTCn3zHoZ7YNtpiQLF0MqZye...",
    "Expiration": "2026-10-10T00:15:07+00:00"
  },
  "SourceIdentity": "Alice",
  "SessionTokenSize": 410,
  "SessionTokenUtilization": 10
}
```

This example is adapted from the [AWS CLI STS examples](https://docs.aws.amazon.com/cli/latest/userguide/cli_sts_code_examples.html). The ARN that `GetCallerIdentity` returns inside a root session is **(unverified)**; it would presumably be `arn:aws:iam::111122223333:root`.

## GetSessionToken

Reference: [API_GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html)

### Purpose and caller

`GetSessionToken` returns temporary credentials for an IAM user or for the account root user. Its main use is MFA-protected API access. It **must be called with long-term credentials** (`AKIA` keys) of an IAM user. Root can call it but AWS does not recommend this, and the resulting credentials then carry root permissions. **No permissions are required.** The operation is an authentication step, and policies cannot control authentication operations. The resulting credentials have the same permissions as the calling IAM user.

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `DurationSeconds` | No | 900 to 129600; default 43200 for IAM users; root max 3600 (longer values default to 1 h) |
| `SerialNumber` | No | 9 to 256 chars |
| `TokenCode` | No | 6 digits; an incorrect code returns access denied |
| `MinimumSessionTokenSize` | No | 0 to 4096 |

### Duration

| Caller | Min | Default | Max |
| --- | --- | --- | --- |
| IAM user | 15 min | 12 h | 36 h |
| Root user | 15 min | 1 h | 1 h |

### Resulting session

- It cannot call IAM APIs unless MFA information was included in the request.
- It cannot call STS APIs except `AssumeRole` and `GetCallerIdentity`.
- It cannot be used for console SSO.

No session policies and no session tags are supported ([Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html)).

### Returns

`Credentials`, `SessionTokenSize`, `SessionTokenUtilization`.

### Errors

`RegionDisabled`, plus common errors.

### Example

```bash
aws sts get-session-token \
  --serial-number arn:aws:iam::123456789012:mfa/alice \
  --token-code 123456 \
  --duration-seconds 43200
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT+FvwqnKwRcOIfrRh3c/L...",
    "Expiration": "2026-10-11T00:00:00+00:00"
  },
  "SessionTokenSize": 380,
  "SessionTokenUtilization": 9
}
```

When `GetCallerIdentity` is called with these credentials, it should return the IAM user's own ARN (`arn:aws:iam::123456789012:user/alice`) **(unverified)**.

## GetFederationToken

Reference: [API_GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html)

### Purpose and caller

`GetFederationToken` returns credentials for an **AWS STS federated user principal**. It is designed for a server-side proxy or custom identity broker. It **must be called with the long-term credentials of an IAM user**. Root is possible but not recommended. The caller needs `sts:GetFederationToken` (resource type `federated-user`), plus `sts:TagSession` if it passes tags.

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `Name` | Yes | Federated user name, 2 to 32 chars, `[\w+=,.@-]*` |
| `DurationSeconds` | No | 900 to 129600, default 43200; root max 3600 |
| `Policy` | No | 1 to 2048 chars |
| `PolicyArns.member.N` | No | Up to 10, in the IAM user's account |
| `Tags.member.N` | No | Up to 50; they override user tags with the same key |
| `MinimumSessionTokenSize` | No | 0 to 4096 |

Session policies are optional in the API, but **if you pass none, the federated session has no permissions**. Effective permissions are the intersection of the IAM user's policies and the session policies. A resource-based policy that names the federated user ARN as `Principal` grants permissions in addition to that intersection.

### Duration

IAM user: 15 min / 12 h / 36 h. Root: 15 min / 1 h / 1 h.

### MFA

Not supported.

### Resulting session

- It cannot call IAM via CLI or API. Console sessions are exempt.
- It cannot call any STS API except `GetCallerIdentity`.
- Console SSO through the federation endpoint is allowed.

### Returns

`Credentials`, `FederatedUser` (`Arn` such as `arn:aws:sts::123456789012:federated-user/Bob`, `FederatedUserId` such as `123456789012:Bob`), `PackedPolicySize`, `SessionTokenSize`, `SessionTokenUtilization`.

### Errors

`MalformedPolicyDocument`, `PackedPolicyTooLarge`, `RegionDisabled`.

### Example

```bash
aws sts get-federation-token \
  --name Bob \
  --policy-arns arn=arn:aws:iam::123456789012:policy/federateduserdemopolicy1 \
  --duration-seconds 3600 \
  --tags Key=Dept,Value=Accounting
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW...",
    "Expiration": "2026-10-10T13:28:33+00:00"
  },
  "FederatedUser": {
    "FederatedUserId": "123456789012:Bob",
    "Arn": "arn:aws:sts::123456789012:federated-user/Bob"
  },
  "PackedPolicySize": 6,
  "SessionTokenSize": 420,
  "SessionTokenUtilization": 6
}
```

## GetDelegatedAccessToken

Reference: [API_GetDelegatedAccessToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html)

### Purpose and caller

`GetDelegatedAccessToken` is the STS half of **IAM temporary delegation**, launched 2025-11-19 ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/streamline-integration-partner-products-iam-delegation/)). It exchanges a _trade-in token_ (also called an exchange token) for temporary credentials in the customer's account. The Service Authorization Reference says it "is intended to be used only by Amazon or AWS Partners" ([list_sts](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)). Partners must be onboarded first, which requires ISV Accelerate enrollment and an AWS Marketplace listing. AWS then enables `CreateDelegationRequest` and `GetDelegatedAccessToken` for the partner's registered account IDs ([partner guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-temporary-delegation-partner-guide.html)).

### Flow

1. The partner calls IAM `CreateDelegationRequest` with a registered policy template and `SessionDuration` (300 to 43200 s).
2. The customer reviews and approves the request in the IAM console. IAM records the approving identity, and that identity is mapped to the delegated credential ([AcceptDelegationRequest](https://docs.aws.amazon.com/IAM/latest/APIReference/API_AcceptDelegationRequest.html)).
3. The customer releases the token. IAM publishes it to the partner's SNS topic, and the request state becomes `FINALIZED`.
4. The partner calls `sts:GetDelegatedAccessToken` with `TradeInToken`.

The token can only be redeemed by the partner account that created the request. It can be redeemed many times, but every credential minted from one token expires at _release time + approved duration_. Redeeming after that time fails ([Building your integration](https://docs.aws.amazon.com/IAM/latest/UserGuide/temporary-delegation-building-integration.html), [CreateDelegationRequest](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateDelegationRequest.html)).

### Parameters

`TradeInToken` (String, required, must be valid and unexpired).

### Returns

`Credentials`, `AssumedPrincipal` (ARN of the IAM entity whose permissions the credentials carry, 20 to 2048 chars), `PackedPolicySize` (deprecated, not populated).

### Errors

`ExpiredTradeInToken` (400), `PackedPolicyTooLarge` (400).

### MFA, session policies, tags

None exposed on this API.

### Example

```bash
aws sts get-delegated-access-token --trade-in-token "eyJhbGciOi...EXAMPLE"
```

```json
{
  "Credentials": {
    "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
    "SessionToken": "IQoJb3JpZ2luX2VjEXAMPLE...",
    "Expiration": "2026-10-10T12:00:00+00:00"
  },
  "AssumedPrincipal": "arn:aws:iam::111122223333:user/approver"
}
```

The CLI flag name follows the standard parameter-to-flag mapping. The `AssumedPrincipal` value is illustrative; its exact format is **(unverified)**. Whether temporary credentials can call this API is also **(unverified)**.

## GetWebIdentityToken

Reference: [API_GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)

### Purpose and caller

`GetWebIdentityToken` powers **IAM outbound identity federation**, launched 2025-11-19 ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/)). It returns a **signed JWT** that represents the calling AWS identity, for use with external services that support OIDC discovery. It does **not** return AWS credentials. The callers are IAM roles and users, typically workloads using EC2 instance-profile or Lambda execution-role credentials ([AWS News Blog](https://aws.amazon.com/blogs/aws/simplify-access-to-external-services-using-aws-iam-outbound-identity-federation/)). Before principals can call it, the account must enable the feature with IAM `EnableOutboundWebIdentityFederation`, which also creates the account's unique issuer URL ([CLI reference](https://docs.aws.amazon.com/cli/latest/reference/iam/enable-outbound-web-identity-federation.html)). It is **not available on the STS global endpoint**.

### Parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `Audience.member.N` | Yes | 1 to 10 audiences, each 1 to 1000 chars; populates `aud` |
| `SigningAlgorithm` | Yes | `RS256` or `ES384` |
| `DurationSeconds` | No | 60 to 3600, default 300 |
| `Tags.member.N` | No | Up to 50; become custom claims; require `sts:TagGetWebIdentityToken` |

You can restrict calls with the IAM condition keys `sts:IdentityTokenAudience`, `sts:DurationSeconds`, `sts:SigningAlgorithm`, `aws:RequestTag/${TagKey}`, and `aws:TagKeys` ([list_sts](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html), [Getting started](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_getting_started.html)).

### Returns

`WebIdentityToken` (JWT) and `Expiration`.

### Token claims

The token carries the standard claims:

- `iss`, an account-specific issuer such as `https://<id>.tokens.sts.global.api.aws`
- `aud`
- `sub`, the principal ARN, for example `arn:aws:iam::123456789012:role/DataProcessingRole`
- `iat`, `exp`, `jti`

AWS-specific claims are nested under the `https://sts.amazonaws.com/` namespace. They include `aws_account`, `source_region`, `org_id`, `ou_path`, `principal_tags`, `request_tags`, and session context such as `lambda_source_function_arn` ([Understanding token claims](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_token_claims.html)).

### Errors

`JWTPayloadSizeExceeded` (400), `OutboundWebIdentityFederationDisabled` (403), `SessionDurationEscalation` (403: the token would outlive the calling session).

### Example

```bash
aws sts get-web-identity-token \
  --region us-east-1 \
  --audience https://api.example.com \
  --signing-algorithm RS256 \
  --duration-seconds 300
```

```json
{
  "WebIdentityToken": "eyJraWQiOiJFWEFNUExFIiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiJodHRwczovL2V4YW1wbGUudG9rZW5zLnN0cy5nbG9iYWwuYXBpLmF3cyJ9.SIGNATURE",
  "Expiration": "2026-10-10T22:44:21.703000+00:00"
}
```

## GetCallerIdentity

Reference: [API_GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)

### Purpose and caller

`GetCallerIdentity` returns the account, ARN, and unique ID of whoever signed the request. **No permissions are required.** Even an explicit `Deny` on `sts:GetCallerIdentity` does not block it, because the same information is returned in access-denied errors anyway. Any valid credentials can call it, temporary or long-term. That includes `GetFederationToken` and `GetSessionToken` sessions, for which it is one of the few STS APIs still allowed. It takes no request parameters.

### Returns

`Account`, `Arn` (20 to 2048 chars), `UserId` (the `aws:userid` value).

### Example

```bash
aws sts get-caller-identity
```

```json
{
  "UserId": "AROA123EXAMPLE123:my-role-session-name",
  "Account": "123456789012",
  "Arn": "arn:aws:sts::123456789012:assumed-role/my-role-name/my-role-session-name"
}
```

### Documented outputs per caller type

| Caller | `Arn` | `UserId` |
| --- | --- | --- |
| IAM user Alice | `arn:aws:iam::123456789012:user/Alice` | `AIDACKCEVSQ6C2EXAMPLE` |
| AssumeRole session | `arn:aws:sts::123456789012:assumed-role/my-role-name/my-role-session-name` | `ARO123EXAMPLE123:my-role-session-name` |
| GetFederationToken session | `arn:aws:sts::123456789012:federated-user/my-federated-user-name` | `123456789012:my-federated-user-name` |

Source: the three examples on [API_GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html).

## GetAccessKeyInfo

Reference: [API_GetAccessKeyInfo](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)

### Purpose and caller

`GetAccessKeyInfo` returns the **account ID that owns an access key ID**. It is useful for triaging leaked keys. It does not reveal the key's state: the key may be active, inactive, or deleted, and a deleted key may return a "does not exist" error. It requires `sts:GetAccessKeyInfo` (access level Read). `AKIA` keys are long-term keys of an IAM user or the root user. `ASIA` keys are STS temporary keys. To find out who owns a key, check the credential report for `AKIA` keys, or the STS events in CloudTrail for `ASIA` keys.

### Parameters

`AccessKeyId` (required, 16 to 128 chars, `[\w]*`).

### Returns

`Account`.

### Example

```bash
aws sts get-access-key-info --access-key-id AKIAI44QH8DHBEXAMPLE
```

```json
{
  "Account": "111122223333"
}
```

## DecodeAuthorizationMessage

Reference: [API_DecodeAuthorizationMessage](https://docs.aws.amazon.com/STS/latest/APIReference/API_DecodeAuthorizationMessage.html)

### Purpose and caller

`DecodeAuthorizationMessage` decodes the encoded authorization-failure message that some AWS operations (notably EC2) return with an HTTP 403. The message is encoded because it may contain privileged detail, so the caller needs `sts:DecodeAuthorizationMessage`.

### Decoded content

The decoded JSON includes:

- whether the request was denied by an explicit deny or by the absence of an allow
- the principal
- the action
- the resource
- the condition key values in the request context

### Parameters

`EncodedMessage` (required, 1 to 10240 chars).

### Returns

`DecodedMessage` (String).

### Errors

`InvalidAuthorizationMessage` (400), returned for invalid characters such as line breaks, or for an expired message.

### Example

```bash
aws sts decode-authorization-message --encoded-message "EXAMPLE-ENCODED-MESSAGE" \
  --query DecodedMessage --output text
```

```json
{
  "allowed": false,
  "explicitDeny": false,
  "matchedStatements": {"items": []},
  "failures": {"items": []},
  "context": {
    "principal": {
      "id": "AIDACKCEVSQ6C2EXAMPLE",
      "name": "Bob",
      "arn": "arn:aws:iam::123456789012:user/Bob"
    },
    "action": "ec2:StopInstances",
    "resource": "arn:aws:ec2:us-east-1:123456789012:instance/i-dd01c9bd",
    "conditions": {
      "items": [
        {"key": "ec2:Tenancy", "values": {"items": [{"value": "default"}]}}
      ]
    }
  }
}
```

The structure follows the API Reference sample. The nested `items` wrapping matches typical real output and is **(unverified)** against the official sample, which shows a simplified shape.

## Identifier prefixes and principal ARN formats

### Unique ID prefixes

| Prefix | Resource type |
| --- | --- |
| `ABIA` | AWS STS service bearer token |
| `ACCA` | Context-specific credential |
| `AGPA` | User group |
| `AIDA` | IAM user |
| `AIPA` | Amazon EC2 instance profile |
| `AKIA` | Access key (long-term) |
| `ANPA` | Managed policy |
| `ANVA` | Version in a managed policy |
| `APKA` | Public key |
| `AROA` | Role |
| `ASCA` | Certificate |
| `ASIA` | Temporary (AWS STS) access key ID; unique only in combination with the secret key and session token |

Source: [IAM identifiers, Understanding unique ID prefixes](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html). AWS notes that "prefixes may vary based on when they were created". Older API Reference samples show other forms, for example `ARO123EXAMPLE123`.

### How GetAccessKeyInfo maps keys to accounts

`GetAccessKeyInfo` accepts either an `AKIA` or an `ASIA` key ID and returns the owning account. It never returns the user, the role, or the key's status ([GetAccessKeyInfo](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)). AWS documents only the API, not how the account is derived from the key ID. Community claims that the account ID is encoded in the key ID are **(unverified)** and are not covered here.

### Principal ARN, aws:userid, and aws:PrincipalArn

| Principal | ARN in `GetCallerIdentity` / CloudTrail | `aws:userid` | `aws:PrincipalArn` | `aws:PrincipalType` |
| --- | --- | --- | --- | --- |
| Root user | `arn:aws:iam::123456789012:root` | account ID | `arn:aws:iam::123456789012:root` | `Account` |
| IAM user | `arn:aws:iam::123456789012:user/Alice` | `AIDA...` unique ID | `arn:aws:iam::123456789012:user/Alice` | `User` |
| AssumeRole session | `arn:aws:sts::123456789012:assumed-role/RoleName/SessionName` | `AROA...:SessionName` | `arn:aws:iam::123456789012:role/RoleName` (role ARN, not session ARN) | `AssumedRole` |
| SAML session | same as AssumeRole | `AROA...:` + `RoleSessionName` SAML attribute | role ARN | `AssumedRole` |
| OIDC session | same as AssumeRole | `AROA...:` + `RoleSessionName` | role ARN | `AssumedRole` |
| EC2 instance role | `arn:aws:sts::123456789012:assumed-role/RoleName/i-0123456789abcdef0` | `AROA...:i-0123456789abcdef0` | role ARN | `AssumedRole` |
| Federated user (GetFederationToken) | `arn:aws:sts::123456789012:federated-user/Bob` | `123456789012:Bob` | `arn:aws:sts::123456789012:federated-user/Bob` | `FederatedUser` |

Sources: [Policy variables, principal key values](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html), [aws:PrincipalArn](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html), [IAM identifiers](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html). The EC2 session ARN form is inferred from the documented `aws:userid` value `role-id:ec2-instance-id` and is **(unverified)** as a full ARN. One more ARN, `arn:aws:sts::123456789012:self`, refers to the caller's own session when used as a resource, for example for `sts:SetContext`.

## Errors

Operation-specific errors:

| Error | HTTP | Operations |
| --- | --- | --- |
| `ExpiredToken` | 400 | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, AssumeRoot |
| `ExpiredTradeInToken` | 400 | GetDelegatedAccessToken |
| `IDPCommunicationError` | 400 | AssumeRoleWithWebIdentity |
| `IDPRejectedClaim` | 403 | AssumeRoleWithSAML, AssumeRoleWithWebIdentity |
| `InvalidAuthorizationMessage` | 400 | DecodeAuthorizationMessage |
| `InvalidIdentityToken` | 400 | AssumeRoleWithSAML, AssumeRoleWithWebIdentity |
| `JWTPayloadSizeExceeded` | 400 | GetWebIdentityToken |
| `MalformedPolicyDocument` | 400 | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, GetFederationToken |
| `OutboundWebIdentityFederationDisabled` | 403 | GetWebIdentityToken |
| `PackedPolicyTooLarge` | 400 | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, GetFederationToken, GetDelegatedAccessToken |
| `RegionDisabled` | 403 | AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, AssumeRoot, GetFederationToken, GetSessionToken |
| `SessionDurationEscalation` | 403 | GetWebIdentityToken |

Common errors for every operation include `AccessDeniedException` (403), `ExpiredTokenException` (403), `IncompleteSignature`, `InvalidParameterValue`, `MissingAuthenticationToken`, `RequestExpired` (more than 15 minutes of clock skew), `ThrottlingException`, `UnrecognizedClientException`, and `ValidationError` ([Common Error Types](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html)).

## Discrepancies and open questions

- **AssumeRoot `DurationSeconds` minimum**: the API Reference states a valid range of 0 to 900 and default 900, while other credential APIs use a 900 s floor. The documented 0 s minimum is reproduced as-is.
- **`Policy` length on AssumeRole**: the AssumeRole page lists only "Minimum length of 1" for `Policy`, while the SAML, WebIdentity, and GetFederationToken pages list a maximum of 2048. All four state that the combined plaintext limit is 2,048 characters.
- **`PackedPolicySize` on GetSessionToken / AssumeRoot**: the 2026-09 blog says `PackedPolicySize` is returned "in every successful response" of session-vending APIs. The API Reference pages for `GetSessionToken` and `AssumeRoot` do not list it. This document follows the API Reference.
- **"SetContext API"**: the IAM identifiers page describes `arn:aws:sts::account:self` as usable "in an API call, such as the AWS STS SetContext API". However, the API Reference has no `SetContext` action, and the Service Authorization Reference lists `sts:SetContext` as permission-only.
- **Compare AWS STS credentials table**: the table in the IAM User Guide does not yet include `AssumeRoot`, `GetDelegatedAccessToken`, or `GetWebIdentityToken`.
- **AssumeRoleWithSAML / AssumeRoleWithWebIdentity in the SAR operation table**: they appear in the actions table but not in the "API operations to IAM actions" table, consistent with the calls being unsigned.

## Sources

- [AWS STS API Reference: Welcome](https://docs.aws.amazon.com/STS/latest/APIReference/Welcome.html)
- [AWS STS API Reference: Actions](https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html)
- [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)
- [AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)
- [AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)
- [DecodeAuthorizationMessage](https://docs.aws.amazon.com/STS/latest/APIReference/API_DecodeAuthorizationMessage.html)
- [GetAccessKeyInfo](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)
- [GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)
- [GetDelegatedAccessToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html)
- [GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html)
- [GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html)
- [GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)
- [Credentials data type](https://docs.aws.amazon.com/STS/latest/APIReference/API_Credentials.html)
- [AssumedRoleUser data type](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumedRoleUser.html)
- [Common Error Types](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html)
- [Service Authorization Reference: AWS Security Token Service](https://docs.aws.amazon.com/service-authorization/latest/reference/list_sts.html)
- [IAM User Guide: Compare AWS STS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_sts-comparison.html)
- [IAM User Guide: IAM identifiers](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html)
- [IAM User Guide: Policy variables](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html)
- [IAM User Guide: Global condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)
- [IAM User Guide: Pass session tags in AWS STS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)
- [IAM User Guide: Service bearer tokens](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_bearer.html)
- [IAM User Guide: Federating AWS identities to external services](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound.html)
- [IAM User Guide: Getting started with outbound identity federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_getting_started.html)
- [IAM User Guide: Understanding token claims](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_token_claims.html)
- [IAM User Guide: IAM temporary delegation for AWS Partners](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-temporary-delegation-partner-guide.html)
- [IAM User Guide: Temporary delegation, building your integration](https://docs.aws.amazon.com/IAM/latest/UserGuide/temporary-delegation-building-integration.html)
- [IAM API Reference: CreateDelegationRequest](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateDelegationRequest.html)
- [IAM API Reference: AcceptDelegationRequest](https://docs.aws.amazon.com/IAM/latest/APIReference/API_AcceptDelegationRequest.html)
- [AWS CLI: enable-outbound-web-identity-federation](https://docs.aws.amazon.com/cli/latest/reference/iam/enable-outbound-web-identity-federation.html)
- [AWS CLI STS code examples](https://docs.aws.amazon.com/cli/latest/userguide/cli_sts_code_examples.html)
- [AWS CodeArtifact authentication and tokens](https://docs.aws.amazon.com/codeartifact/latest/ug/tokens-authentication.html)
- [What's New 2024-11: Centrally manage root access in IAM](https://aws.amazon.com/about-aws/whats-new/2024/11/manage-root-access-aws-identity-access-management/)
- [What's New 2025-11-19: IAM temporary delegation](https://aws.amazon.com/about-aws/whats-new/2025/11/streamline-integration-partner-products-iam-delegation/)
- [What's New 2025-11-19: IAM outbound identity federation](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/)
- [What's New 2026-09-15: STS session token size limits](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/)
- [AWS News Blog: Centrally managing root access](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)
- [AWS News Blog: IAM outbound identity federation](https://aws.amazon.com/blogs/aws/simplify-access-to-external-services-using-aws-iam-outbound-identity-federation/)
- [AWS Security Blog: Secure root user access for member accounts](https://aws.amazon.com/blogs/security/secure-root-user-access-for-member-accounts-in-aws-organizations/)
- [AWS Security Blog: STS session token size limits](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/)
- [AWS re:Post: Role chaining session duration](https://repost.aws/knowledge-center/iam-role-chaining-limit)
- [CloudWatch supported protocols FAQ](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-protocols-faq.html)
- [botocore STS service model (2011-06-15)](https://github.com/boto/botocore/blob/develop/botocore/data/sts/2011-06-15/service-2.json)
