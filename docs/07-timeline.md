# AWS STS Timeline

_Last verified: 2026-10-10_

This timeline lists the AWS Security Token Service (STS) launches and behavior changes that matter for design and operations, from the 2011 launch to October 2026. Each entry links to a primary source where one exists. Dates come from AWS What's New posts, AWS blogs, or the API reference. Entries marked "(unverified)" could not be tied to an official AWS source.

## At a glance

| Date | Event | Why it matters |
| --- | --- | --- |
| 2011-08 | STS launches with the single global endpoint `sts.amazonaws.com` in `us-east-1` | Temporary credentials and federation begin |
| 2012-11 | Cross-account API access with IAM roles (`AssumeRole`) | Roles become the cross-account primitive |
| 2013-05 | Web identity federation (`AssumeRoleWithWebIdentity`) | OIDC/OAuth sign-in without long-term keys |
| 2013-11 | SAML 2.0 federation (`AssumeRoleWithSAML`) | Enterprise SSO to console and API |
| 2015-02 | Regional STS endpoints | Lower latency, fault isolation |
| 2018-03 | Role sessions up to 12 hours | `MaxSessionDuration` 1 to 12 hours |
| 2018-07 | STS over AWS PrivateLink (first Region) | Private access from VPCs |
| 2019-09 | EKS IAM roles for service accounts | Kubernetes pods use `AssumeRoleWithWebIdentity` |
| 2019-11 | Session tags (`sts:TagSession`) | ABAC from IdP attributes |
| 2021-04 | Source identity (`sts:SetSourceIdentity`) | Attribution that survives role chaining |
| 2022-07 | New SDK major versions default to Regional endpoints; IAM Roles Anywhere | Regional-first SDK policy; X.509 workloads outside AWS |
| 2023-07 | GitHub OIDC verified through trusted root CAs | Thumbprint pinning no longer needed for GitHub |
| 2023-11 | EKS Pod Identity | Session tags for pods, no per-cluster OIDC provider |
| 2024-07 | OIDC thumbprints no longer needed for common IdPs | Fewer outages from IdP certificate rotation |
| 2024-11 | RCPs support STS; `AssumeRoot` | Org-wide trust guardrails; scoped root sessions |
| 2025-01 | Global endpoint regionalization announced | Preview of the 2025 change |
| 2025-04 | Global endpoint served in-Region for default-enabled Regions | Resilience for legacy callers |
| 2025-07 | Remaining SDKs and CLI v1 switch default to Regional endpoints | Global endpoint no longer the default anywhere |
| 2025-11 | IPv6 dual-stack, `GetWebIdentityToken`, `GetDelegatedAccessToken` | IPv6; outbound OIDC; partner delegation |
| 2026-02 | IdP-specific OIDC claims as condition keys | Fine-grained GitHub, Google, CircleCI, OCI trust |
| 2026-08 | Outbound identity federation in the AWS European Sovereign Cloud | Sovereign Region support |
| 2026-09 | Single 4,096-byte session token limit with metrics; VPC endpoints for OIDC discovery | Predictable `PackedPolicyTooLarge`; private JWKS |

## Detailed entries

### 2010 to 2014: foundations

- 2010-09-02: IAM launches as a preview beta, the identity layer STS later issues credentials for ([Wikipedia: Timeline of AWS](https://en.wikipedia.org/wiki/Timeline_of_Amazon_Web_Services)). The source is secondary.
- 2011-06-15: the date in the STS API version string `2011-06-15`, which every STS operation still uses today ([STS API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html)).
- 2011-08: AWS launches STS "with a single global endpoint (`https://sts.amazonaws.com`), hosted in the US East (N. Virginia) AWS Region" ([AWS Security Blog, 2025-01-27](https://aws.amazon.com/blogs/security/announcing-upcoming-changes-to-the-aws-security-token-service-global-endpoint/)). The launch operations were `GetSessionToken` and `GetFederationToken`, both on the 2011-06-15 API version; no AWS page states the launch API set explicitly (unverified).
- 2012-06: IAM roles for EC2 instances (instance profiles) launch (unverified; not tied to a primary source in this research).
- 2012-11-19: "Cross-Account API Access using IAM roles" introduces `AssumeRole` for delegating access between accounts without sharing long-term credentials ([What's New](https://aws.amazon.com/about-aws/whats-new/2012/11/19/Announcing-Cross-Account-API-Access-Using-IAM-Roles/)).
- 2013-05-28: web identity federation introduces `AssumeRoleWithWebIdentity` for Login with Amazon, Facebook, and Google ([What's New](https://aws.amazon.com/about-aws/whats-new/2013/05/28/announcing-iam-web-identity-federation/)).
- 2013-11-11: SAML 2.0 support introduces SAML providers, `AssumeRoleWithSAML`, and the `https://signin.aws.amazon.com/saml` sign-in endpoint ([What's New](https://aws.amazon.com/about-aws/whats-new/2013/11/11/aws-identity-and-access-management-iam-adds-support-for-saml-security-assertion-markup-language-2-0/), [AWS News Blog](https://aws.amazon.com/blogs/aws/aws-identity-and-access-management-using-saml/)).

### 2015 to 2019: Regionalization and richer sessions

- 2015-02-17: STS becomes available in every AWS Region through Regional endpoints. Each Regional endpoint must be activated per account. `us-east-1`, GovCloud (US), and China (Beijing) are always active ([AWS Security Blog](https://aws.amazon.com/blogs/security/aws-security-token-service-is-now-available-in-every-aws-region/)).
- 2016 (early): `GetCallerIdentity` appears. The API reference sample requests are dated January to March 2016, but no announcement was found (unverified).
- 2018-03: the maximum role session duration for CLI/API sessions can be raised to 12 hours ([What's New](https://aws.amazon.com/about-aws/whats-new/2018/03/longer-role-sessions/), [AWS Security Blog](https://aws.amazon.com/blogs/security/enable-federated-api-access-to-your-aws-resources-for-up-to-12-hours-using-iam-roles/)).
- 2018-07-31: STS supports AWS PrivateLink (interface VPC endpoints), starting in US West (Oregon) ([What's New](https://aws.amazon.com/about-aws/whats-new/2018/07/aws-sts-support-for-privatelink-us-west-2/)).
- 2019 (around the first opt-in Region launches): global-endpoint session token versions (`v1Token`/`v2Token`) and `SetSecurityTokenServicePreferences` exist so tokens work in opt-in Regions ([IAM API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_SetSecurityTokenServicePreferences.html)). The introduction date is unverified.
- `GetAccessKeyInfo` exists in the API reference ([API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)); its introduction date is unverified.
- 2019-09-04: Amazon EKS IAM roles for service accounts (IRSA). SDKs gain a web identity token credential provider that calls `AssumeRoleWithWebIdentity` ([AWS Open Source Blog](https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/)).
- 2019-11: session tags. Attributes from SAML or OIDC IdPs, and from `AssumeRole`/`GetFederationToken` callers, become principal tags for ABAC. The launch adds `sts:TagSession`, transitive tags, and a limit of 50 tags ([AWS News Blog](https://aws.amazon.com/blogs/aws/new-for-identity-federation-use-employee-attributes-for-access-control-in-aws/), [AWS Security Blog, 2019-11-25](https://aws.amazon.com/blogs/security/rely-employee-attributes-from-corporate-directory-create-fine-grained-permissions-aws/)).

### 2020 to 2023: attribution and workload identity

- 2021-04-13: source identity. `sts:SetSourceIdentity` and the `sts:SourceIdentity`/`aws:SourceIdentity` keys let you require an immutable identity value that persists across role chaining and appears in CloudTrail ([What's New](https://aws.amazon.com/about-aws/whats-new/2021/04/aws-identity-and-access-management-now-makes-it-easier-to-relate-a-users-iam-role-activity-to-their-corporate-identity/), [AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-relate-iam-role-activity-to-corporate-identity/)).
- 2022-07: AWS SDKs and Tools policy: "All new SDK major versions releasing after July 2022 will default to regional" STS endpoints ([SDK reference: STS Regional endpoints](https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html), [AWS Security Blog](https://aws.amazon.com/blogs/security/how-to-use-regional-aws-sts-endpoints/)). Existing major versions, such as boto3 and CLI v1, kept the global default until 2025.
- 2022-07-06: IAM Roles Anywhere lets workloads outside AWS exchange X.509 certificates for role sessions. The service creates sessions by calling STS, and roles trust `rolesanywhere.amazonaws.com` ([What's New](https://aws.amazon.com/about-aws/whats-new/2022/07/aws-identity-access-management-iam-roles-anywhere-workloads-outside-aws/), [AWS Security Blog](https://aws.amazon.com/blogs/security/extend-aws-iam-roles-to-workloads-outside-of-aws-with-iam-roles-anywhere/)).
- 2023 (mid): research shows many roles trusting the GitHub OIDC provider without a `sub` condition, so any repository could assume them ([Datadog Security Labs](https://securitylabs.datadoghq.com/articles/exploring-github-to-aws-keyless-authentication-flaws/)). IAM later began rejecting GitHub OIDC trust policies that lack a meaningful `sub` condition ([IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)); the date that enforcement started is unverified.
- 2023-07-06: AWS starts verifying GitHub's OIDC IdP through its library of trusted root CAs instead of the configured thumbprint ([GitHub Changelog, 2023-07-13](https://github.blog/changelog/2023-07-13-github-actions-oidc-integration-with-aws-no-longer-requires-pinning-of-intermediate-tls-certificates/)). The 2023-07-06 date comes from an AWS notice quoted by secondary sources (unverified against an AWS page).
- 2023-11: Amazon EKS Pod Identity. Pod credentials carry session tags (cluster, namespace, service account) and need no per-cluster OIDC provider ([What's New](https://aws.amazon.com/about-aws/whats-new/2023/11/amazon-eks-pod-identity/), [AWS Containers Blog](https://aws.amazon.com/blogs/containers/amazon-eks-pod-identity-a-new-way-for-applications-on-eks-to-obtain-iam-credentials/)).

### 2024: thumbprints, RCPs, and root sessions

- 2024-07-12: IAM verifies OIDC IdPs by trusting the root CA that anchors the IdP's TLS certificate. Thumbprints are fetched automatically and are used only for uncommon or self-signed CAs ([What's New](https://aws.amazon.com/about-aws/whats-new/2024/07/aws-identity-access-management-open-id-connect-identity-providers)). CloudTrail records the method as `IAMTrustStore` or `Thumbprint` ([IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)).
- 2024-11-13: resource control policies (RCPs) launch with STS among the first five supported services. This enables org-wide guardrails on `sts:AssumeRole*` ([What's New](https://aws.amazon.com/about-aws/whats-new/2024/11/resource-control-policies-restrict-access-aws-resources/), [AWS News Blog](https://aws.amazon.com/blogs/aws/introducing-resource-control-policies-rcps-a-new-authorization-policy/)).
- 2024-11-15: centralized root access management and `sts:AssumeRoot`. The management account or a delegated admin gets a root session in a member account, scoped by one of five task policies, for at most 15 minutes, and only through Regional endpoints ([What's New](https://aws.amazon.com/about-aws/whats-new/2024/11/manage-root-access-aws-identity-access-management/), [AWS News Blog](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/), [API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)).

### 2025: the global endpoint goes local

- 2025-01-27: AWS announces that `sts.amazonaws.com` will be served in the caller's Region, rolling out to default-enabled Regions by mid-2025 and starting with Europe (Stockholm) ([AWS Security Blog](https://aws.amazon.com/blogs/security/announcing-upcoming-changes-to-the-aws-security-token-service-global-endpoint/)).
- 2025-04-18: the change is complete. Global-endpoint requests from default-enabled Regions that resolve through Amazon VPC DNS are served locally. Opt-in Regions and non-Amazon DNS resolvers still route to `us-east-1`. CloudTrail events still land in `us-east-1` with `endpointType` and `awsServingRegion`. `aws:RequestedRegion` stays `us-east-1`. Global-endpoint quotas are separate from Regional ones ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/04/aws-sts-global-endpoint-requests-locally-regions-default/), [IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_region-endpoints.html)).
- 2025-07-31: the SDKs that still defaulted to the global endpoint (Python, PHP, C++, .NET, PowerShell tools, CLI v1) switch their default to Regional. For example, CLI v1 1.42.0 and the PHP SDK 3.351.12 ship the change. A planned retry-strategy change in the same announcement was withdrawn ([AWS Developer Tools Blog](https://aws.amazon.com/blogs/developer/updating-aws-sdk-defaults-aws-sts-service-endpoint-and-retry-strategy/), [aws-cli issue 9634](https://github.com/aws/aws-cli/issues/9634), [aws-sdk-php issue 3159](https://github.com/aws/aws-sdk-php/issues/3159)).
- 2025-11: STS dual-stack (IPv6) endpoints, public and over PrivateLink, in commercial, GovCloud (US), and China Regions ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-sts-ipv6/)).
- 2025-11: IAM outbound identity federation. `sts:GetWebIdentityToken` returns an STS-signed JWT (RS256 or ES384, 60 to 3,600 seconds, default 300) for external services that verify it through OIDC discovery. It is not available on the global endpoint and must be enabled per account ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/), [API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)).
- 2025-11: IAM temporary delegation. Amazon products and onboarded AWS Partners request scoped, time-bound access. After customer approval, the provider redeems a trade-in token with `sts:GetDelegatedAccessToken` (maximum 12 hours). CloudTrail marks the provider's actions with `userIdentity.invokedByDelegate` ([What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/streamline-integration-partner-products-iam-delegation/), [API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html), [IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-temporary-delegation.html), [CloudTrail userIdentity](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html)).

### 2026: claims, sovereignty, and token size

- 2026-02-02: STS validates provider-specific OIDC claims for GitHub, Google, CircleCI, and OCI as condition keys in trust policies and RCPs, for example `token.actions.githubusercontent.com:repository_id`. The What's New URL path is dated 2026/01 ([What's New](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/), [IAM condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)).
- 2026-08: outbound identity federation becomes available in the AWS European Sovereign Cloud Region ([What's New](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-iam-european-sovereign-cloud/)).
- 2026-09: one 4,096-byte session token limit replaces the separate packed-policy and token limits. Responses add `SessionTokenSize` and `SessionTokenUtilization` (`PackedPolicySize` is deprecated). CloudWatch gains `AWS/STS` metrics, and the `MinimumSessionTokenSize` parameter supports testing ([What's New](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/), [AWS Security Blog](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/)).
- 2026-09: interface VPC endpoints for the outbound identity federation OIDC discovery and JWKS endpoints ([What's New](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts-vpc-oidc/)).

## Current API surface (2026-10)

The STS API Reference lists 11 actions: `AssumeRole`, `AssumeRoleWithSAML`, `AssumeRoleWithWebIdentity`, `AssumeRoot`, `DecodeAuthorizationMessage`, `GetAccessKeyInfo`, `GetCallerIdentity`, `GetDelegatedAccessToken`, `GetFederationToken`, `GetSessionToken`, and `GetWebIdentityToken` ([STS API Reference: Actions](https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html)).

## Sources

- [AWS Security Blog: Announcing upcoming changes to the AWS STS global endpoint](https://aws.amazon.com/blogs/security/announcing-upcoming-changes-to-the-aws-security-token-service-global-endpoint/)
- [AWS Security Blog: AWS STS is now available in every AWS Region](https://aws.amazon.com/blogs/security/aws-security-token-service-is-now-available-in-every-aws-region/)
- [Wikipedia: Timeline of Amazon Web Services](https://en.wikipedia.org/wiki/Timeline_of_Amazon_Web_Services)
- [What's New 2012-11-19: Cross-account API access using IAM roles](https://aws.amazon.com/about-aws/whats-new/2012/11/19/Announcing-Cross-Account-API-Access-Using-IAM-Roles/)
- [What's New 2013-05-28: Web identity federation](https://aws.amazon.com/about-aws/whats-new/2013/05/28/announcing-iam-web-identity-federation/)
- [What's New 2013-11-11: SAML 2.0 support](https://aws.amazon.com/about-aws/whats-new/2013/11/11/aws-identity-and-access-management-iam-adds-support-for-saml-security-assertion-markup-language-2-0/)
- [AWS News Blog: AWS IAM using SAML](https://aws.amazon.com/blogs/aws/aws-identity-and-access-management-using-saml/)
- [What's New 2018-03: Longer sessions for IAM roles](https://aws.amazon.com/about-aws/whats-new/2018/03/longer-role-sessions/)
- [AWS Security Blog: Federated API access for up to 12 hours](https://aws.amazon.com/blogs/security/enable-federated-api-access-to-your-aws-resources-for-up-to-12-hours-using-iam-roles/)
- [What's New 2018-07: STS supports AWS PrivateLink in US West (Oregon)](https://aws.amazon.com/about-aws/whats-new/2018/07/aws-sts-support-for-privatelink-us-west-2/)
- [AWS Open Source Blog: Fine-grained IAM roles for service accounts](https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/)
- [AWS News Blog: Session tags for identity federation](https://aws.amazon.com/blogs/aws/new-for-identity-federation-use-employee-attributes-for-access-control-in-aws/)
- [AWS Security Blog: Rely on employee attributes from your corporate directory](https://aws.amazon.com/blogs/security/rely-employee-attributes-from-corporate-directory-create-fine-grained-permissions-aws/)
- [What's New 2021-04: Source identity](https://aws.amazon.com/about-aws/whats-new/2021/04/aws-identity-and-access-management-now-makes-it-easier-to-relate-a-users-iam-role-activity-to-their-corporate-identity/)
- [AWS Security Blog: How to relate IAM role activity to corporate identity](https://aws.amazon.com/blogs/security/how-to-relate-iam-role-activity-to-corporate-identity/)
- [AWS SDKs and Tools Reference: STS Regional endpoints](https://docs.aws.amazon.com/sdkref/latest/guide/feature-sts-regionalized-endpoints.html)
- [AWS Security Blog: How to use Regional AWS STS endpoints](https://aws.amazon.com/blogs/security/how-to-use-regional-aws-sts-endpoints/)
- [What's New 2022-07: IAM Roles Anywhere](https://aws.amazon.com/about-aws/whats-new/2022/07/aws-identity-access-management-iam-roles-anywhere-workloads-outside-aws/)
- [AWS Security Blog: Extend IAM roles to workloads outside AWS](https://aws.amazon.com/blogs/security/extend-aws-iam-roles-to-workloads-outside-of-aws-with-iam-roles-anywhere/)
- [Datadog Security Labs: No keys attached](https://securitylabs.datadoghq.com/articles/exploring-github-to-aws-keyless-authentication-flaws/)
- [IAM User Guide: Create a role for OIDC federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [GitHub Changelog 2023-07-13: OIDC with AWS no longer requires certificate pinning](https://github.blog/changelog/2023-07-13-github-actions-oidc-integration-with-aws-no-longer-requires-pinning-of-intermediate-tls-certificates/)
- [What's New 2023-11: Amazon EKS Pod Identity](https://aws.amazon.com/about-aws/whats-new/2023/11/amazon-eks-pod-identity/)
- [AWS Containers Blog: Amazon EKS Pod Identity](https://aws.amazon.com/blogs/containers/amazon-eks-pod-identity-a-new-way-for-applications-on-eks-to-obtain-iam-credentials/)
- [What's New 2024-07: IAM simplifies management of OIDC IdPs](https://aws.amazon.com/about-aws/whats-new/2024/07/aws-identity-access-management-open-id-connect-identity-providers)
- [What's New 2024-11: Resource control policies](https://aws.amazon.com/about-aws/whats-new/2024/11/resource-control-policies-restrict-access-aws-resources/)
- [AWS News Blog: Introducing RCPs](https://aws.amazon.com/blogs/aws/introducing-resource-control-policies-rcps-a-new-authorization-policy/)
- [What's New 2024-11: Centrally manage root access](https://aws.amazon.com/about-aws/whats-new/2024/11/manage-root-access-aws-identity-access-management/)
- [AWS News Blog: Centrally managing root access](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)
- [What's New 2025-04: STS global endpoint serves requests locally](https://aws.amazon.com/about-aws/whats-new/2025/04/aws-sts-global-endpoint-requests-locally-regions-default/)
- [IAM User Guide: AWS STS Regions and endpoints](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_region-endpoints.html)
- [AWS Developer Tools Blog: Updating AWS SDK defaults](https://aws.amazon.com/blogs/developer/updating-aws-sdk-defaults-aws-sts-service-endpoint-and-retry-strategy/)
- [aws-cli issue 9634: Changes to default STS endpoint resolution](https://github.com/aws/aws-cli/issues/9634)
- [aws-sdk-php issue 3159: Changes to default STS endpoint resolution](https://github.com/aws/aws-sdk-php/issues/3159)
- [What's New 2025-11: STS IPv6](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-sts-ipv6/)
- [What's New 2025-11: IAM outbound identity federation](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-iam-identity-federation-external-services-jwts/)
- [What's New 2025-11: IAM temporary delegation](https://aws.amazon.com/about-aws/whats-new/2025/11/streamline-integration-partner-products-iam-delegation/)
- [IAM User Guide: IAM temporary delegation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-temporary-delegation.html)
- [What's New 2026: STS IdP-specific claims](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/)
- [IAM and AWS STS condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html)
- [What's New 2026-08: Outbound federation in the European Sovereign Cloud](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-iam-european-sovereign-cloud/)
- [What's New 2026-09: STS session token size limits](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts/)
- [AWS Security Blog: AWS STS simplifies session token size limits](https://aws.amazon.com/blogs/security/aws-sts-simplifies-session-token-size-limits-and-adds-session-token-size-monitoring/)
- [What's New 2026-09: VPC endpoints for OIDC discovery](https://aws.amazon.com/about-aws/whats-new/2026/09/aws-sts-vpc-oidc/)
- [STS API Reference: Actions](https://docs.aws.amazon.com/STS/latest/APIReference/API_Operations.html)
- [STS API Reference: AssumeRoot](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoot.html)
- [STS API Reference: GetWebIdentityToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetWebIdentityToken.html)
- [STS API Reference: GetDelegatedAccessToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetDelegatedAccessToken.html)
- [STS API Reference: GetAccessKeyInfo](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)
- [STS API Reference: GetFederationToken](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetFederationToken.html)
- [IAM API Reference: SetSecurityTokenServicePreferences](https://docs.aws.amazon.com/IAM/latest/APIReference/API_SetSecurityTokenServicePreferences.html)
- [IAM User Guide: Logging IAM and AWS STS API calls with CloudTrail](https://docs.aws.amazon.com/IAM/latest/UserGuide/cloudtrail-integration.html)
- [CloudTrail userIdentity element](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html)
