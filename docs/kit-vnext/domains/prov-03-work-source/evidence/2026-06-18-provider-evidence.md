---
title: "Work Source provider evidence - 2026-06-18"
domain: "prov-03-work-source"
date: "2026-06-18"
---
# Work Source provider evidence - 2026-06-18

This appendix records local provider evidence for the Work Source contract. Inputs were limited to
the allowed kit-vnext files plus same-domain outputs under
`docs/kit-vnext/domains/prov-03-work-source/`. No legacy docs, external provider research, network
calls, or code edits were used.

## Evidence files

- `2026-06-18-markdown-source-fixture.md`: Markdown Work Source fixture with one Track and two Tasks.
- `2026-06-18-mock-source-fixture.json`: mock Work Source fixture with the same backlog shape and
  scripted failure cases.

## File hashes

Command:

```bash
shasum -a 256 docs/kit-vnext/domains/prov-03-work-source/design.md \
  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-markdown-source-fixture.md \
  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-mock-source-fixture.json
```

Output:

```text
fc8afc301a101d111896ad246de7b985c0aadc42227e0ef8954a48b7c00dcb95  docs/kit-vnext/domains/prov-03-work-source/design.md
278d0d7c2324152238d351d414c79132220a5fc544b5e278e8540292a38ce04a  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-markdown-source-fixture.md
5fa87f718c3753cf9c964734e6f9cefdb94840255e0b75abe5612c8a5da679f7  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-mock-source-fixture.json
```

## Document shape checks

Command:

```bash
wc -l docs/kit-vnext/domains/prov-03-work-source/design.md \
  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-provider-evidence.md \
  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-markdown-source-fixture.md \
  docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-mock-source-fixture.json
```

Output:

```text
     200 docs/kit-vnext/domains/prov-03-work-source/design.md
     149 docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-provider-evidence.md
      89 docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-markdown-source-fixture.md
      48 docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-mock-source-fixture.json
     486 total
```

Command:

```bash
rg -n 'statusBuckets|status-bucket-unknown|Provider contract validated|fixture evidence only|NFR-TEST|```mermaid' \
  docs/kit-vnext/domains/prov-03-work-source/design.md
```

Output hash:

```text
e93132473f478bd2a9a2b7d645fba1aa935e500f96c0fff214a2ffaf220e850e  -
```

## Markdown driver probe

Command:

```bash
awk '
  /^```kit-work-source/ { sourceBlocks++ }
  /^  eligible: \[ready\]/ { eligibleMap++ }
  /^  inProgress: \[claimed\]/ { inProgressMap++ }
  /^  complete: \[done\]/ { completeMap++ }
  /^  blocked: \[blocked\]/ { blockedMap++ }
  /^## Task / { tasks++ }
  /^```kit-task/ { blocks++ }
  /^id:/ { ids++ }
  /^track:/ { tracks++ }
  /^status:/ { statuses++; if ($2 == "mystery") unknownStatuses++ }
  /^target:/ { targets++ }
  /^specRefs:/ { specRefs++ }
  /^dependencies:/ { deps++ }
  /taskId: WS-3/ { dependsOnUnknown++ }
  /^claim:/ { claims++ }
  /^  runId:/ { claimRunIds++ }
  END {
    printf("markdown_probe sourceBlocks=%d maps=%d/%d/%d/%d tasks=%d blocks=%d ids=%d tracks=%d statuses=%d unknownStatuses=%d targets=%d specRefs=%d dependencies=%d dependsOnUnknown=%d claims=%d claimRunIds=%d\n", sourceBlocks, eligibleMap, inProgressMap, completeMap, blockedMap, tasks, blocks, ids, tracks, statuses, unknownStatuses, targets, specRefs, deps, dependsOnUnknown, claims, claimRunIds);
    if (sourceBlocks != 1 || eligibleMap != 1 || inProgressMap != 1 || completeMap != 1 || blockedMap != 1 || tasks != 4 || blocks != 4 || ids != 4 || tracks != 5 || statuses != 4 || unknownStatuses != 1 || targets != 4 || specRefs != 4 || deps != 4 || dependsOnUnknown != 1 || claims != 4 || claimRunIds != 1) exit 1;
  }
' docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-markdown-source-fixture.md
```

Output:

```text
markdown_probe sourceBlocks=1 maps=1/1/1/1 tasks=4 blocks=4 ids=4 tracks=5 statuses=4 unknownStatuses=1 targets=4 specRefs=4 dependencies=4 dependsOnUnknown=1 claims=4 claimRunIds=1
```

Output hash:

```text
43ec0f294a283e6264ff91cbe34e2e848de9373c8b2cfe7533e40d5dbbadf493  -
```

## Mock driver probe

Command:

```bash
node -e 'const fs=require("fs"); const p="docs/kit-vnext/domains/prov-03-work-source/evidence/2026-06-18-mock-source-fixture.json"; const data=JSON.parse(fs.readFileSync(p,"utf8")); const map=data.statusBuckets; const nativeToBucket=Object.fromEntries(Object.entries(map).flatMap(([bucket, labels])=>labels.map(label=>[label,bucket]))); const tasks=data.tracks.flatMap(t=>t.tasks.map(task=>({trackId:t.trackId,...task}))); const byId=Object.fromEntries(tasks.map(t=>[t.taskId,t])); const mapped=tasks.map(t=>nativeToBucket[t.status.native]||"unknown"); const dependencyUnknown=tasks.filter(t=>t.dependencies.some(d=>(nativeToBucket[byId[d.taskId]?.status.native]||"unknown")==="unknown")).length; const summary={workSourceId:data.workSourceId, tracks:data.tracks.length, tasks:tasks.length, eligible:mapped.filter(b=>b==="eligible").length, blocked:mapped.filter(b=>b==="blocked").length, unknown:mapped.filter(b=>b==="unknown").length, dependencies:tasks.reduce((n,t)=>n+t.dependencies.length,0), dependencyUnknown, mapped, scriptedFailures:tasks.flatMap(t=>t.scriptedFailures).sort()}; console.log(JSON.stringify(summary)); if(summary.tracks!==1||summary.tasks!==4||summary.eligible!==2||summary.blocked!==1||summary.unknown!==1||summary.dependencies!==2||summary.dependencyUnknown!==1||summary.mapped.join(",")!=="eligible,blocked,unknown,eligible"||!summary.scriptedFailures.includes("status-bucket-unknown")||!summary.scriptedFailures.includes("dependency-unknown")) process.exit(1);'
```

Output:

```text
{"workSourceId":"mock-scripted","tracks":1,"tasks":4,"eligible":2,"blocked":1,"unknown":1,"dependencies":2,"dependencyUnknown":1,"mapped":["eligible","blocked","unknown","eligible"],"scriptedFailures":["dependency-unknown","stale-task-view","status-bucket-unknown","status-write-conflict"]}
```

Output hash:

```text
11c0a8cd5f611466bca6f9fadbb2a419d223c4dd8b1346f95cfecf5c0bde42a8  -
```

## Schema snapshot

```ts
type StatusBucket = "eligible" | "inProgress" | "complete" | "blocked" | "unknown";
type StatusBuckets = Record<Exclude<StatusBucket, "unknown">, string[]>;
type WorkSourceCapability =
  | "supportsTracks" | "supportsClaim" | "supportsStatusWrite" | "supportsDependencies";
type TaskKey = { workSourceId: string; trackId: string; taskId: string };
type TaskSnapshot = { task: TaskView; sourcePath: string; sourceRevision: string;
  sourceBytesDigest: string; inlineSpecDigest?: string; rawExcerptDigest: string; createdAt: string };
```

## Evidence limitation

These are design-stage local probes against the proposed Markdown source format and scripted mock
fixture. No existing implementation code was read or changed. When an implementation exists, the same
fixture cases should become executable provider conformance tests against the Markdown driver and mock
driver.
