## What

<!-- What changed, why, and which issue/charter/design file owns it. Target base: v-next. -->

## How

<!-- Key implementation or documentation decisions a reviewer needs. -->

## Verification

<!-- Paste commands run and their result. Do not report assumed success. -->

Required local gate:

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm deps`
- [ ] `pnpm typecheck`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:int`
- [ ] `pnpm test:conf`

CI also runs `pnpm pack:dry-run` in the required `check` job. The `smoke` job
runs `pnpm test:smoke` only when gated by push or the `smoke` label.

## Type of change

- [ ] `feat:` new feature or behavior
- [ ] `fix:` bug fix
- [ ] `refactor:` internal restructure, no behavior change
- [ ] `docs:` documentation only
- [ ] `test:` tests only
- [ ] `chore:` build, tooling, or dependency update
- [ ] `perf:` performance improvement
- [ ] `ci:` CI or automation change

## Checklist

- [ ] Base branch is `v-next`.
- [ ] The diff is scoped to one logical change.
- [ ] Relevant design, foundation, or governance docs are updated.
- [ ] No secrets, tokens, or private credentials are printed.
- [ ] No emojis in code, comments, docs, manifests, commits, or PR title.
- [ ] PR title follows conventional commits.
