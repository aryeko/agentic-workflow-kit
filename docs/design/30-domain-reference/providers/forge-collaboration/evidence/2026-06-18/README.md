---
title: "Forge / Collaboration evidence -- 2026-06-18"
status: draft
last-reviewed: "2026-06-18"
---

# Forge / Collaboration evidence -- 2026-06-18

This appendix records the inputs and provider probes used for
`docs/kit-vnext/domains/prov-02-forge-collaboration/design.md`.

## Source discipline

Allowed kit-vnext inputs:

```text
2709a5bfc7d200c71f2236f0699569f493430a7d611692dee392b19c10cbd207  docs/kit-vnext/README.md
bfa95aec3576c11e39cf26abd089cf31cecd757b03c22a3269b96cd728292a43  docs/kit-vnext/architecture.md
a5c2626a8cd903109878b3fab53a37b3e45fb7815667ac874b34bfa32fcf1a9b  docs/kit-vnext/conventions.md
65455e840605002ddd592bc2e9eab5a5582c92678b2a4d973981b1e9ae1b7f0b  docs/kit-vnext/glossary.md
fee01aba3289553b2e696def44247241ee7818f046636ae0a48265572d43367a  docs/kit-vnext/requirements.md
dd18dbd421a294b7c45d6d3353cc2289be26829cf764679bd35f5dbcc355035c  docs/kit-vnext/decisions.md
ea1ea3b6f1eadee006cb8a0a41713e6f4d7ee9700fe4ea1e77b10d643178e452  docs/kit-vnext/_templates/domain-design-template.md
4cb4b426e1013d8519b575bf9a801d3831f21360741d9c7b3a063eda9fff3274  docs/kit-vnext/domains/prov-02-forge-collaboration/charter.md
3d0ce3e73d3ab643f0a666378c3a7c5468db2113b77b9dab1c51ef9cc8678b7b  docs/kit-vnext/domains/fnd-04-credentials-and-secrets/charter.md
a92e1e59f889bf06f184046915f113a60cdea5f975c53583da0e5381abf506c4  docs/kit-vnext/domains/fnd-04-credentials-and-secrets/design.md
d8660c1c20a92a64d47def1648c7bb5e6567216df29260b9c86b5da3ef6a18ca  docs/kit-vnext/domains/fnd-04-credentials-and-secrets/design/contracts-and-events.md
```

Command:

```bash
shasum -a 256 docs/kit-vnext/README.md docs/kit-vnext/architecture.md docs/kit-vnext/conventions.md docs/kit-vnext/glossary.md docs/kit-vnext/requirements.md docs/kit-vnext/decisions.md docs/kit-vnext/_templates/domain-design-template.md docs/kit-vnext/domains/prov-02-forge-collaboration/charter.md docs/kit-vnext/domains/fnd-04-credentials-and-secrets/charter.md docs/kit-vnext/domains/fnd-04-credentials-and-secrets/design.md docs/kit-vnext/domains/fnd-04-credentials-and-secrets/design/contracts-and-events.md
```

## GitHub GraphQL schema probes

The probes intentionally capture schema shape only: type names, field names, argument names, input
field names, enum values, and type wrappers. Prose descriptions are omitted.

Command used for each type in the list below:

```bash
gh api graphql -F name="$type" -f query='query TypeProbe($name: String!) { __type(name: $name) { name kind fields(includeDeprecated: true) { name args { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } isDeprecated } inputFields { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } defaultValue } enumValues { name isDeprecated } } }' | jq -S . > "docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/github-graphql-${type}.json"
```

Types probed:

```text
PullRequest
PullRequestReviewThread
StatusCheckRollup
BranchProtectionRule
Repository
RepositoryRuleset
MergeQueueEntry
CreatePullRequestInput
UpdatePullRequestBranchInput
MergePullRequestInput
EnqueuePullRequestInput
ResolveReviewThreadInput
UnresolveReviewThreadInput
AddCommentInput
UpdateIssueCommentInput
```

Selected mutation command:

```bash
gh api graphql -f query='query MutationProbe { __type(name: "Mutation") { name kind fields(includeDeprecated: true) { name args { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } isDeprecated } } }' | jq -S '{data:{__type:{name:.data.__type.name,kind:.data.__type.kind,fields:(.data.__type.fields | map(select(.name as $name | ["addComment","updateIssueComment","createPullRequest","updatePullRequestBranch","mergePullRequest","enqueuePullRequest","resolveReviewThread","unresolveReviewThread"] | index($name))))}}}' > docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/github-graphql-Mutation-selected.json
```

Observed shape used by the design:

```text
PullRequest includes baseRefOid, headRefOid, state, reviewDecision, reviewThreads,
statusCheckRollup, mergeStateStatus, isInMergeQueue, mergeQueueEntry, commits, timelineItems.
Repository includes branchProtectionRules, defaultBranchRef, mergeQueue, pullRequest, ref, rulesets.
BranchProtectionRule includes pattern, requiredStatusCheckContexts, requiresApprovingReviews,
requiresStatusChecks, requiresStrictStatusChecks, matchingRefs, requiresCommitSignatures,
allowsForcePushes, allowsDeletions, blocksCreations.
RepositoryRuleset includes bypassActors, conditions, enforcement, id, name, rules, source, target.
PullRequestReviewThread includes isResolved, viewerCanResolve, viewerCanUnresolve, comments, path.
StatusCheckRollup includes commit, contexts, id, state.
MergeQueueEntry includes baseCommit, headCommit, position, pullRequest, state.
MergePullRequestInput, EnqueuePullRequestInput, and UpdatePullRequestBranchInput include expectedHeadOid.
CreatePullRequestInput includes repositoryId, baseRefName, headRefName, title, body, draft.
AddCommentInput includes subjectId and body; UpdateIssueCommentInput includes id and body.
Selected mutations include addComment, updateIssueComment, createPullRequest, updatePullRequestBranch,
mergePullRequest, enqueuePullRequest, resolveReviewThread, and unresolveReviewThread.
```

Snapshot hashes:

```text
0e782f1c3709f5783eabd7407363168bc974a9560db511b7ed7184aea477eac3  github-graphql-AddCommentInput.json
02c83f09f90530c9a2bca95a2beab3c5ca85623bf68ef69782375eb07685e7bd  github-graphql-BranchProtectionRule.json
7add7f1d7b03ce701df8452c240b1d2b2fcf55c83660daa0b30f5d12c8b95774  github-graphql-CreatePullRequestInput.json
0ce7ca9f2ec596ded7fb6a374089a52383c6511261d050df63e3029d060fd01a  github-graphql-EnqueuePullRequestInput.json
c1a2b5ec618109c0c834f4aede5a6426c33f2c6dd245851cd6bd8246ab9ee6ab  github-graphql-MergePullRequestInput.json
85c3c36995f985cae65a66d367b3e45f726478f9f49125511053613c1733e40e  github-graphql-MergeQueueEntry.json
bc298cab0cb700dc38dcc5493778ee78414e2807eba91f87e26bdb3d8f477324  github-graphql-Mutation-selected.json
06071684105b0ef078ee5b1f50243e2881d75b40b815ad41f5978ac24868d57a  github-graphql-PullRequest.json
0d1152650fcdeb77b39f51b39065a3e8d31f18cbb37caf9529656bb7cdb3054e  github-graphql-PullRequestReviewThread.json
4ac9bba05d12eaa3b42781c948593a6ea83693284822c8cfa5656b36405e1628  github-graphql-Repository.json
3bfee9193ff6853da669172f698476a4db9a01d734f56c7e4cd751b93aa3e0ab  github-graphql-RepositoryRuleset.json
880d9f808c0e643147f8c5a249cadaf1a687a1ee141958453b1cc7afec41e558  github-graphql-ResolveReviewThreadInput.json
1708e39c0f49d7d59b42c0899fee6cfe5b0e25f5b9bfbc41b852f52e6b0ff376  github-graphql-StatusCheckRollup.json
33b020f3de19ec611395eb6f664af2410547152ad05270b79f40c7d0606d57bb  github-graphql-UnresolveReviewThreadInput.json
5c60de6b5b6e335c86dc2dabb5f2eb280ec2c9e2658d2f8cd553dc559b74f763  github-graphql-UpdateIssueCommentInput.json
41a1759fa64e17f261c15c7308b83780a0019d9696b35461ac1883177483e56b  github-graphql-UpdatePullRequestBranchInput.json
```

## Mock Forge conformance probes

Mock snapshot:

```text
mock-forge-conformance.json
```

Command:

```bash
{ jq -e '(.driver == "mock-forge") and (.capabilities | length == 4) and (.operations | length == 7) and (.adversarialCases | length >= 8) and ([.operations[].credentialPhase] | all(. == "push" or . == "PR create/update" or . == "evidence refresh, review metadata" or . == "merge"))' docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/mock-forge-conformance.json | sed 's/^/schema-ok=/'; jq -r '"capabilities=\(.capabilities | length)", "operations=\(.operations | length)", "adversarialCases=\(.adversarialCases | length)", "credentialPhases=\([.operations[].credentialPhase] | unique | join("|"))", "exactHeadOps=\([.operations[] | select(.headBinding == "expectedHeadSha") | .name] | join("|"))", "degradedStates=\([.adversarialCases[].expected] | unique | join("|"))"' docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/mock-forge-conformance.json; } > docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/mock-forge-conformance-output.txt
```

Observed output:

```text
schema-ok=true
capabilities=4
operations=7
adversarialCases=9
credentialPhases=PR create/update|evidence refresh, review metadata|merge|push
exactHeadOps=collectEvidence|updateBranch|enqueue|merge
degradedStates=forge-admin-bypass-refused|forge-auth-denied|forge-credential-unavailable|forge-head-mismatch|forge-merge-queue-unavailable|forge-review-threads-uninspectable|forge-rulesets-unattested|forge-state-unknown
```

Mock hashes:

```text
753de6a750c337b6d62bf79bcd245577c1917c488001920237c2e7749724394f  mock-forge-conformance.json
81766326603cc393919527a16c3156049cf647eb3a9f502dea75b423f48ef75a  mock-forge-conformance-output.txt
```

## Local verification

Commands:

```bash
wc -l docs/kit-vnext/domains/prov-02-forge-collaboration/design.md docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/README.md
rg -n '^## [0-9]+\.' docs/kit-vnext/domains/prov-02-forge-collaboration/design.md
git diff --check -- docs/kit-vnext/domains/prov-02-forge-collaboration/design.md docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18
shasum -a 256 docs/kit-vnext/domains/prov-02-forge-collaboration/design.md docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/README.md docs/kit-vnext/domains/prov-02-forge-collaboration/evidence/2026-06-18/github-graphql-*.json
```

Observed output:

```text
design.md: 199 lines after review-round-1 fixes.
Required headings present in order: sections 1 through 11.
git diff --check: no output.
design.md sha256: c41524261e759db0f8c477d771ce24bda4d113bf294c1f561ce90049c51813fe.
```

## Limits and risks

These probes validate schema shape for the design. They do not execute side-effectful GitHub writes.
Push, PR create/update, comment publish, update-branch, enqueue, merge, and review-thread resolution
must be exercised by the driver conformance suite against a disposable writable remote before
implementation approval.
