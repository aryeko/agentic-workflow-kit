# Security Policy

## Supported versions

kit-vnext v1.0.0 is being rebuilt on `v-next`. Security fixes for the rebuild
land on `v-next` until the release line is cut. `main` is frozen legacy v0.7.0
and is not the active development line.

| Line | Supported |
| --- | --- |
| `v-next` / kit-vnext v1.0.0 rebuild | yes |
| frozen legacy `main` | no active development |

## Reporting a vulnerability

Please report security issues privately through GitHub's private advisory flow:

- Repository **Security** tab -> **Advisories** -> **Report a vulnerability**
- Direct link: https://github.com/aryeko/agentic-workflow-kit/security/advisories/new

Do not open a public issue, pull request, or discussion for a security report.

When reporting, include what you can:

- the affected branch, tag, commit, or package,
- reproduction steps or a proof of concept,
- the impact you believe it has, and
- any suggested remediation.

We aim to acknowledge a report within 5 business days and to share a
remediation timeline after triage. Coordinated disclosure is appreciated; please
give us a reasonable window to ship a fix before any public write-up.

## Scope

In scope:

- kit-vnext control-plane code and packages as they are added under
  `packages/`,
- foundation tooling, tests, and CI,
- design and governance docs that define security-relevant behavior,
- credential handling, provider seams, capability attestation, event logging,
  recovery, and merge/approval gates.

Out of scope:

- vulnerabilities in third-party dependencies, which should also be reported
  upstream,
- issues that require an already-compromised local machine,
- malicious repository content already controlled by the operator unless it
  bypasses a documented kit-vnext boundary or safety gate.
