# R4 - Sandbox, Dependency Install, and Supply Chain

## Executive Recommendation

Adopt a brokered dependency-provisioning policy: default children run in workspace-write with no ambient
secrets and no arbitrary network, while the approval relay auto-grants only lockfile-bound package-manager
traffic to declared registry hosts. Lifecycle scripts, Git dependencies, remote tarballs, private-package
credentials, lockfile mutation, and arbitrary egress are separate audited escalations. Confidence: high for
Node/pnpm/npm projects, medium for ecosystem-general defaults until the same controls are mapped for other
package managers.

## Sources Checked

- Local charter: `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18, required report
  format and R4 lane scope.
- Local context: `docs/autopilot-durability/README.md`, checked 2026-06-18, incident themes A, B, and C.
- Local draft design: `docs/autopilot-durability/design/01-execution-substrate-and-provisioning.md`,
  checked 2026-06-18, existing D1 policy proposal for scoped dependency-install grants.
- pnpm install docs, https://pnpm.io/cli/install, 11.x docs checked 2026-06-18, frozen lockfile, offline,
  lockfile-only, integrity, and ignore-scripts behavior.
- pnpm fetch docs, https://pnpm.io/cli/fetch, 11.x docs checked 2026-06-18, lockfile-only store hydration
  and offline install pattern.
- pnpm supply-chain security docs, https://pnpm.io/supply-chain-security, 11.x docs checked 2026-06-18,
  postinstall blocking, exotic dependency blocking, and minimum release age guidance.
- pnpm approve-builds docs, https://pnpm.io/cli/approve-builds, 11.x docs checked 2026-06-18, approved and
  denied dependency build-script policy.
- pnpm settings docs, https://pnpm.io/settings, 11.x docs checked 2026-06-18, shared store trust boundary,
  store integrity, side effects cache, and dependency-run checks.
- npm ci docs, https://docs.npmjs.com/cli/v11/commands/npm-ci/, npm 11.16.0 docs checked 2026-06-18,
  clean install, ignore-scripts, allow-git, allow-remote, allow-scripts, and strict-allow-scripts.
- npm approve-scripts docs, https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts/, npm 11.16.0 docs
  checked 2026-06-18, project-level install-script allowlist.
- GitHub changelog for npm v12, https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/,
  published 2026-06-09, checked 2026-06-18, upcoming defaults for scripts, Git dependencies, and remote URLs.
- npm provenance docs, https://docs.npmjs.com/viewing-package-provenance/, checked 2026-06-18, provenance
  and registry signature verification.
- GitHub personal access token docs,
  https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens,
  checked 2026-06-18, fine-grained PAT limits and least-privilege token guidance.
- GitHub App installation token docs,
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app,
  checked 2026-06-18, one-hour installation token and repository/permission narrowing.
- GitHub App authentication docs,
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation,
  checked 2026-06-18, installation tokens for HTTP Git access.
- GitHub Actions secure use reference, https://docs.github.com/en/actions/reference/security/secure-use,
  checked 2026-06-18, least-privilege token and secret handling guidance.
- SLSA build requirements v1.2, https://slsa.dev/spec/v1.2/build-requirements, checked 2026-06-18,
  isolation and control-plane secret separation principles.
- OpenSSF S2C2F repository, https://github.com/ossf/s2c2f, checked 2026-06-18, secure dependency consumption
  framework context.

## Findings

Facts from sources:

- `pnpm install --frozen-lockfile` fails rather than updating the lockfile when the lockfile is missing,
  out of sync, or needs an update. In CI, frozen lockfile is the default when a lockfile is present.
- `pnpm install --offline` uses only packages already available in the store and fails on a cache miss.
  `--prefer-offline` can still contact the server for missing data.
- `pnpm fetch` can populate the virtual store from `pnpm-lock.yaml` and `pnpm-workspace.yaml`, then
  `pnpm install --offline` can install without registry communication when the store is complete.
- pnpm 11 hard-fails tarball integrity mismatch by default unless `--update-checksums` is explicitly used.
- pnpm v10+ blocks dependency postinstall/build scripts by default unless trusted packages are listed in
  `allowBuilds`; `pnpm approve-builds` writes allow/deny entries.
- pnpm documents compromised packages commonly using `postinstall`, recommends explicit trusted build lists,
  supports `blockExoticSubdeps: true` to prevent transitive Git/direct-tarball sources, and defaults
  `minimumReleaseAge` to one day in pnpm v11.
- pnpm's shared store is inside the trust boundary. The docs warn that a shared store should be protected
  from untrusted writers; integrity checking does not make an attacker-writable store safe.
- npm 11.16.0 has `allowScripts` and `strict-allow-scripts`; `npm approve-scripts --allow-scripts-pending`
  can inventory unreviewed install scripts without modifying files, and approvals are pinned by default.
- npm v12 is scheduled to make install-time scripts opt-in, and to default Git dependencies and remote URL
  tarballs to opt-in via `--allow-git` and `--allow-remote`.
- `npm ci` plus a committed lockfile is the npm equivalent of a reproducible clean install; `--ignore-scripts`
  blocks lifecycle scripts, while explicit script commands like `npm test` still run their main script.
- npm provenance can verify where/how a package was published and `npm audit signatures` checks registry
  signatures and provenance attestations when present, but this is an audit signal rather than a sandbox.
- GitHub recommends fine-grained PATs over classic PATs where possible because they can be scoped to one
  owner, selected repositories, and selected permissions. It also documents limitations: fine-grained PATs
  do not cover all scenarios, including GitHub Packages and Checks API use.
- GitHub App installation tokens can be scoped to selected repositories and permissions and expire after
  one hour. They can also authenticate HTTPS Git access when the app has Contents permission.
- GitHub secure-use guidance recommends minimum required token permissions and read-only repository contents
  as a good default, with job-level escalation only when required. It also warns that automatic secret
  redaction is not guaranteed and secrets should not be treated as safe around arbitrary code.
- SLSA's build model separates a trusted control plane from user-defined build steps and says build-service
  secret material must not be accessible to those user steps. This maps directly to an autopilot parent/child
  split: the runner may hold broker credentials, but the child should not receive ambient secrets.

Interpretation for workflow-kit:

- "Network for install" is too broad. The safe unit is "this package manager command may fetch from these
  registry origins while honoring the committed lockfile." Host-level allow alone is not enough because a
  lifecycle script can use the same network grant for arbitrary egress if the sandbox allows it.
- Lifecycle/build scripts are arbitrary code execution and should not be covered by the default registry
  fetch grant. They need a separate allowlist, a separate approval request, and ideally a different network
  posture.
- A shared package-manager store improves speed but expands the trust boundary. A writable global store shared
  by unrelated agent runs is not safe for untrusted children. A prehydrated read-only store, or a per-run store
  hydrated by a trusted parent/broker, is safer.
- GitHub access needs to be phase-specific. Read-only clone/fetch, PR creation, push, comment/review, package
  registry read, and merge are different permissions and should not be collapsed into one ambient token.

## Options

### Option A - Blanket child network/full-access sandbox

The child gets broad network or `danger-full-access` and uses the user's normal credentials and caches.

Enables: maximum compatibility with arbitrary setup scripts, private registries, Git dependencies, browser
binary downloads, and one-off build systems.

Cannot do safely: prevent dependency install scripts from exfiltrating credentials, enforce registry-only
traffic, keep package-manager caches trustworthy, or explain what was actually granted. This reproduces the
June 2026 failure mode in reverse: setup succeeds, but autonomy is earned by removing the safety boundary.

### Option B - Brokered online install with scoped registry egress

The child starts with no network and no secrets. A deterministic policy auto-approves only declared package
manager commands, only with frozen/clean-install semantics, only to declared registry hosts, and only when
the command does not mutate dependency manifests or lockfiles. Install scripts, Git dependencies, remote
tarballs, private auth, and registry changes each request additional approval.

Enables: standard dependency setup in fresh worktrees, auditable grants, low-friction public registry installs,
and fail-closed behavior for off-policy network use.

Cannot do alone: protect against malicious code in lifecycle scripts if those scripts are allowed with broad
network/secrets, satisfy private package installs without a credential broker, or avoid all network flakiness.

### Option C - Parent/broker hydrates a read-only package store, child installs offline

The trusted runner hydrates a package-manager store from the committed lockfile using scoped registry egress,
then launches the child with the store mounted/readable and package-manager install forced offline. The child
may link packages into its worktree but cannot fetch new packages.

Enables: strongest egress reduction for standard installs, reusable cache performance, no child registry
network during install, and clearer provenance of downloaded bytes.

Cannot do: handle missing cache entries without a preflight hydration step, handle lockfile changes without
returning to the broker, or run install scripts safely unless those scripts are separately approved and
isolated. pnpm 11.5.1 does not yet have the documented 11.7 `frozenStore` read-only mode, so a true read-only
store may need a version gate or per-run store fallback.

### Option D - Remote CI/container dependency worker

The kit delegates dependency setup and verification to a controlled CI/container environment with network
policy, short-lived credentials, and clean machines.

Enables: stronger OS-level isolation, mature secret handling, easier audit trails, and parity with final CI.

Cannot do: keep local child work fully self-contained, work offline, avoid CI latency/cost, or support repos
without a configured remote worker. It is a good high-assurance mode, not the default local autopilot path.

## Recommendation

Use Option B as the default vNext behavior, with Option C as a preferred optimization/capability when the
package manager and host can support it.

Recommended default grants:

- Sandbox: workspace-write, no ambient network, no access to host SSH agent, no access to user-level package
  manager auth files unless explicitly brokered, no writes outside the worktree except an explicitly assigned
  per-run cache/store path.
- Public registry install: auto-grant as low risk only when all are true:
  - package manager is declared or detected from a committed lockfile and `packageManager`;
  - command is the repo's declared setup/install command or a known clean install form such as
    `pnpm install --frozen-lockfile`, `pnpm install --offline`, or `npm ci`;
  - lockfile exists and the command is not allowed to rewrite manifests or lockfiles;
  - allowed egress is HTTPS only to configured registry hosts and required CDN hosts declared by policy;
  - no credentials are injected unless the registry is private and separately approved;
  - install-script policy is enforced separately.
- pnpm-specific defaults:
  - preserve `--frozen-lockfile` for online install and use `--offline` after successful store hydration;
  - require `allowBuilds` entries for packages that need dependency build scripts;
  - keep `blockExoticSubdeps: true` and `minimumReleaseAge` unless the repo explicitly opts out;
  - do not use `--update-checksums` automatically;
  - do not share a writable global store between untrusted runs. Prefer a trusted prehydrated store copied or
    mounted read-only when supported; otherwise use a per-run store directory.
- npm-specific defaults:
  - use `npm ci`, not `npm install`, for standard setup with an existing lockfile;
  - run with `--ignore-scripts` or enforce project `allowScripts`/`strict-allow-scripts` where npm version
    supports it;
  - set `--allow-git=none` and `--allow-remote=none` for standard installs, matching the upcoming npm v12
    security direction;
  - require explicit approval for `--allow-git`, `--allow-remote`, `--allow-directory`, `--allow-file`, and
    `--dangerously-allow-all-scripts`.
- Lifecycle/build scripts: medium risk by default. Allow only when the package is pinned/approved by repo
  policy (`allowBuilds` or `allowScripts`) or when a human approves the exact package/version/script class.
  Run script-bearing install steps with the same no-secret environment and registry-only network unless the
  package has a documented external download host that is also approved.
- GitHub access:
  - for public clone/fetch, allow unauthenticated HTTPS to `github.com` only when a lockfile or package spec
    explicitly names a Git dependency and Git dependencies are policy-approved;
  - for private repo/package access, prefer a GitHub App installation token scoped to selected repositories
    and minimum permissions, minted by the trusted parent and exposed only for the specific command;
  - use fine-grained PATs only as a user-provided fallback and record their limitations; avoid classic PATs
    except for a documented unsupported-GitHub-feature escape hatch;
  - do not pass broad `GH_TOKEN`, `GITHUB_TOKEN`, SSH agent sockets, npm publish tokens, cloud credentials, or
    signing keys into dependency installation.
- Arbitrary egress: deny by default. Undeclared hosts, plain HTTP registries, proxy configuration changes,
  `strict-ssl=false`, curl/wget from setup scripts, browser/runtime binary downloads, telemetry endpoints,
  and DNS wildcard patterns require explicit approval with host, protocol, command, reason, duration, and
  whether secrets will be visible.
- Audit: every grant records package manager, command, cwd, lockfile digest before/after, store path,
  allowed hosts, credential alias if any, script policy result, and denied requests. Do not log secret values.

Escalation boundaries:

- Low, policy auto-grant: lockfile-bound public registry fetch to declared hosts; offline install from a
  prehydrated trusted store; read-only package metadata/audit requests to declared registries.
- Medium, assisted or human depending on repo policy: approved lifecycle scripts; private registry read token;
  GitHub App token for selected repo read/push/PR creation; browser binary download host for a known package;
  lockfile-only regeneration in a dependency-maintenance story.
- High, human only: `danger-full-access`; writes outside worktree/per-run cache; broad or classic PATs;
  SSH agent forwarding; publish/delete/admin/package-write tokens; arbitrary egress; disabling TLS checks;
  `--update-checksums`; `--dangerously-allow-all-scripts`; package manager config changes that add registries,
  proxies, Git URL rewrites, or token-bearing `.npmrc` content.

## Tradeoffs and Risks

- Compatibility: some repos rely on install scripts, Git dependencies, direct tarballs, Playwright/Cypress
  binary downloads, native module builds, private registries, or custom setup scripts. The default policy will
  park those runs unless repo policy declares the needed grants.
- Ecosystem variance: this report is strongest for pnpm/npm. Other ecosystems need equivalent controls:
  lockfile semantics, script/hook behavior, registry config, cache trust, and credential format.
- Cache complexity: per-run stores are safer but slower. Shared stores are faster but require a trusted-writer
  boundary, filesystem permissions, and integrity checks.
- Host allowlists are necessary but insufficient. Without process-level egress enforcement, a script can use
  an approved network session for unintended traffic. The relay needs real network enforcement, not prompt text.
- Credentials are hard to partially expose. Many CLIs read ambient env vars and home-directory config. The
  child environment must be constructed from an allowlist instead of inheriting the parent environment.
- Lockfile freshness can conflict with security. Frozen installs keep the child from changing dependency
  resolution, but legitimate dependency-update stories need a separate "lockfile mutation" lane.
- Provenance/audit signals are useful but not comprehensive. Missing provenance does not always mean malicious,
  and present provenance does not make arbitrary install code safe.
- User experience: fail-closed setup will interrupt more runs at first. The fix is a clear policy file and
  durable `awaiting-approval`, not weakening the default.

## Fallback and Degraded Modes

- If host-level network grants are unsupported, do not run the child with blanket network. Park with a
  recoverable request that lists the required hosts and command.
- If no lockfile exists, do not auto-grant install. Treat initial dependency resolution as medium risk for
  application repos and high risk for arbitrary codebases unless a story explicitly covers dependency setup.
- If a prehydrated/offline store is incomplete, fall back to brokered online install with registry allowlist,
  or park if online grants are unavailable.
- If pnpm/npm script policy features are unavailable, use `--ignore-scripts` for the default install and park
  on packages that need build scripts. Do not silently run all scripts.
- If private registry or GitHub credentials are absent, park in `awaiting-approval` with the exact registry,
  scope, and minimum token permission required. Do not ask the child to discover or read user secrets.
- If a setup command needs arbitrary external downloads, split the setup: lockfile-bound dependency install
  can proceed; the external download request parks separately with host and reason.
- If package-manager version capability probing fails, use the conservative profile: frozen/clean install,
  `ignore-scripts`, no Git/direct URL dependencies, no cache writes outside the run, no secrets.
- If the repo opts into a remote CI/container worker, mark local install autonomy degraded and move install
  verification to the remote worker's evidence rather than the child prose.

## Validation Spikes

- Build a fake pnpm repo with committed `pnpm-lock.yaml`, `allowBuilds`, and one dependency requiring a build.
  Verify standard install auto-grants only registry traffic, while the build script request is separate.
- Build a fake npm repo on npm 11.16.0+ with `allowScripts` and `strict-allow-scripts`; confirm unreviewed
  scripts hard-fail and approved pinned packages run.
- Run a pnpm `fetch` plus offline child install spike with a per-run store. Prove the child cannot reach the
  registry and that cache misses fail cleanly.
- Attempt a malicious dependency postinstall that reads `GH_TOKEN`, `SSH_AUTH_SOCK`, `.npmrc`, and cloud env
  vars. Verify none are present in the child environment and no secret appears in logs.
- Attempt egress from install scripts to undeclared hosts while registry access is approved. Prove enforcement
  denies the undeclared host and records the denial.
- Test private GitHub dependency access with a one-hour GitHub App installation token scoped to a selected
  repository. Confirm the token is available only for that command and is not inherited by subsequent tests.
- Test shared-store tampering: one untrusted process mutates store content or metadata, then another install
  links from the store. Use the result to decide whether shared writable stores are forbidden or need stronger
  isolation.
- Probe package-manager versions used by workflow-kit consumers and map which controls are available:
  pnpm `allowBuilds`, `blockExoticSubdeps`, `minimumReleaseAge`, `frozenStore`; npm `allowScripts`,
  `strict-allow-scripts`, `allow-git`, `allow-remote`.
- Add an evidence fixture for a denied `--update-checksums` attempt to make sure integrity bypasses are
  high-risk and human-only.

## Open Questions

- Should workflow-kit define a package-manager policy schema now, or start with built-in Node/pnpm/npm policy
  plus an escape hatch for repo-declared setup commands?
- What mechanism will enforce per-host egress for local child processes on macOS/Linux without depending on
  prompt compliance?
- Should the trusted parent hydrate package stores itself, or should it launch a separate unprivileged
  "dependency broker" process with only registry egress?
- How should repo policy express external binary hosts for packages like Playwright, Cypress, Puppeteer, and
  Electron without allowing arbitrary downloads?
- Can workflow-kit require GitHub App installation tokens for autonomous PR operations, or must PAT fallback
  remain a first-class path for individual-user repos?
- Should dependency-update stories get a distinct grant profile that allows lockfile mutation but still
  blocks lifecycle scripts and arbitrary egress by default?
- How should non-JavaScript ecosystems be represented: one common policy model with ecosystem adapters, or
  separate policy sections per package manager?
