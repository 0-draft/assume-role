# AWS STS Operations, Security, and Troubleshooting

_Last verified: 2026-10-10_

This chapter covers how AWS Security Token Service (STS) behaves in production: what CloudTrail records, how quotas and throttling work, what it costs, every documented error and its fix, the threat model for temporary credentials, and a hardening checklist. Each claim links to its source. Claims marked "(unverified)" could not be confirmed in an official AWS source.

## CloudTrail logging

### What gets logged

- CloudTrail logs every authenticated request to IAM and STS API operations, plus the unauthenticated `AssumeRoleWithSAML` and `AssumeRoleWithWebIdentity` calls together with the information the IdP supplied. Some unauthenticated STS requests are not logged because they are not "sufficiently valid to be trusted as a legitimate request" ([IAM User Guide: Logging IAM and AWS STS API calls](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).
- CloudTrail does not log denied STS requests in the target account for cross-account role assumptions, or for privileged sessions started with `AssumeRoot` ([same page](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)). A failed cross-account `AssumeRole` therefore appears only in the caller's account.
- All STS events are management events (`"managementEvent": true`, `"eventCategory": "Management"`) ([same page](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)). The CloudTrail data events resource type table contains no STS or IAM resource type (checked 2026-10 against [Logging data events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)), so STS has no data events.
- `GetCallerIdentity` is logged. The IAM User Guide states that "All IAM and AWS STS actions are logged by CloudTrail" ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)), and detection content keys on `eventSource: sts.amazonaws.com` with `eventName: GetCallerIdentity` (for example [Elastic's "GetCallerIdentity API Called for the First Time" rule](https://www.elastic.co/guide/en/security/current/aws-sts-getcalleridentity-api-called-for-the-first-time.html) and [detectioninthe.cloud](https://detectioninthe.cloud/ttps/discovery/sts_get_caller_identity/)).
- `AssumeRole`, `AssumeRoleWithSAML`, and `AssumeRoleWithWebIdentity` are logged as `readOnly: true`, but CloudTrail still includes the full `responseElements` (access key ID, session token, expiration, assumed role ARN) except `secretAccessKey`. `AssumeRoot`, `GetFederationToken`, and `GetSessionToken` are `readOnly: false` and also include response elements ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).
- A cross-account `AssumeRole` produces two records: one in the caller's account (`userIdentity.type` = caller type such as `IAMUser`) and one in the role owner's account (`userIdentity.type` = `AWSAccount` or `AWSService`). The two records share a `sharedEventID` ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html), [userIdentity reference](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html)).
- OIDC events include `additionalEventData.identityProviderConnectionVerificationMethod`, which is `IAMTrustStore` (AWS verified the IdP through its trusted root CA library) or `Thumbprint` ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).
- Successful session-vending calls record `sessionTokenSize` and `sessionTokenUtilization` in `responseElements` ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html), [AWS Security Blog, 2026](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/)).

### Which Region the event lands in

| Endpoint called | CloudTrail Region | Notes |
| --- | --- | --- |
| Regional, for example `sts.eu-north-1.amazonaws.com` | That Region | `awsRegion` is the Regional endpoint's Region. |
| Global `sts.amazonaws.com` | `us-east-1` | Logged as a global service event, even when the request was served locally in another Region. |

Since the 2025 global endpoint change, requests to `sts.amazonaws.com` from a default-enabled Region that resolve DNS through the Amazon VPC DNS server are served in the originating Region. CloudTrail still delivers those events to `us-east-1` and adds `additionalEventData.RequestDetails.endpointType` (`global` or `regional`) and `awsServingRegion` to show which endpoint type and Region served the request ([IAM User Guide: STS Regions and endpoints](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_region-endpoints.html), [CloudTrail examples](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)). The documented example shows `awsRegion: us-east-1`, `awsServingRegion: eu-north-1`, and `clientProvidedHostHeader: sts-global.eu-north-1.amazonaws.com`. `tlsDetails.clientProvidedHostHeader` tells you whether the client called the global or a Regional hostname, and `vpcEndpointId` appears when the call came through an interface VPC endpoint ([AWS Security Blog: How to use Regional AWS STS endpoints](https://aws.amazon.com/blogs/security/how-to-use-regional-aws-sts-endpoints/)).

Operational consequence: a multi-Region trail (the console default) is needed to see all STS activity, and global-endpoint calls must be searched in `us-east-1`.

### userIdentity types relevant to STS

| `userIdentity.type` | Meaning | Source |
| --- | --- | --- |
| `Root` | Request signed with root user credentials. | [CloudTrail userIdentity](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html) |
| `IAMUser` | Request signed with an IAM user's credentials. | same |
| `AssumedRole` | Temporary credentials from `AssumeRole*` (EC2 instance roles and cross-account access included). | same |
| `Role` | Persistent IAM identity; appears as `sessionIssuer.type`. | same |
| `FederatedUser` | Temporary credentials from `GetFederationToken`. | same |
| `AWSAccount` | Another AWS account assumed a role you own (target-account copy of a cross-account `AssumeRole`). | same |
| `AWSService` | An AWS service account assumed a role you own. | same |
| `SAMLUser` | `AssumeRoleWithSAML` call; `principalId` combines `saml:namequalifier` and `saml:sub`. | same |
| `WebIdentityUser` | `AssumeRoleWithWebIdentity` call; `principalId` combines issuer, application ID, and user ID. | same |
| `IdentityCenterUser`, `BuilderIdUser`, `Directory`, `Unknown` | Non-STS identity types that can appear in the same logs. | same |

Key sub-fields for STS investigations, all from the [CloudTrail userIdentity reference](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html):

- `sessionContext.sessionIssuer`: the role (or IAM user/root for `GetFederationToken`) that issued the session.
- `sessionContext.attributes.creationDate` and `mfaAuthenticated`.
- `sessionContext.sourceIdentity`: the value set with `sts:SetSourceIdentity`; it persists across role chaining and cannot be changed within the session.
- `sessionContext.webIdFederationData`: provider and attributes for web identity sessions.
- `sessionContext.ec2RoleDelivery`: `1.0` when credentials came from IMDSv1, `2.0` for IMDSv2.
- `sessionContext.assumedRoot`: `true` for sessions created by `AssumeRoot`.
- `sessionContext.signInSessionArn`: the sign-in session behind the request, matching the `aws:SignInSessionArn` condition key.
- `invokedBy`: the AWS service that made the request on your behalf.
- `invokedByDelegate.accountId`: the product provider account acting through IAM temporary delegation (`GetDelegatedAccessToken`).
- `inScopeOf`: the resource (for example a Lambda function) the credentials were issued to.
- `credentialId`: set only when the caller used a bearer token such as an IAM Identity Center access token; it is not used for SigV4 STS credentials.

### Tracing a session back to the original principal

1. Take `userIdentity.accessKeyId` (an `ASIA...` key) from the suspicious event, along with `principalId` (`AROA...:session-name`) and `arn`.
2. Search STS events for the `AssumeRole*` call whose `responseElements.credentials.accessKeyId` equals that key; the issuing call is logged with the response elements ([IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).
3. Read that event's `userIdentity`: an IAM user, a `SAMLUser`/`WebIdentityUser` (external federated identity), an AWS service, or another `AssumedRole` (role chaining). For cross-account calls, look in the caller's account and join on `sharedEventID`.
4. Repeat step 2 for every `AssumedRole` hop until you reach a non-session principal.
5. Shortcut: if your trust policies require `sts:SourceIdentity`, the original user is in `sessionContext.sourceIdentity` on every downstream event, so you do not need to walk the chain ([How to relate IAM role activity to corporate identity](https://aws.amazon.com/blogs/security/how-to-relate-iam-role-activity-to-corporate-identity/)).
6. For `AssumeRoleWithWebIdentity`, `responseElements.subjectFromWebIdentityToken`, `provider`, and `audience` identify the external subject. For SAML, `subject`, `issuer`, and `nameQualifier` do the same ([IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).

The IAM documentation maps which identity appears in each account for each STS API:

| Caller | STS API | Caller account log | Role account log | Subsequent calls |
| --- | --- | --- | --- | --- |
| Root user | `GetSessionToken` | Root identity | Same account | Root identity |
| Root user | `AssumeRoot` | Root user session | Account number and principal ID | Root user session |
| IAM user | `GetSessionToken` | IAM user | Same account | IAM user |
| IAM user | `GetFederationToken` | IAM user | Same account | IAM user |
| IAM user | `AssumeRole` | IAM user | Account number and principal ID, or service principal | Role identity only |
| External user | `AssumeRoleWithSAML` | n/a | SAML user identity | Role identity only |
| External user | `AssumeRoleWithWebIdentity` | n/a | OIDC/web user identity | Role identity only |

Source: [IAM User Guide: Logging sign-in events for temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html).

## Quotas and throttling

- Default quota for STS requests made with AWS credentials: 600 requests per second, per account, per Region. `AssumeRole`, `DecodeAuthorizationMessage`, `GetAccessKeyInfo`, `GetCallerIdentity`, `GetFederationToken`, and `GetSessionToken` share it ([IAM and AWS STS quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)).
- Requests by AWS service principals (for example a service assuming a service role) do not consume your account's STS quota ([same page](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)).
- For cross-account `AssumeRole`, only the calling account's quota is consumed, not the target account's ([same page](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)).
- Each Regional endpoint has its own per-account budget, and the global endpoint is separate from the Regional ones. After the 2025 change, global-endpoint requests from each additional originating Region receive their own independent quota ([quotas page](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html), [IAM monitoring at scale, part 2](https://aws.amazon.com/blogs/security/how-to-monitor-and-query-iam-resources-at-scale-part-2/)).
- `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, `AssumeRoot`, `GetWebIdentityToken`, and `GetDelegatedAccessToken` are not on the documented shared-quota list. Their limits are not published (unverified).
- Increases: the IAM quotas page says to "open a ticket with AWS support"; the STS rate quota is not managed through Service Quotas ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)). An older re:Post article says "You can't increase the AWS service rate quotas" ([re:Post](https://repost.aws/knowledge-center/iam-sts-throttling-error)). The two AWS sources conflict, and the IAM User Guide is the more authoritative.
- Throttled calls return `ThrottlingException` (HTTP 400, "Your request rate is too high") per the [STS common errors](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html); clients usually surface it as "Rate exceeded" ([re:Post](https://repost.aws/knowledge-center/iam-sts-throttling-error)).

Mitigations from the sources above:

- Cache and reuse credentials until shortly before expiry instead of calling `AssumeRole` per request. SDK credential providers already do this.
- Raise the role's maximum session duration (up to 12 hours) so callers refresh less often, unless role chaining caps it at 1 hour.
- Let SDKs retry with exponential backoff (standard or adaptive retry mode).
- Spread load across Regional endpoints in the workload's own Region instead of funneling everything through one endpoint.
- Do not use `GetCallerIdentity` as a health check in hot paths, because it counts against the same 600 RPS.

### Session token size

Since September 2026, STS enforces one limit: the assembled session token must fit in 4,096 bytes. This replaced the separate packed-policy and token limits. Exceeding it still returns `PackedPolicyTooLarge`. Session-vending responses now include `SessionTokenSize` and `SessionTokenUtilization`, and CloudWatch publishes `SessionTokenSize` and `SessionTokenMaxSize` in the `AWS/STS` namespace with an `EndpointType` dimension. The new `MinimumSessionTokenSize` request parameter pads tokens so you can test downstream systems at the maximum size ([What's New, 2026-09](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/), [AWS Security Blog](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/), [re:Post: PackedPolicyTooLarge](https://repost.aws/knowledge-center/iam-role-aws-sts-error), [re:Post: testing max token size](https://repost.aws/knowledge-center/sts-test-max-session-token-size)). Other input limits are unchanged: session policies are capped at 2,048 plaintext characters with at most 10 managed policy ARNs, and a session can carry at most 50 session tags ([quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)).

## Pricing and SLA

- Price: "AWS Identity and Access Management (IAM), AWS IAM Identity Center and AWS Security Token Service (AWS STS) are features of your AWS account offered at no additional charge." You pay only for the other AWS services you call with the credentials ([What is IAM?](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html)). Interface VPC endpoints for STS are billed at standard AWS PrivateLink rates ([What's New, 2026-09](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts-vpc-oidc/)).
- SLA: there is no published SLA for STS or for core IAM. The [AWS SLA index](https://aws.amazon.com/legal/service-level-agreements/) lists only an [IAM Access Analyzer SLA](https://aws.amazon.com/iam/sla/), which covers Access Analyzer APIs. Treat the absence of an STS SLA as checked against the index on 2026-10-10.
- Availability design: the global endpoint historically had a single-Region dependency on `us-east-1`. AWS recommends Regional endpoints for latency, fault isolation, and token validity in all Regions ([Manage AWS STS in an AWS Region](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-regions.html)).

## Error catalog

### Operation-specific errors

The STS API Reference lists these errors for each operation.

| Error code | HTTP | Operations | Root cause | Fix |
| --- | --- | --- | --- | --- |
| `ExpiredToken` / `ExpiredTokenException` | 400 | `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, `AssumeRoot` | The web identity token or SAML assertion passed is expired or invalid. For `AssumeRole` and `AssumeRoot`, the documented text is the same generic wording; in practice it fires when the calling session's own credentials have expired. | Fetch a fresh IdP token or assertion, or refresh the caller's credentials, then retry. |
| `IDPCommunicationError` | 400 | `AssumeRoleWithWebIdentity` | STS could not reach the IdP to verify the token (often transient). | Retry a limited number of times with backoff. Check the IdP's availability, its JWKS reachability, and latency (IdP-side calls time out after about 5 seconds). |
| `IDPRejectedClaim` | 403 | `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` | The IdP reported failed authentication, or the claim is invalid, expired, or revoked. | Re-authenticate at the IdP. For SAML, check attributes such as `Role` and `RoleSessionName`, the audience, and the signing certificate. |
| `InvalidIdentityToken` | 400 | `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity` | AWS could not validate the token: wrong `iss`/`aud`, signature or key mismatch, or an IAM OIDC provider/client ID that does not match. | Obtain a new token. Verify that the IAM OIDC provider URL and audience match the token's `iss`/`aud` and that the JWKS is reachable. |
| `MalformedPolicyDocument` | 400 | `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, `GetFederationToken` | The inline session policy is malformed. | Fix the JSON or policy grammar. The error message names the problem. |
| `PackedPolicyTooLarge` | 400 | `AssumeRole*`, `GetFederationToken`, `GetDelegatedAccessToken` | The assembled session token exceeds 4,096 bytes because of session policies and session tags. | Trim session policies and tags, prefer managed policy ARNs, monitor `SessionTokenUtilization`. |
| `RegionDisabled` / `RegionDisabledException` | 403 | `AssumeRole*`, `GetFederationToken`, `GetSessionToken`, `AssumeRoot` | STS is not activated in that Region for the account that owns the credentials being issued. For an opt-in Region, the target (role-owning) account has not enabled the Region. | Activate the Regional STS endpoint in IAM account settings, or enable the opt-in Region in the role-owning account. |
| `InvalidAuthorizationMessage` / `InvalidAuthorizationMessageException` | 400 | `DecodeAuthorizationMessage` | The encoded message is invalid: line breaks, truncation, or expired. | Pass the exact encoded string without whitespace changes, decode promptly, and grant `sts:DecodeAuthorizationMessage`. |
| `JWTPayloadSizeExceeded` | 400 | `GetWebIdentityToken` | Too many or too large request tags in the JWT. | Reduce the tags. |
| `OutboundWebIdentityFederationDisabled` | 403 | `GetWebIdentityToken` | Outbound identity federation is not enabled for the account. | Enable it in the console or API first. |
| `SessionDurationEscalation` | 403 | `GetWebIdentityToken` | The requested JWT lifetime would outlive the calling session. | Request a shorter `DurationSeconds`. |
| `ExpiredTradeInToken` | 400 | `GetDelegatedAccessToken` | The trade-in token from the temporary delegation flow has expired. | Request a new delegation token. |

Sources: [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html), [AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html), [AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html), [GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html), [GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html), [AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html), [DecodeAuthorizationMessage](https://docs.aws.amazon.com/STS/latest/APIReference/API_DecodeAuthorizationMessage.html), [GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html), [GetDelegatedAccessToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html), [re:Post: InvalidIdentityToken](https://repost.aws/knowledge-center/iam-sts-invalididentitytoken). `GetCallerIdentity` and `GetAccessKeyInfo` document no operation-specific errors ([GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)).

The SDK exception classes add an `Exception` suffix (for example `RegionDisabledException`); the wire error code omits it. The API reference shows the wire code.

### Common and caller-side errors

| Symptom | Root cause | Fix |
| --- | --- | --- |
| `AccessDenied: User: arn:... is not authorized to perform: sts:AssumeRole on resource: arn:aws:iam::...:role/X` | One of: the caller's identity policy does not allow `sts:AssumeRole` on that ARN (needed cross-account); the role trust policy does not name the caller or its account; a trust policy condition fails (`sts:ExternalId`, MFA, `aws:SourceIp`, `aws:PrincipalOrgID`, date); an SCP or RCP denies it; or a role-chained call is made with the wrong session. | Check both sides: the identity policy on the caller and the trust policy on the role. Check SCPs on the caller's account and RCPs on the role's account. Newer AccessDenied messages name the policy type that denied. Because denied cross-account attempts are not logged in the target account, check the caller's account CloudTrail ([re:Post](https://repost.aws/knowledge-center/iam-assume-role-error), [Troubleshoot access denied](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_access-denied.html), [CloudTrail note](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)). |
| `ExpiredToken` / `ExpiredTokenException: The security token included in the request is expired` (from any service) | Temporary credentials passed their expiration. They cannot be extended. | Request new credentials and let the SDK provider refresh automatically ([re:Post](https://repost.aws/knowledge-center/iam-credentials-token), [STS common errors](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html)). |
| `InvalidClientTokenId: The security token included in the request is invalid` | The access key is deleted, inactive, mistyped, or picked up from an unexpected place in the credential chain, or a session token is missing or mismatched. | Run `aws sts get-caller-identity --debug` to see which provider supplied the keys, then fix or replace them ([re:Post](https://repost.aws/knowledge-center/iam-credentials-token)). |
| Invalid-token or `AuthFailure` errors only in opt-in Regions | Session tokens from the global endpoint default to version 1, which is valid only in default-enabled Regions. Opt-in Regions accept only version 2 tokens. EC2 reports this as `AuthFailure: AWS was not able to validate the provided access credentials`; the wording varies by service. | Use Regional STS endpoints, which issue tokens valid everywhere, or set `iam set-security-token-service-preferences --global-endpoint-token-version v2Token` ([re:Post](https://repost.aws/knowledge-center/iam-validate-access-credentials), [Manage STS in a Region](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-regions.html), [SetSecurityTokenServicePreferences](https://docs.aws.amazon.com/IAM/latest/APIReference/API_SetSecurityTokenServicePreferences.html)). |
| `SignatureDoesNotMatch` | The SigV4 signature does not match: wrong secret key for the access key ID, a secret with stray whitespace, a session token mixed with different keys, a proxy that altered the request, or the wrong Region in the credential scope for a Regional endpoint. | Re-export a consistent key/secret/token triple, sign for the Region of the endpoint you call, and update the SDK AWS documents this as a general SigV4 failure (HTTP 403) caused by credential, canonical-request, or credential-scope errors, not as an STS-specific error ([SigV4 troubleshooting](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-troubleshooting.html)). |
| `RequestExpired` | The request timestamp is more than 15 minutes off, usually from clock skew. | Sync the clock with NTP ([STS common errors](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html)). |
| `ThrottlingException` / "Rate exceeded" | Over 600 RPS per account per Region for the credentialed operations. | Cache credentials, back off, spread across Regional endpoints, or ask AWS Support for an increase ([quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)). |
| `MissingAuthenticationToken`, `UnrecognizedClientException`, `IncompleteSignature`, `OptInRequired` | Unsigned request, unknown key, a malformed signature, or a service not enabled. | See [STS common errors](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html). |
| Role session silently capped at 1 hour | Role chaining limits a CLI/API session to 1 hour regardless of the role's maximum session duration. | Avoid chaining for long jobs, or assume the target role directly ([AssumeRoleWithSAML notes](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)). |

## Security

### Threat model for temporary credentials

Temporary credentials (`ASIA...` access key ID, secret key, and session token) are bearer credentials. Anyone who holds all three can use them from anywhere until they expire, unless policy conditions bind them to a network or source. Their main protections are a short lifetime and narrow scope. They cannot be "deleted"; they can only be invalidated with deny policies ([Temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html), [Revoke role sessions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)).

| Threat | Example | Primary controls |
| --- | --- | --- |
| Credential exfiltration from compute | SSRF against IMDSv1, a compromised container reading task/pod credentials, credentials printed in CI logs | IMDSv2 (watch `ec2RoleDelivery`), `aws:EC2InstanceSourceVPC` / `aws:EC2InstanceSourcePrivateIPv4` SCPs, GuardDuty exfiltration findings, data perimeter network conditions |
| Over-broad trust policy | `Principal: "*"`, a whole-account principal, or an OIDC provider trusted without a `sub` condition | Access Analyzer external access findings, RCP on `sts:AssumeRole*`, IAM guardrail for GitHub `sub` |
| Confused deputy | A third-party SaaS tricked into assuming your role on another customer's behalf | `sts:ExternalId`; `aws:SourceArn` / `aws:SourceAccount` for service principals |
| Long-lived leaked sessions | 12-hour console or CLI sessions after compromise | Shorter `MaxSessionDuration`, `aws:TokenIssueTime` revocation |
| Lateral movement via role chaining | A compromised role assumes more powerful roles | Least privilege on `sts:AssumeRole` resources, `sts:SourceIdentity` for attribution, SCP deny on unexpected chains |
| Reconnaissance | `GetCallerIdentity` "whoami", `GetAccessKeyInfo` key-to-account mapping | Detection only; these calls cannot be blocked |
| Session token size or format assumptions | Proxies, WAFs, or databases truncate tokens up to 4,096 bytes | Test with `MinimumSessionTokenSize` |

### Credential exfiltration and GuardDuty

- `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS`: credentials created exclusively for an EC2 instance through an instance launch role are used from an IP outside AWS. Known false positives come from on-premises egress (Outposts, VPN, Transit Gateway Connect partners); suppress by finding type plus API caller IPv4 CIDR. GuardDuty's ML model learns repeated remote hosts and stops alerting for them ([GuardDuty finding doc](https://docs.aws.amazon.com/help-panel/guardduty/latest/console/finding-type-unauthorizedaccess-iam-instancecredentialexfiltrationoutsideaws.html)).
- `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.InsideAWS`: the same credentials are used from an IP or VPC endpoint owned by a different AWS account. Default severity is High, or Medium when the remote account is affiliated (`remoteAccountDetails.Affiliated = True`) ([GuardDuty finding doc](https://docs.aws.amazon.com/help-panel/guardduty/latest/console/finding-type-unauthorizedaccess-iam-instancecredentialexfiltrationinsideaws.html)).
- `UnauthorizedAccess:IAMUser/ResourceCredentialExfiltration.InsideAWS` and `.OutsideAWS` cover credentials issued to Lambda functions and ECS tasks ([GuardDuty IAM finding types](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html)).
- Other IAM finding types that commonly fire around STS abuse: `InitialAccess:IAMUser/AnomalousBehavior` (token and session APIs such as `GetFederationToken`), `Discovery:IAMUser/AnomalousBehavior`, `PrivilegeEscalation:IAMUser/AnomalousBehavior`, `Policy:IAMUser/RootCredentialUsage`, `Policy:IAMUser/ShortTermRootCredentialUsage` (root sessions, including `AssumeRoot`-style restricted root credentials), `CredentialAccess:IAMUser/CompromisedCredentials`, `Recon:IAMUser/TorIPCaller`, `Recon:IAMUser/MaliciousIPCaller`, and `PenTest:IAMUser/KaliLinux` ([GuardDuty IAM finding types](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html), [AWS Security Blog](https://aws.amazon.com/blogs/security/how-you-can-use-amazon-guardduty-to-detect-suspicious-activity-within-your-aws-account/)).
- Prevention: write SCPs that compare `aws:EC2InstanceSourceVPC` with `aws:SourceVpc` and `aws:EC2InstanceSourcePrivateIPv4` with `aws:VpcSourceIp`, so that EC2 role credentials are denied anywhere except the instance they were issued to. These keys exist only for EC2-issued credentials, and `aws:EC2InstanceSourcePrivateIPv4` must always be paired with the VPC key ([AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/), [global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)).
- Enforce IMDSv2, and use the `ec2:RoleDelivery` context key (CloudTrail `ec2RoleDelivery`) to deny calls made with IMDSv1-delivered credentials ([CloudTrail userIdentity](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html)).

### Overly broad trust and OIDC misconfiguration

- IAM Access Analyzer analyzes role trust policies and creates external access findings when a role can be assumed from outside the zone of trust. Roles are global, so a finding is generated in each enabled Region ([Access Analyzer supported resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-resources.html)). The IAM console also previews external access while you edit a trust policy ([AWS Security Blog](https://aws.amazon.com/blogs/security/iam-access-analyzer-makes-it-simpler-to-author-and-validate-role-trust-policies/)).
- GitHub Actions OIDC: in 2023, researchers found many roles that trusted `token.actions.githubusercontent.com` without a `sub` condition, which let any GitHub repository assume them ([Datadog Security Labs: No keys attached](https://securitylabs.datadoghq.com/articles/exploring-github-to-aws-keyless-authentication-flaws/), [Datadog Cloud Security Atlas](https://securitylabs.datadoghq.com/cloud-security-atlas/vulnerabilities/iam-role-can-be-assumed-by-any-github-action/), [Wiz](https://www.wiz.io/blog/avoiding-mistakes-with-aws-oidc-integration-conditions)).
- IAM now rejects creating or updating a trust policy for the GitHub OIDC provider unless `token.actions.githubusercontent.com:sub` is present and is not only a wildcard or null. A similar check exists for HCP Terraform (`app.terraform.io:sub`). Existing roles are not re-validated until their trust policy is next edited ([IAM: Create a role for OIDC federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)). The start date of this enforcement is not documented by AWS; third-party posts disagree (unverified).
- Since February 2026 (announcement URL dated 2026-01), STS can validate provider-specific claims from GitHub, Google, CircleCI, and OCI as condition keys in trust policies and RCPs, for example `token.actions.githubusercontent.com:repository_id`. Prefer immutable ID claims over mutable name claims ([What's New](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/), [IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)).
- Always pin `aud` as well as `sub`, and add GitHub environment protection rules when trusting environments ([IAM OIDC page](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)).

### Confused deputy

- For third-party cross-account access, require `sts:ExternalId` in the trust policy. The external ID is not a secret; its job is to stop a vendor from being tricked into using your role ARN for another customer ([Access to accounts owned by third parties](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html), [AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-use-external-id-when-granting-access-to-your-aws-resources/)).
- For AWS service principals, use `aws:SourceArn` and `aws:SourceAccount` in the role trust policy ([IAM: confused deputy](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)).

### Session revocation

- The console's "Revoke active sessions" attaches an inline deny-all policy (`AWSRevokeOlderSessions`) conditioned on `aws:TokenIssueTime` being earlier than now. Sessions issued afterward are unaffected. Service-linked role sessions cannot be revoked ([Revoke IAM role temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)).
- For a single federated user, deny on `aws:userid` (`AROA...:session-name`) or `aws:SourceIdentity` in an SCP or role policy. Source identity survives role chaining, while session names can be changed when chaining ([How to revoke federated users' active AWS sessions](https://aws.amazon.com/blogs/security/how-to-revoke-federated-users-active-aws-sessions/)).
- Credentials from `GetSessionToken` and `GetFederationToken` take on the IAM user's permissions, so removing that user's policies, or attaching a deny, cuts them off. Permissions are evaluated on every request, but policy changes can take a few minutes to take effect. Credentials created by the root user with these APIs cannot be restricted this way, which is why AWS advises against calling them as root ([Disabling permissions for temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html)).

### Reconnaissance with STS

- `GetCallerIdentity` needs no permissions. An explicit deny on `sts:GetCallerIdentity` has no effect, because "the same information is returned when access is denied" ([API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)). Attackers use it as `whoami` to validate stolen keys and learn the account ID and principal ARN. Because SCPs are also deny policies, an SCP cannot block it either. It is logged, so alert on first-seen or unusual callers ([Elastic rule](https://www.elastic.co/guide/en/security/current/aws-sts-getcalleridentity-api-called-for-the-first-time.html)).
- `GetAccessKeyInfo` maps any access key ID to its owning account ID, and it does not reveal whether the key is active ([API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)). The call is logged only in the caller's account, so the victim never sees it ([Hacking the Cloud](https://hackingthe.cloud/aws/enumeration/get-account-id-from-keys/)). The account ID can also be decoded offline from newer key IDs ([Aidan Steele](https://awsteele.com/blog/2020/09/26/aws-access-key-format.html)).
- Error messages from failed `AssumeRole` calls can reveal whether a role ARN exists, and the probes are invisible to the target account because denied cross-account STS calls are not logged there ([CloudTrail note](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)). The enumeration technique itself is documented only by third parties (unverified).

### aws:SourceIp pitfalls

- When an AWS service calls another service on your behalf (for example CloudFormation calling EC2), the target service sees the calling service's IP, so `aws:SourceIp` denies break service-driven workflows unless you exempt them with `aws:ViaAWSService` ([re:Post](https://repost.aws/knowledge-center/iam-restrict-calls-ip-addresses)).
- Requests through a VPC endpoint carry private addresses in `aws:VpcSourceIp` and `aws:SourceVpc`/`aws:SourceVpce`, not `aws:SourceIp`. Use the VPC keys for private paths ([global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html), [AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/)).
- An `aws:SourceIp` condition on the trust policy is checked only at assume time. It does not bind later use of the issued credentials; for that, put the condition in the role's permissions policy or an SCP ([re:Post](https://repost.aws/knowledge-center/iam-restrict-calls-ip-addresses)).

### Data perimeter, SCPs, and RCPs on STS

- RCPs (launched November 2024) support STS (`sts` prefix). An RCP that denies `sts:AssumeRole` when `aws:PrincipalOrgID` is not your org, with `aws:PrincipalIsAWSService` exempted, blocks external role assumption across every member account without editing trust policies. RCPs do not apply to the management account or to service-linked roles ([Organizations: RCPs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html), [What's New](https://aws.amazon.com/about-aws/whats-new/2024/11/resource-control-policies-restrict-access-aws-resources/), [AWS Security Blog](https://aws.amazon.com/blogs/security/effectively-implementing-resource-controls-policies-in-a-multi-account-environment/), [Data perimeter whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/perimeter-overview.html)).
- SCPs limit what member-account principals may call, including `sts:AssumeRole`, `sts:GetFederationToken`, `sts:GetSessionToken`, `sts:TagSession`, `sts:SetSourceIdentity`, `sts:AssumeRoot`, and `sts:GetWebIdentityToken`. They cannot restrict `GetCallerIdentity`, the management account, or service-linked roles ([GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html), [Data perimeter whitepaper](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/perimeter-overview.html)).
- `aws:RequestedRegion` is always `us-east-1` for global endpoint calls, even when the request is served locally. A Region-restricting SCP must therefore allow `us-east-1` for STS or force Regional endpoints ([STS Regions and endpoints](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_region-endpoints.html)).
- `AssumeRoot` is scoped by `sts:TaskPolicyArn` to one of five AWS managed task policies, lasts at most 15 minutes, and is not available on the global endpoint ([AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html), [AWS News Blog](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)).

## Best practices checklist

- [ ] Use Regional STS endpoints in the workload's Region. Set `sts_regional_endpoints = regional` explicitly where old SDKs or CLI v1 still default to the global endpoint ([SDK reference](https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html)).
- [ ] If anything still calls the global endpoint, set global-endpoint tokens to `v2Token` before you enable opt-in Regions.
- [ ] Use interface VPC endpoints for STS where workloads lack internet egress, and use dual-stack endpoints if you need IPv6 ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-sts-ipv6/)).
- [ ] Cache credentials and let SDK providers refresh them. Never call STS per request. Alarm on `ThrottlingException`.
- [ ] Keep `MaxSessionDuration` as short as the job allows, and remember that role chaining caps sessions at 1 hour.
- [ ] Every trust policy names specific principals. No `"*"` without strong conditions. Pin OIDC `aud` and `sub` (and prefer immutable ID claims).
- [ ] Require `sts:ExternalId` for third parties, and `aws:SourceArn`/`aws:SourceAccount` for service principals.
- [ ] Require `sts:SourceIdentity` (and control `sts:SetSourceIdentity`/`sts:TagSession`) for human federated access.
- [ ] Deploy an RCP that restricts `sts:AssumeRole*` to your organization, plus SCPs that bound which roles principals may assume.
- [ ] Enforce IMDSv2 and add SCPs using `aws:EC2InstanceSourceVPC`/`aws:EC2InstanceSourcePrivateIPv4`.
- [ ] Enable GuardDuty organization-wide and route credential-exfiltration findings to on-call.
- [ ] Enable Access Analyzer external access analyzers with the organization as the zone of trust, and review role findings.
- [ ] Run a multi-Region, organization-wide CloudTrail trail. Search `us-east-1` for global-endpoint STS events.
- [ ] Alert on first-seen `GetCallerIdentity` and `GetAccessKeyInfo` callers and on `AssumeRoot` (`assumedRoot: true`).
- [ ] Rehearse revocation (`aws:TokenIssueTime`, `aws:userid`, `aws:SourceIdentity` denies).
- [ ] Alarm on `SessionTokenSize` against `SessionTokenMaxSize` (CloudWatch `AWS/STS`), log `SessionTokenUtilization` from responses, and test proxies with `MinimumSessionTokenSize`.
- [ ] Centralize root access and use `AssumeRoot` for member-account root tasks instead of root passwords.

## Sources

- [IAM User Guide: Logging IAM and AWS STS API calls with AWS CloudTrail](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)
- [CloudTrail userIdentity element](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html)
- [CloudTrail: Logging data events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)
- [IAM User Guide: AWS STS Regions and endpoints](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_region-endpoints.html)
- [IAM User Guide: Manage AWS STS in an AWS Region](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-regions.html)
- [IAM and AWS STS quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)
- [STS API Reference: Actions](https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html)
- [STS API Reference: Common Error Types](https://docs.aws.amazon.com/STS/latest/APIReference/CommonErrors.html)
- [STS API Reference: AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [STS API Reference: AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)
- [STS API Reference: AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)
- [STS API Reference: AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)
- [STS API Reference: GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html)
- [STS API Reference: GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html)
- [STS API Reference: DecodeAuthorizationMessage](https://docs.aws.amazon.com/STS/latest/APIReference/API_DecodeAuthorizationMessage.html)
- [STS API Reference: GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)
- [STS API Reference: GetAccessKeyInfo](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)
- [STS API Reference: GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)
- [STS API Reference: GetDelegatedAccessToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html)
- [IAM API Reference: SetSecurityTokenServicePreferences](https://docs.aws.amazon.com/IAM/latest/APIReference/API_SetSecurityTokenServicePreferences.html)
- [What is IAM? (service cost)](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html)
- [AWS Service Level Agreements](https://aws.amazon.com/legal/service-level-agreements/)
- [AWS IAM Access Analyzer SLA](https://aws.amazon.com/iam/sla/)
- [AWS Security Blog: How to use Regional AWS STS endpoints](https://aws.amazon.com/blogs/security/how-to-use-regional-aws-sts-endpoints/)
- [AWS Security Blog: How to monitor and query IAM resources at scale, part 2](https://aws.amazon.com/blogs/security/how-to-monitor-and-query-iam-resources-at-scale-part-2/)
- [AWS Security Blog: AWS STS simplifies session token size limits](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/)
- [What's New: STS session token size limits (2026-09)](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/)
- [re:Post: STS throttling](https://repost.aws/knowledge-center/iam-sts-throttling-error)
- [re:Post: InvalidIdentityToken](https://repost.aws/knowledge-center/iam-sts-invalididentitytoken)
- [re:Post: PackedPolicyTooLarge](https://repost.aws/knowledge-center/iam-role-aws-sts-error)
- [re:Post: Test max session token size](https://repost.aws/knowledge-center/sts-test-max-session-token-size)
- [re:Post: The security token included in the request is invalid](https://repost.aws/knowledge-center/iam-credentials-token)
- [re:Post: AWS was not able to validate the provided access credentials](https://repost.aws/knowledge-center/iam-validate-access-credentials)
- [re:Post: AccessDenied assuming a cross-account role](https://repost.aws/knowledge-center/iam-assume-role-error)
- [re:Post: Restrict API calls by IP](https://repost.aws/knowledge-center/iam-restrict-calls-ip-addresses)
- [IAM User Guide: Troubleshoot access denied](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_access-denied.html)
- [IAM User Guide: SigV4 troubleshooting](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-troubleshooting.html)
- [GuardDuty IAM finding types](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html)
- [GuardDuty: InstanceCredentialExfiltration.OutsideAWS](https://docs.aws.amazon.com/help-panel/guardduty/latest/console/finding-type-unauthorizedaccess-iam-instancecredentialexfiltrationoutsideaws.html)
- [GuardDuty: InstanceCredentialExfiltration.InsideAWS](https://docs.aws.amazon.com/help-panel/guardduty/latest/console/finding-type-unauthorizedaccess-iam-instancecredentialexfiltrationinsideaws.html)
- [AWS Security Blog: GuardDuty anomaly findings](https://aws.amazon.com/blogs/security/how-you-can-use-amazon-guardduty-to-detect-suspicious-activity-within-your-aws-account/)
- [AWS Security Blog: Restrict where EC2 instance credentials can be used](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/)
- [AWS global condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)
- [IAM and AWS STS condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)
- [IAM Access Analyzer supported resource types](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-resources.html)
- [AWS Security Blog: Access Analyzer for role trust policies](https://aws.amazon.com/blogs/security/iam-access-analyzer-makes-it-simpler-to-author-and-validate-role-trust-policies/)
- [IAM User Guide: Create a role for OIDC federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [What's New: STS IdP-specific claims (2026)](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/)
- [Datadog Security Labs: No keys attached](https://securitylabs.datadoghq.com/articles/exploring-github-to-aws-keyless-authentication-flaws/)
- [Datadog Cloud Security Atlas: IAM role can be assumed by any GitHub Action](https://securitylabs.datadoghq.com/cloud-security-atlas/vulnerabilities/iam-role-can-be-assumed-by-any-github-action/)
- [Wiz: Avoiding mistakes with AWS OIDC integration conditions](https://www.wiz.io/blog/avoiding-mistakes-with-aws-oidc-integration-conditions)
- [IAM User Guide: Access to AWS accounts owned by third parties](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html)
- [IAM User Guide: The confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)
- [AWS Security Blog: How to use external ID](https://aws.amazon.com/blogs/security/how-to-use-external-id-when-granting-access-to-your-aws-resources/)
- [IAM User Guide: Revoke IAM role temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)
- [IAM User Guide: Disabling permissions for temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html)
- [AWS Security Blog: How to revoke federated users' active AWS sessions](https://aws.amazon.com/blogs/security/how-to-revoke-federated-users-active-aws-sessions/)
- [AWS Security Blog: How to relate IAM role activity to corporate identity](https://aws.amazon.com/blogs/security/how-to-relate-iam-role-activity-to-corporate-identity/)
- [Organizations: Resource control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html)
- [What's New: Resource control policies (2024-11)](https://aws.amazon.com/about-aws/whats-new/2024/11/resource-control-policies-restrict-access-aws-resources/)
- [AWS Security Blog: Implementing RCPs in a multi-account environment](https://aws.amazon.com/blogs/security/effectively-implementing-resource-controls-policies-in-a-multi-account-environment/)
- [Whitepaper: Building a data perimeter on AWS](https://docs.aws.amazon.com/whitepapers/latest/building-a-data-perimeter-on-aws/perimeter-overview.html)
- [AWS News Blog: Centrally managing root access](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)
- [AWS SDKs and Tools Reference: STS Regional endpoints](https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html)
- [What's New: STS IPv6 (2025-11)](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-sts-ipv6/)
- [What's New: Outbound federation OIDC discovery VPC endpoints (2026-09)](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts-vpc-oidc/)
- [Elastic: GetCallerIdentity API Called for the First Time](https://www.elastic.co/guide/en/security/current/aws-sts-getcalleridentity-api-called-for-the-first-time.html)
- [detectioninthe.cloud: GetCallerIdentity](https://detectioninthe.cloud/ttps/discovery/sts_get_caller_identity/)
- [Hacking the Cloud: Get account ID from access keys](https://hackingthe.cloud/aws/enumeration/get-account-id-from-keys/)
- [Aidan Steele: AWS access key ID formats](https://awsteele.com/blog/2020/09/26/aws-access-key-format.html)
