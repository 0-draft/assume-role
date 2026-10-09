# Credential Paths: How Workloads and Humans Actually Get STS Credentials

_Last verified: 2026-10-10_

Every AWS API call that is not anonymous is signed with SigV4 using an access key. Short-term keys (`ASIA...` access key ID plus a session token) almost always come out of AWS STS, but not always from a call that _your_ code makes. This chapter walks through each delivery path end to end: who calls what, which endpoint is hit, what the token looks like, how long the result lives, and where people trip.

Conventions used below:

- "STS call" means an operation on `sts.amazonaws.com` or a Regional STS endpoint. Several paths use a non-STS front door (EKS Auth, IAM Roles Anywhere, IAM Identity Center portal, Cognito, AWS Sign-In) that wraps an STS call internally.
- Sequences are written as plain-text arrows: `A -> B : message`.
- Anything I could not confirm against an official source is marked "(unverified)".

## Overview Table

| Path | Who presents what | Front-door API | STS operation (who calls it) | Default / max lifetime |
| --- | --- | --- | --- | --- |
| EC2 instance profile | Instance role attached to instance | IMDS `169.254.169.254` | `AssumeRole` by the EC2 service | Rotated; new creds at least 5 min before expiry |
| Lambda execution role | Function config | Env vars in sandbox | `AssumeRole` by Lambda service | Per execution environment (unverified exact value) |
| ECS task role | Task definition `taskRoleArn` | `169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` | `AssumeRole` by `ecs-tasks.amazonaws.com` | Rotated by agent |
| EKS IRSA | Projected SA JWT | none (SDK talks to STS) | `AssumeRoleWithWebIdentity` by the pod's SDK | 1 h default, role max up to 12 h |
| EKS Pod Identity | Projected SA JWT (aud `pods.eks.amazonaws.com`) | Agent `169.254.170.23` then `eks-auth:AssumeRoleForPodIdentity` | `AssumeRole` + `TagSession` by `pods.eks.amazonaws.com` | Managed by agent |
| IAM Roles Anywhere | X.509 cert + private key signature | `rolesanywhere:CreateSession` (`POST /sessions`) | `AssumeRole` by `rolesanywhere.amazonaws.com` | 900 s to 43200 s, min(profile, request) |
| IAM Identity Center (CLI) | SSO OIDC access token | `sso:GetRoleCredentials` (`portal.sso.<region>.amazonaws.com`) | Internal (SAML-based, see below) | Permission set session duration, 1 h to 12 h |
| IAM Identity Center (console) | Portal session | `Federate` (portal) | `AssumeRoleWithSAML` against `AWSSSO_*_DO_NOT_DELETE` provider | 1 h to 12 h |
| `aws login` | Console session | AWS Sign-In OAuth 2.0 (`signin:AuthorizeOAuth2Access`, `signin:CreateOAuth2Token`) | Internal to Sign-In | Refreshed every 15 min, session up to 12 h |
| SAML 2.0 IdP | Signed SAML assertion | `signin.aws.amazon.com/saml` (console) | `AssumeRoleWithSAML` (unsigned call) | 1 h default, 900 s to role max (12 h) |
| Custom broker console URL | Broker's AWS creds | `signin.aws.amazon.com/federation` `getSigninToken` | `AssumeRole` or `GetFederationToken` by broker | Token valid 15 min; console up to 12 h (36 h for GFT) |
| Cognito identity pool (enhanced) | IdP token | `cognito-identity:GetId` + `GetCredentialsForIdentity` | `AssumeRoleWithWebIdentity` by Cognito | 1 h |
| Cognito identity pool (basic) | Cognito OpenID token | `GetId` + `GetOpenIdToken` | `AssumeRoleWithWebIdentity` by the client | Token 10 min; creds per request |
| IAM user + MFA | Access key + TOTP | none | `GetSessionToken` | 12 h default, 15 min to 36 h |
| GitHub Actions / GitLab / HCP Terraform OIDC | CI-issued JWT | CI's OIDC issuer | `AssumeRoleWithWebIdentity` by runner | 1 h default (action), role max |
| Outbound identity federation | Existing AWS creds | none | `GetWebIdentityToken` (AWS issues a JWT) | 60 s to 3600 s, default 300 s |
| Centralized root access | Mgmt / delegated admin creds | none | `AssumeRoot` | 0 to 900 s, default 900 s |

## Part 1: Workloads on AWS Compute

### EC2 Instance Profiles (IMDS)

An instance profile is a container for exactly one role. The role's trust policy must allow `ec2.amazonaws.com` to call `sts:AssumeRole`, and whoever launches or attaches the profile needs `iam:PassRole` ([IAM roles for EC2](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2.html)). Your code never calls STS: the EC2 service assumes the role and places the result in the Instance Metadata Service.

```text
Admin      -> EC2 API          : RunInstances(IamInstanceProfile=...)  [iam:PassRole checked]
EC2 svc    -> STS              : AssumeRole(role, trust principal ec2.amazonaws.com)
STS        -> EC2 svc          : ASIA... / secret / session token / Expiration
EC2 svc    -> IMDS (on host)   : publish creds under iam/security-credentials/<role>
App (SDK)  -> IMDS             : PUT  http://169.254.169.254/latest/api/token
                                 X-aws-ec2-metadata-token-ttl-seconds: 21600
IMDS       -> App              : session token (IMDSv2)
App (SDK)  -> IMDS             : GET  /latest/meta-data/iam/security-credentials/
App (SDK)  -> IMDS             : GET  /latest/meta-data/iam/security-credentials/<role>
                                 X-aws-ec2-metadata-token: <token>
IMDS       -> App              : {"Code":"Success","Type":"AWS-HMAC","AccessKeyId":...,"Token":...,"Expiration":...}
App        -> AWS service      : SigV4 request with ASIA... + X-Amz-Security-Token
```

Details:

- Endpoint: `169.254.169.254` (IPv4) or `[fd00:ec2::254]` on Nitro instances in IPv6-enabled subnets ([IMDS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)).
- IMDSv2 session tokens last 1 second to 6 hours (21600 s) and can only be used on the instance where they were created ([IMDSv2 blog](https://aws.amazon.com/blogs/security/defense-in-depth-open-firewalls-reverse-proxies-ssrf-vulnerabilities-ec2-instance-metadata-service/)).
- Credential response fields: `Code`, `LastUpdated`, `Type` (`AWS-HMAC`), `AccessKeyId`, `SecretAccessKey`, `Token`, `Expiration`. EC2 rotates them and makes new ones available "at least five minutes before the expiration of the old credentials" ([retrieve credentials](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-metadata-security-credentials.html)). The IAM guide tells hand-rolled caches to refresh every hour or at least 15 minutes before expiry ([IAM roles for EC2](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2.html)). The exact lifetime of instance-role credentials is not documented as a fixed number (unverified).
- Hop limit: `HttpPutResponseHopLimit` limits how many IP hops the PUT response survives. With the account default set to IMDSv2, new instances get `HttpTokens=required` and hop limit 2; with "no preference" it defaults to 2 for AMIs with `ImdsSupport: v2.0`, otherwise 1. Use 2 if the instance hosts containers ([IMDS options for new instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-new-instances.html)). Hop limit 1 blocks bridged-network containers from reaching IMDSv2, which is often what you want when containers have their own roles.
- With `HttpTokens=optional`, a token-less GET returns "IMDSv1 role credentials"; with a token it returns "IMDSv2 role credentials" ([EC2 metadata options](https://docs.aws.amazon.com/sdk-for-ruby/v3/api/Aws/EC2/Types/LaunchTemplateInstanceMetadataOptionsRequest.html)). That difference is visible in policy as `ec2:RoleDelivery` (`1.0` or `2.0`), so you can deny `NumericLessThan ec2:RoleDelivery 2.0` ([condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)).

Credential identity and condition keys attached to instance-role sessions:

| Key | Meaning |
| --- | --- |
| `ec2:SourceInstanceARN` | Instance the credentials were delivered to |
| `ec2:RoleDelivery` | `1.0` (IMDSv1) or `2.0` (IMDSv2) |
| `aws:EC2InstanceSourceVPC` | VPC the credentials were delivered into |
| `aws:EC2InstanceSourcePrivateIPv4` | Primary private IPv4 of the instance |

Comparing `aws:EC2InstanceSourceVPC` with `aws:SourceVpc` and `aws:EC2InstanceSourcePrivateIPv4` with `aws:VpcSourceIp` in an SCP stops stolen instance credentials from working outside the instance (via VPC endpoints) ([AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/)). The role session name is the instance ID, so the caller ARN looks like `arn:aws:sts::111122223333:assumed-role/<role>/i-0abc...` (widely observed; unverified in a single doc page).

Pitfalls:

- SSRF against `169.254.169.254` is the classic credential theft route; IMDSv2 plus hop limit 1 is the mitigation.
- Do not `AssumeRole` into the same role from the instance unless you need session tags or a session policy; a role assuming itself needs an explicit self-trust ([retrieve credentials](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-metadata-security-credentials.html)).
- Only one role per instance; all processes on the host share it.

### AWS Lambda Execution Role

Lambda "generates an ephemeral set of credentials by assuming your function's execution role" and exposes them as environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` ([Lambda SnapStart](https://docs.aws.amazon.com/lambda/latest/dg/snapstart-activate.html)). The trust principal is `lambda.amazonaws.com`.

```text
Lambda svc -> STS        : AssumeRole(execution role)   [on environment init]
Lambda svc -> Sandbox    : env AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
Handler    -> SDK        : default chain picks env vars first
SDK        -> AWS svc    : SigV4 (lambda:SourceFunctionArn set by Lambda on the request context)
```

- With SnapStart enabled, the runtime uses container credentials (`AWS_CONTAINER_CREDENTIALS_FULL_URI` plus `AWS_CONTAINER_AUTHORIZATION_TOKEN`) instead of the env-var keys so snapshots do not restore expired credentials ([Lambda SnapStart](https://docs.aws.amazon.com/lambda/latest/dg/snapstart-activate.html)).
- `lambda:SourceFunctionArn` identifies the function the credentials were delivered to, usable in resource policies and SCPs; use the unqualified ARN ([source function ARN](https://docs.aws.amazon.com/lambda/latest/dg/permissions-source-function-arn.html)).
- Pitfall: environment variables are inherited by child processes and appear in crash dumps; never log `os.environ`.

### Amazon ECS Task Role

The task role trusts `ecs-tasks.amazonaws.com` (recommended with `aws:SourceAccount` / `aws:SourceArn` conditions). The ECS agent (EC2 launch type) or Fargate agent serves credentials on a link-local endpoint ([ECS task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)).

```text
ECS ctrl   -> STS        : AssumeRole(taskRoleArn, principal ecs-tasks.amazonaws.com)
ECS ctrl   -> ECS agent  : credentials for task (internal channel, unverified detail)
ECS agent  -> Container  : env AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=/v2/credentials/<id>
SDK        -> Agent      : GET http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
Agent      -> SDK        : {"RoleArn":...,"AccessKeyId":...,"SecretAccessKey":...,"Token":...,"Expiration":...}
```

- Response shape (from AWS Knowledge Center): `RoleArn`, `AccessKeyId`, `SecretAccessKey`, `Token`, `Expiration`; a task with no task role returns 404 ([Fargate metadata errors](https://repost.aws/knowledge-center/ecs-fargate-metadata-errors)).
- CloudTrail sessions carry a `taskArn` context so you can see which task used the role ([ECS task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)).
- The relative-URI variable is only in PID 1's environment; shells spawned by `exec` may not see it ([Knowledge Center](https://repost.aws/knowledge-center/ecs-iam-task-roles-config-errors)).
- Pitfall: on EC2, ECS Managed Instances and ECS Anywhere, there is no isolation between tasks; containers can reach other tasks' credentials and the instance role via IMDS unless you block it. Fargate isolates per task ([ECS task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)).
- Do not confuse with the task _execution_ role (image pull, logs, secrets injection), which is used by the agent, not your code.

### Amazon EKS: IAM Roles for Service Accounts (IRSA)

IRSA is plain web identity federation. The cluster's OIDC issuer (`https://oidc.eks.<region>.amazonaws.com/id/<ID>`) is registered as an IAM OIDC provider, and the pod's SDK calls STS directly.

```text
kubelet     -> kube-apiserver : TokenRequest(sa, audience=sts.amazonaws.com)
kubelet     -> Pod volume     : /var/run/secrets/eks.amazonaws.com/serviceaccount/token
Webhook     -> Pod spec       : env AWS_ROLE_ARN, AWS_WEB_IDENTITY_TOKEN_FILE  (from SA annotation eks.amazonaws.com/role-arn)
SDK         -> STS            : AssumeRoleWithWebIdentity(RoleArn, WebIdentityToken=<JWT>)  [unsigned]
STS         -> OIDC issuer    : fetch /.well-known/openid-configuration + JWKS, verify signature
STS         -> SDK            : temporary credentials (assumed-role/<role>/<session>)
```

- Decoded token: `iss` = cluster issuer, `aud` = `["sts.amazonaws.com"]`, `sub` = `system:serviceaccount:<ns>:<sa>`, plus a `kubernetes.io` claim with namespace, pod and service account ([EKS best practices](https://docs.aws.amazon.com/eks/latest/best-practices/identity-and-access-management.html)).
- The kubelet refreshes the projected token when it is older than 80% of its TTL or older than 24 hours ([EKS pod configuration](https://docs.aws.amazon.com/eks/latest/userguide/pod-configuration.html)).
- Trust policy must pin both `<issuer>:sub` and `<issuer>:aud`. A missing `sub` condition lets any service account in the cluster assume the role.
- Pitfall: the node instance role is still reachable via IMDS unless you restrict it ([EKS pod configuration](https://docs.aws.amazon.com/eks/latest/userguide/pod-configuration.html)). Each cluster needs its own OIDC provider in every account it targets (one of the motivations for Pod Identity).

### Amazon EKS Pod Identity

Pod Identity is _not_ a direct STS call from the pod. The pod talks to a node-local agent, which calls the EKS Auth API; EKS then assumes the role ([how Pod Identity works](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-how-it-works.html)).

```text
EKS         -> Pod spec        : env AWS_CONTAINER_CREDENTIALS_FULL_URI=http://169.254.170.23/v1/credentials
                                 env AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE=/var/run/secrets/pods.eks.amazonaws.com/serviceaccount/eks-pod-identity-token
                                 projected SA token, audience pods.eks.amazonaws.com, expirationSeconds 86400
SDK         -> Agent           : GET http://169.254.170.23/v1/credentials  (Authorization: <SA token>)
Agent       -> EKS Auth        : POST /clusters/<cluster>/assume-role-for-pod-identity {"token": "<SA JWT>"}
                                 host eks-auth.<region>.api.aws, signed with node role (eks-auth:AssumeRoleForPodIdentity)
EKS Auth    -> STS             : AssumeRole + TagSession (principal pods.eks.amazonaws.com)
EKS Auth    -> Agent           : credentials + assumedRoleUser + subject{namespace, serviceAccount}
Agent       -> SDK             : container-credentials JSON
```

- Agent listens on `169.254.170.23` and `[fd00:ec2::23]`; nodes in private subnets need a PrivateLink endpoint for EKS Auth ([agent setup](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-agent-setup.html)).
- `AssumeRoleForPodIdentity` is "only used by the EKS Pod Identity Agent"; the session name is `eks-<cluster>-<pod>-<uuid>` and `audience` is always `pods.eks.amazonaws.com` ([API reference](https://docs.aws.amazon.com/eks/latest/APIReference/API_auth_AssumeRoleForPodIdentity.html)).
- Role trust: `"Service": "pods.eks.amazonaws.com"` with `sts:AssumeRole` and `sts:TagSession` ([trust policy](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-role.html)).
- Session tags added by default (six): `eks-cluster-arn`, `eks-cluster-name`, `kubernetes-namespace`, `kubernetes-service-account`, `kubernetes-pod-name`, `kubernetes-pod-uid` ([EKS best practices](https://docs.aws.amazon.com/eks/latest/best-practices/identity-and-access-management.html)). Usable as `aws:PrincipalTag/...` for ABAC.
- Associations can set `targetRoleArn` (EKS chains into a cross-account role) and an inline session `policy` (max 2,048 chars); a session policy requires `disableSessionTags=true` because of the packed policy size limit ([session policies for Pod Identity](https://aws.amazon.com/blogs/containers/session-policies-for-amazon-eks-pod-identity/)).
- Pitfall: credentials earlier in the SDK chain (env keys, IRSA env vars) win, so a pod can silently keep using the old path ([how Pod Identity works](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-how-it-works.html)). Old SDKs that do not accept `169.254.170.23` in `AWS_CONTAINER_CREDENTIALS_FULL_URI` fail.

### IAM Roles Anywhere (Workloads Outside AWS)

The workload proves possession of an X.509 private key whose certificate chains to a registered trust anchor. `CreateSession` is "an X.509 wrapper around AssumeRole" ([CreateSession](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/authentication-create-session.html)).

```text
Workload       -> aws_signing_helper : credential_process / serve / update
signing_helper -> Roles Anywhere     : POST https://rolesanywhere.<region>.amazonaws.com/sessions
                                       X-Amz-X509: <base64 DER cert>, SigV4-style signature with cert key
                                       {profileArn, roleArn, trustAnchorArn, durationSeconds, roleSessionName}
Roles Anywhere -> (validate chain, CRL, profile, trust anchor)
Roles Anywhere -> STS                : AssumeRole(roleArn, principal rolesanywhere.amazonaws.com, tags from cert)
Roles Anywhere -> signing_helper     : 201 {credentialSet:[{credentials, assumedRoleUser, ...}], subjectArn}
signing_helper -> SDK                : {"Version":1,"AccessKeyId":...,"SecretAccessKey":...,"SessionToken":...,"Expiration":...}
```

- Duration: `durationSeconds` 900 to 43200; final value is `min(profileDurationSeconds, createSessionDurationSeconds)` and must not exceed the role's `MaxSessionDuration` ([CreateSession](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/authentication-create-session.html)).
- Default role session name is the certificate serial number; custom names require `acceptRoleSessionName=true` on the profile ([CreateSession](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/authentication-create-session.html)).
- Trust policy needs `sts:AssumeRole`, `sts:TagSession`, `sts:SetSourceIdentity` for `rolesanywhere.amazonaws.com`; Subject, Issuer and SAN RDNs become principal tags such as `aws:PrincipalTag/x509Subject/CN`. Pin `aws:SourceArn` to the trust anchor ([trust model](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/trust-model.html)).
- Delivery modes of the helper: `credential-process`, `serve` (IMDSv2-compatible local server, default `127.0.0.1:9911`, consumed via `AWS_EC2_METADATA_SERVICE_ENDPOINT`), or `update` (writes the credentials file) ([credential helper](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/credential-helper.html)).
- Pitfall: a trust policy without a certificate-attribute condition lets _any_ certificate from that CA assume the role.

### Other AWS Services (Brief)

- AWS CodeBuild: the service role is the default credential inside the build container, delivered through container credentials; Docker containers you start inside the build do not inherit them unless you pass `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` through ([CodeBuild troubleshooting](https://docs.aws.amazon.com/codebuild/latest/userguide/troubleshooting.html), [Knowledge Center](https://repost.aws/knowledge-center/codebuild-temporary-credentials-docker)).
- AWS Glue: job sessions carry `glue:CredentialIssuingService = glue.amazonaws.com`, which also appears as a claim in outbound federation tokens ([token claims](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_token_claims.html)).
- General pattern: a service principal (`<service>.amazonaws.com`) is trusted by the role, the service calls `AssumeRole` after an `iam:PassRole` check at configuration time, and the service decides how to deliver the result (env vars, local HTTP endpoint, or internal use only).

## Part 2: Humans

### IAM Identity Center (Console and `aws sso login`)

Identity Center provisions a role named `AWSReservedSSO_<PermissionSet>_<hash>` under path `/aws-reserved/sso.amazonaws.com/` in each assigned account, plus a SAML provider `AWSSSO_<id>_DO_NOT_DELETE`. The role trusts that provider with `sts:AssumeRoleWithSAML` and `SAML:aud = signin.aws.amazon.com/saml` ([Knowledge Center](https://repost.aws/knowledge-center/iam-identity-center-federation)). So yes, Identity Center uses SAML federation internally, but you cannot call `AssumeRoleWithSAML` yourself against `AWSReservedSSO_*` roles ([AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)).

Console path:

```text
User        -> Access portal (<start-url>.awsapps.com/start) : sign in (Identity Center directory or external IdP)
User        -> Portal                                         : click "Management console" for account/permission set
Portal      -> Sign-In / STS                                  : AssumeRoleWithSAML(AWSReservedSSO_* role, AWSSSO_*_DO_NOT_DELETE)
STS         -> Console                                        : role session (userIdentity.type = SAMLUser in CloudTrail)
```

The CloudTrail evidence: console federation from the portal "is logged in to AWS CloudTrail with the API AssumeRoleWithSAML", with `principalArn` pointing at `saml-provider/AWSSSO_..._DO_NOT_DELETE` ([AWS Security Blog](https://aws.amazon.com/blogs/security/configure-aws-sso-abac-for-ec2-instances-and-systems-manager-session-manager/)).

CLI path (`aws sso login` then any command):

```text
CLI   -> SSO OIDC (oidc.<region>.amazonaws.com) : RegisterClient
CLI   -> Browser                                : https://oidc.<region>.amazonaws.com/authorize?...code_challenge_method=S256 (PKCE, default since CLI 2.22.0)
User  -> Browser                                : authenticate, approve
Browser -> CLI (127.0.0.1:<port>/oauth/callback): authorization code
CLI   -> SSO OIDC                               : CreateToken(code, code_verifier)  -> access token (+ refresh token)
CLI   -> ~/.aws/sso/cache/<sha1>.json           : cache token
SDK   -> Portal API (portal.sso.<region>.amazonaws.com) :
         GET /federation/credentials?account_id=...&role_name=...
         x-amz-sso_bearer_token: <access token>        (sso:GetRoleCredentials)
Portal -> SDK                                   : {roleCredentials:{accessKeyId, secretAccessKey, sessionToken, expiration}}
```

- PKCE is default from CLI 2.22.0; `--use-device-code` switches back to the device authorization grant (`https://device.sso.<region>.amazonaws.com/`) for browserless hosts ([CLI SSO](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html), [PKCE blog](https://aws.amazon.com/blogs/developer/aws-cli-adds-pkce-based-authorization-for-sso/)).
- `GetRoleCredentials` request and response shape: [Portal API](https://docs.aws.amazon.com/singlesignon/latest/PortalAPIReference/API_GetRoleCredentials.html). Its CloudTrail event source is `sso.amazonaws.com` ([Identity Center CloudTrail](https://docs.aws.amazon.com/singlesignon/latest/userguide/sso-info-in-cloudtrail.html)). Whether the target account also records an `AssumeRoleWithSAML` event for the CLI path is (unverified).
- Durations: permission set session 1 h default and minimum, 12 h maximum; generated roles have `MaxSessionDuration` 12 h ([session duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html)). Access portal session default 8 h, configurable 15 min to 7 days ([AWS Security Blog](https://aws.amazon.com/blogs/security/implementing-just-in-time-privileged-access-to-aws-with-microsoft-entra-and-aws-iam-identity-center/)). With `sso-session` (token refresh), a CLI session can outlive the portal session by up to one permission-set duration ([session considerations](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-session-duration-prereqs-considerations.html)).
- Pitfall: editing `AWSReservedSSO_*` roles in IAM fails with "protected role"; change the permission set instead ([troubleshooting](https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html)).

### `aws login` (Console Credentials for Local Development)

Launched 2025-11-19 with AWS CLI 2.32.0 ([AWS Security Blog](https://aws.amazon.com/blogs/security/simplified-developer-access-to-aws-with-aws-login/)). It reuses a console sign-in (root, IAM user, or federated role session) to mint CLI/SDK credentials, aimed at people who do not use Identity Center.

```text
User -> CLI      : aws login [--profile p] [--remote]
CLI  -> Browser  : https://signin.<region>.amazonaws.com/authorize?...  (OAuth 2.0 authorization code + PKCE)
User -> Browser  : pick an active console session or sign in    [signin:AuthorizeOAuth2Access]
Browser -> CLI   : authorization code (localhost redirect, or pasted when --remote)
CLI  -> Sign-In  : exchange code for OAuth tokens               [signin:CreateOAuth2Token]
CLI  -> ~/.aws/login/cache : cached credentials + refresh metadata
CLI  -> ~/.aws/config      : [default] login_session = arn:aws:iam::<acct>:user/<name>
SDK  -> Sign-In  : refresh every 15 min (as needed) until the session limit
```

- Permissions: `SignInLocalDevelopmentAccess` grants `signin:AuthorizeOAuth2Access` and `signin:CreateOAuth2Token` on `arn:aws:signin:*:*:oauth2/public-client/*`; `.../localhost` is same-device and `.../remote` is cross-device ([managed policy](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SignInLocalDevelopmentAccess.html), [Sign-In policies](https://docs.aws.amazon.com/signin/latest/userguide/security-iam-awsmanpol.html)). Deny those actions in an SCP to disable it org-wide.
- Lifetime: credentials refreshed every 15 minutes; the overall session lasts up to the principal's session duration, maximum 12 hours ([CLI guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)).
- Older SDKs: expose it through `credential_process = aws configure export-credentials --profile signin --format process` ([CLI guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)).
- Which STS operation Sign-In uses internally is not documented (unverified). The CLI reference example shows the resulting identity as an `assumed-role` ARN for a role session ([CLI reference](https://docs.aws.amazon.com/cli/latest/reference/login/index.html)).

### SAML 2.0 Federation (Okta, Entra ID, AD FS, ...)

```text
User     -> IdP                      : authenticate (IdP-initiated or SP-initiated)
IdP      -> Browser                  : HTML form auto-POST of SAMLResponse
Browser  -> https://<region>.signin.aws.amazon.com/saml (or signin.aws.amazon.com/saml)
Sign-In  -> STS                      : AssumeRoleWithSAML(RoleArn, PrincipalArn=saml-provider, SAMLAssertion)
STS      -> Sign-In                  : role credentials
Sign-In  -> Browser                  : console session (role picker if multiple Role values)
```

- `AssumeRoleWithSAML` needs no AWS credentials; STS validates the assertion with the keys in the SAML provider's metadata ([AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)).
- Required attributes: `https://aws.amazon.com/SAML/Attributes/Role` (role ARN plus provider ARN) and `.../RoleSessionName`; optional `.../SessionDuration` (900 to 43200 s, console only), `.../SourceIdentity`, `.../PrincipalTag:*`. The console endpoint is `https://region-code.signin.aws.amazon.com/saml` ([SAML assertions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_saml_assertions.html)).
- Trust policy: `"Federated": "arn:aws:iam::<acct>:saml-provider/<name>"`, action `sts:AssumeRoleWithSAML` (plus `sts:TagSession` / `sts:SetSourceIdentity` if used), condition `SAML:aud = https://signin.aws.amazon.com/saml`.
- Duration: default 3600 s, 900 s to role max (up to 12 h), capped by the assertion's `SessionNotOnOrAfter` ([AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)).
- Pitfalls: the `NameID` lands in CloudTrail, so prefer a persistent non-PII format ([AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)); credentials from `AssumeRoleWithSAML` cannot call `GetFederationToken` or `GetSessionToken`. CLI use requires third-party tools that scrape the assertion.

### Custom Identity Broker and the Federation Endpoint

For organisations with a home-grown SSO, a broker turns any authenticated user into a console URL ([custom broker](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)).

```text
User   -> Broker               : authenticate against corporate system
Broker -> STS                  : AssumeRole (recommended) or GetFederationToken(Policy=...)
Broker -> Federation endpoint  : GET https://signin.aws.amazon.com/federation?Action=getSigninToken
                                 &SessionDuration=1800&Session={"sessionId","sessionKey","sessionToken"}
Fed    -> Broker               : {"SigninToken":"..."}
Broker -> User                 : 302 to https://signin.aws.amazon.com/federation?Action=login
                                 &Issuer=<broker url>&Destination=<console url>&SigninToken=...
User   -> Console              : session established
```

- `SigninToken` URL valid 15 minutes ([custom broker](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)).
- `SessionDuration` (900 to 43200) is only for `AssumeRole*` credentials, must be below the role max, and must not be used with `GetFederationToken` or role-chained credentials, or the call fails. `GetFederationToken` sessions can run 900 s to 129600 s (36 h); root-called ones max 3600 s ([custom broker](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)).
- Pitfall: the broker itself holds long-term IAM user keys if it uses `GetFederationToken`; treat the URL as a bearer secret.

### Amazon Cognito Identity Pools

Identity pools exchange an IdP artifact (user pool ID token, OIDC ID token, SAML assertion, or social access token) for AWS credentials ([authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)).

```text
Enhanced flow (recommended)
App     -> cognito-identity : GetId(IdentityPoolId, Logins={provider: token})          [no AWS creds needed]
App     -> cognito-identity : GetCredentialsForIdentity(IdentityId, Logins)
Cognito -> STS              : AssumeRoleWithWebIdentity on the app's behalf (role from default/rules/token)
Cognito -> App              : credentials (valid 1 hour)

Basic (classic) flow
App     -> cognito-identity : GetId
App     -> cognito-identity : GetOpenIdToken  -> Cognito-issued OIDC token (valid 10 minutes)
App     -> STS              : AssumeRoleWithWebIdentity(RoleArn chosen by app, token)
```

- Enhanced flow credentials are valid one hour; basic flow is not allowed when role mappings exist and AWS advises not enabling it by default ([authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)). `GetOpenIdToken` tokens last 10 minutes ([SDK reference](https://docs.aws.amazon.com/sdk-for-kotlin/api/latest/cognitoidentity/aws.sdk.kotlin.services.cognitoidentity/-cognito-identity-client/get-open-id-token.html)).
- Enhanced flow applies a Cognito-managed scope-down session policy; you cannot set your own session policy there ([JS SDK note](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CognitoIdentityCredentials.html)).
- Role trust: `"Federated": "cognito-identity.amazonaws.com"`, conditions on `cognito-identity.amazonaws.com:aud` (pool ID) and `cognito-identity.amazonaws.com:amr` (`authenticated` / `unauthenticated`). Missing `aud` lets other pools' identities in.

### IAM User with MFA (`GetSessionToken`)

```text
User -> CLI : aws sts get-session-token --serial-number <mfa arn> --token-code 123456
             (or: aws configure mfa-login)
CLI  -> STS : GetSessionToken signed with long-term AKIA... keys
STS  -> CLI : ASIA... credentials, aws:MultiFactorAuthPresent=true in later requests
```

- Must be called with an IAM user's long-term keys; 900 s to 129600 s (36 h), default 43200 s; root user 900 to 3600 s. The resulting credentials cannot call IAM unless MFA info is included and can only call STS `AssumeRole` and `GetCallerIdentity` ([GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html)).
- `aws configure mfa-login` wraps this and writes the result into a profile; OTP devices only, not passkeys/U2F ([CLI reference](https://docs.aws.amazon.com/cli/latest/reference/configure/mfa-login.html)).
- Alternative: put `mfa_serial` in a `role_arn` profile so the CLI calls `AssumeRole` with `SerialNumber`/`TokenCode`.

## Part 3: CI/CD and Generic OIDC

### IAM OIDC Identity Provider Objects

An IAM OIDC provider (`arn:aws:iam::<acct>:oidc-provider/<host/path>`) stores the issuer URL, a client ID list (allowed `aud` values) and optional thumbprints. AWS now verifies the JWKS endpoint's TLS certificate against its library of trusted root CAs; thumbprints are only used if the IdP's certificate is not signed by one of those CAs ([UpdateOpenIDConnectProviderThumbprint](https://docs.aws.amazon.com/IAM/latest/APIReference/API_UpdateOpenIDConnectProviderThumbprint.html), [thumbprint guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html)). If you omit the thumbprint on create, IAM retrieves it.

```text
Runner -> CI OIDC issuer : request ID token (aud = sts.amazonaws.com)
Runner -> STS            : AssumeRoleWithWebIdentity(RoleArn, RoleSessionName, WebIdentityToken)  [unsigned]
STS    -> IAM            : find oidc-provider matching iss; check aud in client ID list
STS    -> CI issuer      : GET /.well-known/openid-configuration, JWKS (TLS verified)
STS    -> IAM            : evaluate trust policy conditions on <issuer>:sub / :aud / other claims
STS    -> Runner         : credentials
```

### GitHub Actions

- Issuer `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, job needs `permissions: id-token: write` ([configure-aws-credentials README](https://github.com/aws-actions/configure-aws-credentials)).
- `aws-actions/configure-aws-credentials` (current major v6) defaults: audience `sts.amazonaws.com`, role session name `GitHubActions`, duration 3600 s (range 900 to 43200). OIDC uses `AssumeRoleWithWebIdentity`; static keys and `role-chaining` use `AssumeRole`. Thumbprints are ignored ([README](https://github.com/aws-actions/configure-aws-credentials)).
- `sub` formats: `repo:<org>/<repo>:ref:refs/heads/<branch>`, `repo:<org>/<repo>:environment:<name>`, `repo:<org>/<repo>:pull_request`, etc. IAM rejects a trust policy for this provider unless `token.actions.githubusercontent.com:sub` is present and not just `*`/`?` ([IAM OIDC role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)).
- Immutable subject claims: repositories created after 2026-07-15 (plus renamed/transferred ones, and older ones that opt in) emit `repo:<org>@<org_id>/<repo>@<repo_id>:ref:...`; github.com only, not GHES ([GitHub changelog](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)). Name-only trust policies then fail with "Not authorized to perform sts:AssumeRoleWithWebIdentity" ([AWS Security Agent docs](https://docs.aws.amazon.com/securityagent/latest/userguide/cicd-pentest.html), [README](https://github.com/aws-actions/configure-aws-credentials)).

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": [
        "repo:my-org/my-app:ref:refs/heads/main",
        "repo:my-org@123456/my-app@789012:ref:refs/heads/main"
      ]
    }
  }
}
```

### GitLab CI/CD, HCP Terraform, Others

| Provider | Issuer | Typical `aud` | `sub` format |
| --- | --- | --- | --- |
| GitLab CI/CD | `https://gitlab.com` or self-managed URL | configured via `id_tokens` (example default `https://gitlab.com`) | `project_path:<group>/<project>:ref_type:branch:ref:<name>` |
| HCP Terraform | `https://app.terraform.io` | `aws.workload.identity` (override `TFC_AWS_WORKLOAD_IDENTITY_AUDIENCE`) | `organization:<org>:project:<proj>:workspace:<ws>:run_phase:<plan or apply>` |
| Bitbucket Pipelines | `https://api.bitbucket.org/2.0/workspaces/<ws>/pipelines-config/identity/oidc` | `ari:cloud:bitbucket::workspace/<uuid>` | `{<repo uuid>}:...` (no branch claim) |
| Azure DevOps | `https://vstoken.dev.azure.com/<org guid>` | `api://AzureADTokenExchange` | `sc://<org>/<project>/<service connection>` |

Sources: [AWS Security Agent CI/CD docs](https://docs.aws.amazon.com/securityagent/latest/userguide/cicd-pentest.html) (GitLab, Bitbucket, Azure DevOps), [HCP Terraform AWS dynamic credentials](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration) (`TFC_AWS_PROVIDER_AUTH=true`, `TFC_AWS_RUN_ROLE_ARN`, optional per-phase `TFC_AWS_PLAN_ROLE_ARN` / `TFC_AWS_APPLY_ROLE_ARN`).

Generic Kubernetes (self-managed, other clouds): publish the API server's service-account issuer discovery document and JWKS at a public HTTPS URL, register it as an IAM OIDC provider, and mount a projected token with audience `sts.amazonaws.com`; then set `AWS_ROLE_ARN` and `AWS_WEB_IDENTITY_TOKEN_FILE` exactly like IRSA (the SDK side is identical; the open-source pod identity webhook is optional) ([EKS pod configuration](https://docs.aws.amazon.com/eks/latest/userguide/pod-configuration.html)).

CI pitfalls:

- Wildcarding the repository/project part of `sub` lets forks and other orgs assume your role ([AWS Security Agent docs](https://docs.aws.amazon.com/securityagent/latest/userguide/cicd-pentest.html)).
- STS rejects a `DurationSeconds` above the role's `MaxSessionDuration` instead of clamping it; long jobs need a larger role max ([AWS Security Agent docs](https://docs.aws.amazon.com/securityagent/latest/userguide/cicd-pentest.html)).
- Debug tracing (`CI_DEBUG_TRACE`, `set -x`) can print tokens and keys to logs.

## Part 4: Special STS Paths

### Outbound Identity Federation (`GetWebIdentityToken`)

Announced 2025-11-19: AWS now _issues_ OIDC-compatible JWTs for IAM principals so workloads can authenticate to external services ([AWS News Blog](https://aws.amazon.com/blogs/aws/simplify-access-to-external-services-using-aws-iam-outbound-identity-federation/)).

```text
Admin   -> IAM          : enable outbound identity federation (console Account settings, or EnableOutboundWebIdentityFederation)
IAM     -> Admin        : issuer https://<account-unique-id>.tokens.sts.global.api.aws
App     -> STS (Regional): GetWebIdentityToken(Audience=[...], SigningAlgorithm=ES384|RS256, DurationSeconds, Tags)
                           signed with the app's existing role credentials
STS     -> App          : {WebIdentityToken: <JWT>, Expiration}
App     -> External svc : present JWT
Ext svc -> Issuer       : GET /.well-known/openid-configuration, /.well-known/jwks.json
Ext svc -> Ext svc      : verify signature, iss, aud, sub, exp; map claims to permissions
```

- Parameters: `Audience` 1 to 10 values; `DurationSeconds` 60 to 3600, default 300; `SigningAlgorithm` `RS256` or `ES384` (required); up to 50 `Tags`. Not available on the STS global endpoint. Errors include `OutboundWebIdentityFederationDisabled` and `SessionDurationEscalation` (a token cannot outlive the calling session) ([API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)).
- Claims: standard `iss`, `aud`, `sub` (principal ARN), `iat`, `exp`, `jti`; under the `https://sts.amazonaws.com/` namespace: `aws_account`, `source_region`, `org_id`, `ou_path`, `principal_tags`, `request_tags`, and context such as `ec2_source_instance_arn`, `ec2_instance_source_vpc`, `ec2_role_delivery`, `lambda_source_function_arn`, `identity_store_user_id`, `federated_provider`, `source_identity`, `original_session_exp`, `glue_credential_issuing_service` ([token claims](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_token_claims.html)).
- Control: `sts:GetWebIdentityToken` permission plus condition keys `sts:IdentityTokenAudience`, `sts:SigningAlgorithm`, `sts:DurationSeconds`, usable in identity policies, SCPs, RCPs and VPC endpoint policies ([AWS News Blog](https://aws.amazon.com/blogs/aws/simplify-access-to-external-services-using-aws-iam-outbound-identity-federation/)).
- Pitfall: external services must pin the account-specific `iss` _and_ check `sub`/`aud`; trusting all of `*.tokens.sts.global.api.aws` would trust every AWS account.

### Centralized Root Access (`AssumeRoot`)

With centralized root access enabled in AWS Organizations, a principal in the management account or IAM delegated administrator account calls `sts:AssumeRoot` to get a task-scoped root session in a member account ([AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)).

```text
Admin (mgmt/delegated) -> STS Regional endpoint : AssumeRoot(TargetPrincipal=<member acct>,
                                                   TaskPolicyArn=arn:aws:iam::aws:policy/root-task/<policy>,
                                                   DurationSeconds<=900)
STS -> Admin : root credentials for member account, scoped by task policy
Admin -> IAM/S3/SQS in member account : the one privileged task
```

- Task policies: `IAMAuditRootUserCredentials`, `IAMCreateRootUserPassword`, `IAMDeleteRootUserCredentials`, `S3UnlockBucketPolicy`, `SQSUnlockQueuePolicy` ([AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)).
- Duration 0 to 900 s, default 900; global endpoint not supported; cannot be called with root credentials ([AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)). Restrict with `sts:TaskPolicyArn`; SCPs and VPC endpoint policies still apply during the session ([AWS Security Blog](https://aws.amazon.com/blogs/security/secure-root-user-access-for-member-accounts-in-aws-organizations/)).

## Part 5: SDK and CLI Plumbing

### Default Credential Provider Chains

The order is _not_ identical across SDKs ([standardized providers](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)).

| SDK / tool | Order (first match wins) |
| --- | --- |
| AWS CLI | command-line options, env vars, assume role, assume role with web identity, credentials file, credential process, config file, container credentials, EC2 instance profile ([CLI auth](https://docs.aws.amazon.com/cli/v1/userguide/cli-chap-authentication.html)) |
| Boto3 | params to `client()`, params to `Session`, env vars, assume role provider, web identity, IAM Identity Center, `~/.aws/credentials`, login (console credentials), `~/.aws/config`, Boto2 config, container provider, IMDS ([Boto3](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html)) |
| Java 2.x | system properties, env vars, web identity (`AWS_WEB_IDENTITY_TOKEN_FILE` + `AWS_ROLE_ARN`), profile (web identity, SSO, `source_profile`, `credential_source`, `login_session`, `credential_process`, static), container, IMDS ([Java](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html)) |
| Go v2 | env vars (static keys, then `AWS_WEB_IDENTITY_TOKEN_FILE`), shared config/credentials (SSO, login, assume role, process), ECS task role, EC2 role ([Go](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/configure-gosdk.html)) |
| JavaScript v3 (Node) | `fromEnv`, `fromSSO`, `fromIni`, web identity, ECS, IMDS, process, login provider (see guide for exact table) ([JS v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)) |

Practical consequences:

- Env vars beat everything else, which is how stale `AWS_ACCESS_KEY_ID` in a shell silently overrides a profile.
- Web identity (IRSA) precedes container credentials (Pod Identity, ECS), which precede IMDS. That is why a node role "leaks" only when nothing earlier matches.
- The container provider reads `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` (appended to `169.254.170.2`) first, then `AWS_CONTAINER_CREDENTIALS_FULL_URI`, and sends `AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE` or `AWS_CONTAINER_AUTHORIZATION_TOKEN` as the `Authorization` header ([container provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-container-credentials.html)).

### Profiles: `role_arn`, `source_profile`, `credential_source`, `credential_process`

```text
[profile base]
sso_session = corp
sso_account_id = 111122223333
sso_role_name = Developer

[profile prod-admin]
role_arn = arn:aws:iam::444455556666:role/Admin
source_profile = base            ; or credential_source = Ec2InstanceMetadata | EcsContainer | Environment
mfa_serial = arn:aws:iam::111122223333:mfa/alice
role_session_name = alice
duration_seconds = 3600

[profile onprem]
credential_process = /usr/local/bin/aws_signing_helper credential-process --certificate ... --private-key ... --trust-anchor-arn ... --profile-arn ... --role-arn ...

[profile ci]
role_arn = arn:aws:iam::111122223333:role/ci
web_identity_token_file = /var/run/secrets/token
```

- `source_profile` chains: the CLI resolves `base` (here via SSO `GetRoleCredentials`) and then calls `sts:AssumeRole` for `prod-admin` ([CLI roles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)). Role chaining caps the second session at 1 hour ([AssumeRoleWithSAML note on chaining](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)).
- `credential_process` must print JSON with `Version: 1`, `AccessKeyId`, `SecretAccessKey`, optional `SessionToken` and `Expiration` (see the Roles Anywhere helper above).
- Caches: assumed-role and web-identity credentials in `~/.aws/cli/cache` (delete to force refresh after revocation) ([CLI roles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)); SSO tokens in `~/.aws/sso/cache` ([CLI SSO](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)); `aws login` in `~/.aws/login/cache` (override `AWS_LOGIN_CACHE_DIRECTORY`) ([CLI login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)). SDKs other than the CLI usually cache only in memory.
- `AWS_ROLE_ARN` / `AWS_WEB_IDENTITY_TOKEN_FILE` / `AWS_ROLE_SESSION_NAME` apply only to the web-identity provider, not to generic `AssumeRole` ([CLI roles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)).

## Common Pitfalls Across Paths

- Duration requests above `MaxSessionDuration` fail rather than clamp; role chaining is capped at 1 hour.
- Unsigned STS calls (`AssumeRoleWithWebIdentity`, `AssumeRoleWithSAML`) are authorized purely by the trust policy; weak `sub`/`aud`/`SAML:aud` conditions are the top federation misconfiguration.
- Earlier providers in the chain shadow later ones (env vars over profiles, IRSA env over Pod Identity, anything over IMDS).
- Link-local endpoints (`169.254.169.254`, `169.254.170.2`, `169.254.170.23`) are reachable by every process in the network namespace; isolation comes from the platform (Fargate, hop limit, network policy), not from the SDK.
- Some newer STS operations (`AssumeRoot`, `GetWebIdentityToken`) reject the global endpoint; configure a Regional STS endpoint.

## Sources

- [AWS STS API: AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)
- [AWS STS API: GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)
- [AWS STS API: AssumeRoleWithSAML](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithSAML.html)
- [AWS STS API: GetSessionToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html)
- [IAM: Use an IAM role for applications on EC2](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2.html)
- [EC2: Retrieve security credentials from instance metadata](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-metadata-security-credentials.html)
- [EC2: Use IMDS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)
- [EC2: Configure IMDS options for new instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-new-instances.html)
- [IAM global condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)
- [Security Blog: Restrict where EC2 instance credentials can be used](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/)
- [Security Blog: IMDSv2 defense in depth](https://aws.amazon.com/blogs/security/defense-in-depth-open-firewalls-reverse-proxies-ssrf-vulnerabilities-ec2-instance-metadata-service/)
- [Lambda: SnapStart and credentials](https://docs.aws.amazon.com/lambda/latest/dg/snapstart-activate.html)
- [Lambda: Source function ARN](https://docs.aws.amazon.com/lambda/latest/dg/permissions-source-function-arn.html)
- [ECS: Task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Knowledge Center: ECS Fargate metadata errors](https://repost.aws/knowledge-center/ecs-fargate-metadata-errors)
- [Knowledge Center: ECS task role config errors](https://repost.aws/knowledge-center/ecs-iam-task-roles-config-errors)
- [EKS: Configure Pods to use a service account (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/pod-configuration.html)
- [EKS Best Practices: Identity and access management](https://docs.aws.amazon.com/eks/latest/best-practices/identity-and-access-management.html)
- [EKS: How Pod Identity works](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-how-it-works.html)
- [EKS: Pod Identity agent setup](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-agent-setup.html)
- [EKS: Pod Identity role trust policy](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-role.html)
- [EKS Auth API: AssumeRoleForPodIdentity](https://docs.aws.amazon.com/eks/latest/APIReference/API_auth_AssumeRoleForPodIdentity.html)
- [Containers Blog: Session policies for EKS Pod Identity](https://aws.amazon.com/blogs/containers/session-policies-for-amazon-eks-pod-identity/)
- [IAM Roles Anywhere: CreateSession](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/authentication-create-session.html)
- [IAM Roles Anywhere: Trust model](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/trust-model.html)
- [IAM Roles Anywhere: Credential helper](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/credential-helper.html)
- [CodeBuild troubleshooting](https://docs.aws.amazon.com/codebuild/latest/userguide/troubleshooting.html)
- [Knowledge Center: CodeBuild credentials into Docker](https://repost.aws/knowledge-center/codebuild-temporary-credentials-docker)
- [Knowledge Center: Identity Center and IAM federation](https://repost.aws/knowledge-center/iam-identity-center-federation)
- [Security Blog: Identity Center ABAC (AssumeRoleWithSAML in CloudTrail)](https://aws.amazon.com/blogs/security/configure-aws-sso-abac-for-ec2-instances-and-systems-manager-session-manager/)
- [Identity Center Portal API: GetRoleCredentials](https://docs.aws.amazon.com/singlesignon/latest/PortalAPIReference/API_GetRoleCredentials.html)
- [Identity Center: CloudTrail events](https://docs.aws.amazon.com/singlesignon/latest/userguide/sso-info-in-cloudtrail.html)
- [Identity Center: Session duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html)
- [Identity Center: Session duration considerations](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-session-duration-prereqs-considerations.html)
- [Identity Center troubleshooting](https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html)
- [Security Blog: JIT access with Entra and Identity Center](https://aws.amazon.com/blogs/security/implementing-just-in-time-privileged-access-to-aws-with-microsoft-entra-and-aws-iam-identity-center/)
- [CLI: Configure IAM Identity Center](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [Developer Tools Blog: PKCE for AWS CLI SSO](https://aws.amazon.com/blogs/developer/aws-cli-adds-pkce-based-authorization-for-sso/)
- [CLI: Login with console credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)
- [CLI reference: login](https://docs.aws.amazon.com/cli/latest/reference/login/index.html)
- [Security Blog: aws login](https://aws.amazon.com/blogs/security/simplified-developer-access-to-aws-with-aws-login/)
- [Managed policy: SignInLocalDevelopmentAccess](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SignInLocalDevelopmentAccess.html)
- [Sign-In: AWS managed policies](https://docs.aws.amazon.com/signin/latest/userguide/security-iam-awsmanpol.html)
- [IAM: Configure SAML assertions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_saml_assertions.html)
- [IAM: Custom identity broker console access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html)
- [Cognito: Identity pools authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)
- [SDK for Kotlin: getOpenIdToken](https://docs.aws.amazon.com/sdk-for-kotlin/api/latest/cognitoidentity/aws.sdk.kotlin.services.cognitoidentity/-cognito-identity-client/get-open-id-token.html)
- [SDK for JavaScript v2: CognitoIdentityCredentials](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CognitoIdentityCredentials.html)
- [CLI reference: configure mfa-login](https://docs.aws.amazon.com/cli/latest/reference/configure/mfa-login.html)
- [IAM API: UpdateOpenIDConnectProviderThumbprint](https://docs.aws.amazon.com/IAM/latest/APIReference/API_UpdateOpenIDConnectProviderThumbprint.html)
- [IAM: OIDC thumbprints](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html)
- [IAM: Create a role for OIDC federation (GitHub sub check)](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
- [GitHub Changelog: Immutable subject claims](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)
- [AWS Security Agent: CI/CD OIDC trust policies by provider](https://docs.aws.amazon.com/securityagent/latest/userguide/cicd-pentest.html)
- [HCP Terraform: AWS dynamic provider credentials](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration)
- [AWS News Blog: IAM outbound identity federation](https://aws.amazon.com/blogs/aws/simplify-access-to-external-services-using-aws-iam-outbound-identity-federation/)
- [IAM: Outbound token claims](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound_token_claims.html)
- [IAM: Federating AWS identities to external services](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_outbound.html)
- [Security Blog: Centralized root access](https://aws.amazon.com/blogs/security/secure-root-user-access-for-member-accounts-in-aws-organizations/)
- [SDKs and Tools: Standardized credential providers](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)
- [SDKs and Tools: Container credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-container-credentials.html)
- [Boto3: Credentials](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html)
- [SDK for Java 2.x: Default credentials provider chain](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html)
- [SDK for Go v2: Configure the SDK](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/configure-gosdk.html)
- [SDK for JavaScript v3: Set credentials in Node.js](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)
- [CLI: Authentication and credential precedence](https://docs.aws.amazon.com/cli/v1/userguide/cli-chap-authentication.html)
- [CLI: Use an IAM role](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)
