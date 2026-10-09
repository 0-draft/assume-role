# AWS STS in One Page

_Checked against AWS documentation on 2026-10-10. Details and sources are in the linked deep dives._

## What STS is

The AWS Security Token Service issues temporary security credentials: an access key ID that starts with `ASIA`, a secret access key, a session token and an expiry. Anything in AWS that holds credentials it did not type in (a CLI profile that assumes a role, a CI job, an EC2 instance, a Lambda function, a console session that came through SAML) is almost always holding keys that STS printed. STS is free to call ([IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html)).

Temporary credentials matter because they expire on their own. A leaked long-term `AKIA` key works until someone deletes it; a leaked STS key stops at its expiry, between 15 minutes and 36 hours depending on the API.

## Why it feels hard

- **Many front doors.** There is a global endpoint (`sts.amazonaws.com`), a regional endpoint per Region, FIPS endpoints in six US and Canada Regions, dual-stack IPv6 endpoints (`sts.<region>.api.aws`), PrivateLink interface endpoints, and separate partitions (China, GovCloud, European Sovereign Cloud). See [02-endpoints.md](02-endpoints.md).
- **The global endpoint changed.** Until April 2025 every call to `sts.amazonaws.com` went to us-east-1. Since 2025-04-18 calls from default-enabled Regions using Amazon-provided DNS are served in the caller's own Region, but CloudTrail still logs them in us-east-1 and `aws:RequestedRegion` is still `us-east-1`.
- **SDK defaults moved twice.** New SDK major versions defaulted to regional endpoints from July 2022; the remaining SDKs and AWS CLI v1 switched on 2025-07-31.
- **Eleven APIs that look alike.** AssumeRole, AssumeRoleWithSAML, AssumeRoleWithWebIdentity, AssumeRoot, GetSessionToken, GetFederationToken, GetDelegatedAccessToken, GetWebIdentityToken, GetCallerIdentity, GetAccessKeyInfo and DecodeAuthorizationMessage differ in who may call them, whether the request is signed, how long the result lasts and what the result can do. See [03-api-operations.md](03-api-operations.md).
- **Most callers never call STS themselves.** EC2, Lambda, ECS and EKS Pod Identity have an AWS service call STS and hand over the result; IRSA and GitHub Actions call `AssumeRoleWithWebIdentity` from the workload; Identity Center uses SAML underneath. See [05-credential-paths.md](05-credential-paths.md).
- **Permissions come from several layers.** A session's effective permissions are the intersection of the role's policies, any session policy, a permissions boundary, SCPs and RCPs, and the trust policy decides who may get a session at all. See [04-sessions-and-policies.md](04-sessions-and-policies.md).

## Numbers worth remembering

| Fact | Value |
| --- | --- |
| AssumeRole duration | 15 min to the role's MaxSessionDuration (1–12 h), default 1 h |
| Role chaining | Capped at 1 h; asking for more fails |
| GetSessionToken, GetFederationToken | 15 min to 36 h, default 12 h; 1 h max with root credentials |
| AssumeRoot | At most 15 min, regional endpoints only, one of five root-task policies |
| GetWebIdentityToken (JWT) | 60 s to 1 h, default 5 min |
| Session policies | 1 inline plus up to 10 managed ARNs, 2,048 characters of plaintext |
| Session tags | Up to 50; key 128 characters, value 256 |
| Session token | Up to 4,096 bytes since September 2026 (`SessionTokenSize`, `SessionTokenUtilization`) |
| Request quota | 600 requests per second per account per Region, shared by most STS APIs |
| API version | Query protocol, `Version=2011-06-15`, SigV4 service name `sts` |

## Where to go next

- Running into an error: [06-operations-and-security.md](06-operations-and-security.md) has the error catalogue, CloudTrail fields and quotas.
- How it got this way: [07-timeline.md](07-timeline.md).
- The interactive version of all of this: <https://0-draft.github.io/assume-role/>.
