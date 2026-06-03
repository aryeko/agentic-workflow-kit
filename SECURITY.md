# Security Policy

## Supported versions

agentic-workflow-kit is pre-1.0. Security fixes land on the latest `0.x` release.

| Version | Supported |
| --- | --- |
| 0.1.x | yes |
| < 0.1 | no |

## Reporting a vulnerability

Please report security issues **privately** through GitHub's private advisory flow:

- Repository **Security** tab -> **Advisories** -> **Report a vulnerability**
- Direct link: https://github.com/aryeko/agentic-workflow-kit/security/advisories/new

Do **not** open a public issue, pull request, or discussion for a security report.

When reporting, please include where you can:

- the affected version, tag, or commit,
- reproduction steps or a proof of concept,
- the impact you believe it has, and
- any suggested remediation.

We aim to acknowledge a report within 5 business days and to share a remediation timeline
after triage. Coordinated disclosure is appreciated: please give us a reasonable window to
ship a fix before any public write-up.

## Scope

In scope:

- the plugin skills under `skills/`,
- the `@agentic-workflow-kit/orchestrator` package,
- the config and tracker contracts under `references/`.

Out of scope:

- vulnerabilities in third-party dependencies (please report those upstream; we will bump
  affected versions),
- issues that require an already-compromised local environment or malicious repository
  content that the operator already controls.
