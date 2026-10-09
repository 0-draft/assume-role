# Research notes

The research behind the site, one topic per file. Every non-obvious claim links to its source inline, each file ends with a Sources section, and anything that could not be confirmed is marked "(unverified)". Facts were checked on 2026-10-10.

| File | Covers |
| --- | --- |
| [01-overview.md](01-overview.md) | STS in one page: what it is, why it feels hard, numbers worth remembering |
| [02-endpoints.md](02-endpoints.md) | Global vs regional endpoints, the 2025 local-serving change, Region activation, v1/v2 tokens, SDK and CLI settings and defaults, FIPS, dual-stack, partitions, PrivateLink, all 34 commercial Regions, pitfalls |
| [03-api-operations.md](03-api-operations.md) | All 11 STS operations: parameters, limits, durations, MFA, returns, errors, CLI examples; permission-only IAM actions; ID prefixes and principal formats |
| [04-sessions-and-policies.md](04-sessions-and-policies.md) | Trust policies, effective permissions, session policies, token size, session tags, source identity, role chaining, ExternalId, MFA, condition keys, revoking sessions |
| [05-credential-paths.md](05-credential-paths.md) | How EC2, Lambda, ECS, EKS, Roles Anywhere, CI/CD OIDC, Identity Center, `aws login`, SAML, brokers, Cognito, AssumeRoot and outbound federation get credentials; SDK provider chains |
| [06-operations-and-security.md](06-operations-and-security.md) | CloudTrail, quotas and throttling, pricing, error catalogue, threats, best practices |
| [07-timeline.md](07-timeline.md) | STS history from 2011 to 2026 |

Where official AWS sources contradict each other (for example the SDK defaults table versus the 2025-07-31 release announcements), the notes say which source was followed and why.
