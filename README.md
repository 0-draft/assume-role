# assume-role

[![ci](https://github.com/0-draft/assume-role/actions/workflows/ci.yml/badge.svg)](https://github.com/0-draft/assume-role/actions/workflows/ci.yml)
[![codeql](https://github.com/0-draft/assume-role/actions/workflows/codeql.yml/badge.svg)](https://github.com/0-draft/assume-role/actions/workflows/codeql.yml)

AWS STS, drawn. An interactive, bilingual (English / 日本語) explainer of the AWS Security Token Service: the global endpoint and every regional, FIPS, dual-stack and PrivateLink hostname, all 11 STS APIs, every path by which a workload or a person ends up holding temporary credentials, and the policies, limits and errors around them.

**Site:** <https://0-draft.github.io/assume-role/> ([日本語](https://0-draft.github.io/assume-role/?lang=ja))

[日本語の README](README.ja.md)

## What is in it

| # | Chapter | Interactive part |
| --- | --- | --- |
| — | Hero | Pick who is asking (developer, CI job, SAML user, EC2, MFA admin, Organizations admin) and STS prints their credential pass, with a live expiry countdown |
| 1 | Why temporary | Long-term vs temporary keys side by side; leak-window slider |
| 2 | Endpoints | Request router: where a call to `sts.amazonaws.com` or a regional hostname is served, logged and throttled, before and after the April 2025 change; hostname builder for every partition and family; SDK default explorer; board of all 34 commercial Regions |
| 3 | Every API | "What are you holding?" picker over all 11 operations, detail passes with CLI examples, duration ruler, comparison matrix, access-key prefix decoder |
| 4 | Credential paths | Step-through sequence diagrams for EC2, Lambda, ECS, IRSA, Pod Identity, Roles Anywhere, GitHub Actions, Identity Center, `aws login`, SAML, Cognito, AssumeRoot, outbound federation; credential provider chain lab |
| 5 | Sessions | Effective-permissions gates, role-chaining builder (1 h cap, transitive tags, source identity), session-token size meter, revoke-sessions timeline |
| 6 | Trust policies | Two-gates lab, GitHub OIDC trust policy evaluator, confused-deputy walkthrough, condition-key catalogue |
| 7 | Logs & limits | Annotated CloudTrail records, 600 RPS quota lab, threat cards and hardening checklist |
| 8 | Errors | Paste an error message and get the cause and the fix |
| 9–10 | Timeline, glossary | STS history 2011–2026, 43 terms in EN/JA |

The research behind every number lives in [`docs/`](docs/README.md), with sources. Facts were checked against AWS documentation, What's New posts, the AWS SDK endpoint data and the GitHub changelog on 2026-10-10. Where AWS sources disagree, the docs say so.

The SigV4 signature itself is drawn step by step in the sibling project [caller-identity](https://github.com/0-draft/caller-identity); this one is about STS.

## Development

Requires Node.js 24.

```bash
npm ci
npm run dev        # http://localhost:5173/assume-role/
npm run check      # typecheck, lint, format, markdownlint, tests, build
npm run test:e2e   # real-browser checks (needs: npx playwright install chromium)
```

The source is organized by feature: `src/features/<chapter>/` holds a chapter, its labs and the pure logic behind them, with Vitest tests next to it. Shared UI lives in `src/components/`, navigation data in `src/data/`, and the language switch in `src/i18n/`.

```text
src/
  app/          App shell
  components/   layout (header, footer) and ui primitives (Section, Figure, Sequence, ...)
  features/     one folder per chapter: Section component, labs, model.ts + tests
  hooks/        media-query and active-section hooks
  i18n/         EN/JA language context
  lib/          small shared helpers
docs/           research notes with sources
e2e/            Playwright layout and axe accessibility checks
```

## CI

| Workflow | What it does |
| --- | --- |
| `ci.yml` | typecheck, ESLint, Prettier, markdownlint, build, Vitest with coverage, Playwright E2E and axe WCAG 2.2 AA checks (desktop and phone, EN and JA, light and dark), actionlint, `npm audit`, dependency review on PRs; then deploys to GitHub Pages when everything on `main` is green |
| `codeql.yml` | CodeQL for JavaScript/TypeScript and GitHub Actions |
| `freshness.yml` | Opens a monthly issue to re-verify endpoint behaviour, SDK defaults, APIs, quotas and the timeline |
| `claude-review.yml` | Claude reviews each pull request for factual accuracy and EN/JA parity; it comments, it does not gate |
| Dependabot | Weekly grouped updates for npm and GitHub Actions |

## Disclaimer

An independent explainer, not affiliated with or endorsed by Amazon Web Services. All account IDs, keys and tokens shown are fake. AWS changes STS behaviour from time to time; check the linked AWS documentation before you rely on a detail.
