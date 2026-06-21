# T4 — fnd-02 typed contracts · proposal (DRAFT, corpus read-only)

**Task:** Author a proposed typed contract for fnd-02 Storage & Artifacts (`LeaseSnapshot`,
`StorageHealth`, `AppendBatch`, `DurabilityClass`, `ArtifactRef`, `ScratchArtifactRef`, and the
`EventLogStore`/`LeaseStore`/`ArtifactStore` interfaces), so core test fakes stop re-inventing them.

**Draft contract:** [`draft/storage-contracts.md`](./draft/storage-contracts.md) — every type cited to
the fnd-02 README section its prose derives from.

---

## 1. Key finding — the contract already exists; the gap is consolidation + completion

The fnd-02 README **section 5 ("Contracts & interfaces")** already declares most of the AC1 types as a
`ts` block: `DurabilityClass`, `StorageHealth`, the three store interfaces, `LeaseCapability`,
`LeaseSnapshot`, `LogHandle`, `AppendBatch`, `ArtifactRef`, `ScratchArtifactRef`. So this is **not** a
case of "prose-only, never typed." The real drift risk is narrower and concrete:

1. **Referenced-but-untyped supporting types.** Section 5's interfaces reference `StorageError`,
   `ArtifactInput`, `ArtifactStream`, `ExportSelection`, `ExportManifest`, `StoredRecord`,
   `AppendReceipt`, `NonDurableAck` — but section 5 never declares them. They live as prose in §4
   (design), §6 (data), and §8 (failure modes). A fake author has to reconstruct each from prose,
   which is exactly where shapes drift. The draft types all of these **[newly typed]** with citations.

2. **No single importable artifact.** The types are embedded in a 277-line design README mixed with
   prose, mermaid, and DoD checklists. core-01 and core-06 each re-state the names they consume in
   their own `ts` blocks. The draft is the consolidated, citation-annotated surface a fake imports
   from one place.

The draft therefore (a) reproduces the §5-declared types verbatim with prose citations and (b) fills
the untyped gaps, so the whole consumed surface is in one citable file.

---

## 2. AC1 coverage — every type core-01/core-06 consume

| AC1 required type | In draft | fnd-02 README citation | Consumed by |
|---|---|---|---|
| `LeaseSnapshot` | §B | §5 declared; §4 lease record + §6 "name, holder, epoch, token digest, expiry" | core-06 (`leases.runWriter/storyLaunch`) |
| `StorageHealth` | §A | §5 declared; §4 network-degradation + §8 | core-06 (`leases.leaseHealth`); core-01 maps to `RunDegradedHealth` |
| `AppendBatch` | §C | §5 declared; §4 "writes a framed batch ... validates expectedSequence" | core-01 writer (`event-log-writer-and-corruption.md`: "constructs one fnd-02 AppendBatch") |
| `DurabilityClass` | §A | §5 declared; §4 buffered/durable/barrier prose | core-01 (README §5 "Consumed interfaces: ... DurabilityClass") |
| `ArtifactRef` | §E | §5 declared; §4 artifact store + §6 | core-01 (`artifactRefs` ids resolve to `ArtifactRef`); core-07 |
| `ScratchArtifactRef` | §E | §5 declared; §4 network-degradation "only putScratch may return" | degraded-mode producers (core-07/drivers) |
| `EventLogStore` | §C | §5 declared | core-01 (README §5; `replay`/`append`) |
| `LeaseStore` | §D | §5 declared | core-01 (`openWriter`); core-06 (`LeaseStore.read`) |
| `ArtifactStore` | §E | §5 declared; §6 `resolve(id)` | core-01 (`ArtifactStore.resolve`); core-07 |

Supporting types also covered (referenced by the interfaces above): `LeaseCapability`, `LogHandle`,
`AppendReceipt`, `NonDurableAck`, `StoredRecord`, `ArtifactInput`, `ArtifactStream`, `ExportSelection`,
`ExportManifest`, `StorageError`/`StorageErrorCode`.

**AC1: met** — all required types plus their transitive references are typed in the draft, each cited.

---

## 3. AC2 — semantics match the README (citations)

Each type in the draft carries an inline `// §N ...` comment quoting the fnd-02 README prose it derives
from. Summary of the load-bearing matches:

- **`DurabilityClass`** mirrors §4's three-way buffered/durable/barrier fsync contract exactly.
- **`StorageHealth`** is the union of §4 network-degradation states + §8 failure tokens, with `"ok"`
  baseline.
- **`LeaseSnapshot`** is the §4 lease-record JSON minus the secret, narrowed to the §6 consumer
  surface (`name, holder, epoch, tokenDigest, expiresAt`) — see draft note D-1 / AC2 caveat below.
- **`ArtifactRef.redactionState`** includes `"tombstoned"` per §4 post-store redaction; `ScratchArtifactRef`
  cannot be tombstoned and omits `retentionClass` per §4 "barred from ... retention policy".
- **`EventLogStore.append`** returns `AppendReceipt | NonDurableAck | StorageError` per §4 (durable→receipt,
  buffered→NonDurableAck) and §8.

**AC2 caveat (minor, flagged for architect):** §4 says the on-disk lease *record* is
`{ name, epoch, holder, tokenDigest, acquiredAt, expiresAt, recordDigest }`, but §5's `LeaseSnapshot`
and §6's snapshot description both omit `acquiredAt` and `recordDigest`. The draft follows §5/§6 (the
consumer-facing snapshot), not the record. This is the README's own intended split (record vs
snapshot), not a draft invention — noted as **D-1** so an architect can confirm consumers never need
`acquiredAt`.

**AC2: met**, with the D-1 record-vs-snapshot note surfaced rather than silently resolved.

---

## 4. AC3 — lease/health types carry exactly what `RecoveryEvidenceSnapshot.leases` needs

core-06 `recovery-model.md` declares:

```ts
leases: { runWriter?: LeaseSnapshot; storyLaunch?: LeaseSnapshot; leaseHealth: StorageHealth };
```

It consumes **only** `LeaseSnapshot` and `StorageHealth` from fnd-02 — verified by grep across
`core/recovery-and-reconciliation/**` (the sole fnd-02 type tokens there are `LeaseSnapshot`,
`StorageHealth`, and the `LeaseStore` interface name in prose). The draft's `LeaseSnapshot` provides
exactly the fields core-06's classifier reads — `name`, `epoch`, `holder`, `tokenDigest`, `expiresAt`
— no extra fields (no live `token` secret, no record-internal `acquiredAt`/`recordDigest`) and none
missing. `StorageHealth` supplies `leaseHealth`, which drives recovery rule 3 (`lease-unavailable`).
The draft restates this binding in §G.

**AC3: met** — `LeaseSnapshot` is neither wider nor narrower than the `leases` sub-shape requires.

---

## 5. AC4 — drift check (each place a core domain re-states a fnd-02 shape inline)

Grep across `docs/design/30-domain-reference/core/**`, `10-architecture/**`, `20-sdk-and-packaging/**`.
No core domain *redefines* the fnd-02 structural bodies — but several **re-name** fnd-02 types in their
own `ts`/prose blocks, and one mints a parallel-but-narrower enum. These are the drift sites a shared
typed contract removes:

| # | File + section | Shape re-stated | Nature of drift |
|---|---|---|---|
| 1 | `core/run-lifecycle-and-state/contracts.md` §"Contracts" (L13) | `RunDurabilityClass = "durable" \| "barrier"` | **Narrowed parallel enum** of fnd-02 `DurabilityClass` (drops `"buffered"`). Intentional (core-01 README §5; event-log-writer.md §"Durability classes"), but the relationship is prose-only — a fake must know it's a subtype. |
| 2 | `core/run-lifecycle-and-state/contracts.md` §"Contracts" (L17) | `RunDegradedHealth = "ok" \| "tail-repaired" \| "interior-corrupt" \| "event-log-unavailable"` | **Re-spelled `StorageHealth`.** Different token strings (`tail-repaired` vs `log-tail-repaired`; collapses `network-fs-degraded`/`read-only`/`unusable` → `event-log-unavailable`). A mapping table, not a shared type — high drift risk if either side adds a state. |
| 3 | `core/run-lifecycle-and-state/contracts.md` (L99, L103–104) | `LeaseCapability`, `AppendBatch` (via prose), `AppendReceipt` (via prose) referenced by `RunEventLog`/`RunWriter` | Names imported but the **structural definition lives only in fnd-02 §5** — no import statement exists; a fake re-derives the body. |
| 4 | `core/run-lifecycle-and-state/event-log-writer-and-corruption.md` §"Append protocol"/§"Durability classes" | `AppendBatch`, `AppendReceipt`, `NonDurableAck`, `LeaseCapability` in prose | Same names used in prose flow; bodies never restated, so a fake builds them from fnd-02 prose (the exact drift T4 targets). |
| 5 | `core/recovery-and-reconciliation/recovery-model.md` §"Classifier types" (L35) | `LeaseSnapshot`, `StorageHealth` inline in `RecoveryEvidenceSnapshot.leases` | Names used as if imported; no shared source — a fake re-types `LeaseSnapshot` to build the snapshot. |
| 6 | `core/observability-and-analysis/analysis-contract.md` (L74, 88, 95, 100, 129, 138) | `ArtifactRef` used in 6 record/result types | Names `ArtifactRef` repeatedly with no import source; structural body assumed from fnd-02 §5. |
| 7 | `20-sdk-and-packaging/sdk-boundary.md` (L25, 83–85) + `concrete-providers.md` (L25–26) | `EventLogStorePort`, `ArtifactStorePort`, `LeaseStorePort` | **Re-named with `Port` suffix.** SDK owns the port interfaces; fnd-02 owns `EventLogStore`/`LeaseStore`/`ArtifactStore`. Naming relationship is prose-only — see open issue O-2. |

**Worst offenders:** #2 (`RunDegradedHealth` token re-spelling — true value drift hazard) and the cluster
#3/#4/#5/#6 (names used as if imported with no canonical importable source). The draft is that source.

**AC4: met** — every inline re-statement/re-name site is listed with file+section and drift nature.

---

## 6. AC5 — corpus impact (paths only; NO corpus file edited)

**Where the new file would live.** The cleanest home, given the SDK already owns the *port* interfaces
(`sdk-boundary.md`), is a single canonical typed contract that fnd-02's deep spec and the SDK both
point at. Two viable placements:

- **Option A (recommended) — canonical types in the SDK section, fnd-02 stays the deep spec.**
  New file: `docs/design/20-sdk-and-packaging/storage-port-types.md`, holding the draft's type bodies
  as the importable surface (`EventLogStorePort`/`ArtifactStorePort`/`LeaseStorePort` plus the data
  types). This matches the existing SDK ownership of storage *ports* (`sdk-boundary.md` L25) and the
  T3 hoist pattern (provider port type-detail → SDK section). fnd-02 §5 then references it as the
  source of structural truth rather than re-declaring.

- **Option B — keep the bodies in fnd-02, add the missing types there.**
  Extend `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` §5 with the
  **[newly typed]** supporting types (`StorageError`, `ArtifactInput`, `ArtifactStream`,
  `ExportSelection`, `ExportManifest`, `StoredRecord`, `AppendReceipt`, `NonDurableAck`). Lower churn,
  but leaves the SDK/core naming split unresolved and the file long.

**`docs/**` sections that would later be amended (paths only — not edited here):**

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` §5 — add the 8 missing
  supporting types (Option B) **or** add a "source of truth: SDK storage-port-types" pointer (Option A).
- `docs/design/20-sdk-and-packaging/sdk-boundary.md` §"Storage port interfaces" — state explicitly that
  `EventLogStorePort` ≡ fnd-02 `EventLogStore` (port = the same interface; resolves drift #7).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — add a one-line note that
  `RunDurabilityClass` ⊂ `DurabilityClass` and `RunDegradedHealth` is a re-spelling/mapping of
  `StorageHealth` (resolves drift #1, #2 by making the relationship explicit, not by changing tokens).
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md` §"Classifier
  types" — point `LeaseSnapshot`/`StorageHealth` at the canonical file (resolves drift #5).

**AC5: met** — placement options + amend list are given as paths only. No corpus file was created,
edited, moved, or deleted (verification below).

---

## 7. Open issues / assumptions / risk

- **O-1 (architect ruling) — placement Option A vs B.** Recommend A (SDK canonical types, consistent
  with port ownership + the T3 hoist). B is lower-churn but leaves the naming split. Needs an owner call.
- **O-2 (architect ruling) — `*Store` vs `*StorePort` naming.** fnd-02 §5 says `EventLogStore`; SDK
  says `EventLogStorePort`. Assumed identical interfaces, different file homes. If they are meant to
  diverge (e.g. the port narrows the store), the draft's interface bodies need a port/store split.
- **D-1 (confirm) — lease record vs snapshot fields.** Draft follows §5/§6's snapshot surface (omits
  `acquiredAt`/`recordDigest`). Confirm no consumer needs the record-internal fields.
- **Assumption — `ArtifactInput`/`ArtifactStream`/`ExportSelection` field layouts.** §4 names the
  *metadata fields* (mediaType, size, retentionClass, classification, redactionState, producer,
  creationTime) authoritatively, but not the *input* DTO field names. The draft's input/stream/export
  field *names* are inferred from the §4 prose flow; the field *set* is README-grounded. Flagged as the
  one place names (not semantics) are proposed rather than quoted.
- **Risk — none structural.** Because §5 already declares the core enums/interfaces, the draft adds no
  conflicting shapes; the only authored content is the 8 prose-only supporting types and the
  consolidation. Drift sites #1/#2 are *intentional* narrowings, so the fix is documentation
  (relationship notes), not retyping.

---

## 8. Acceptance criteria — restated with where/how met

1. **Every consumed type typed (incl. the named minimums + the 3 interfaces).** ✅ Met — draft §A–§E;
   coverage table in §2 above. All 7 named types + 3 interfaces + transitive references typed and cited.
2. **Each type matches README prose, cited.** ✅ Met — every draft type has an inline `// §N` citation;
   §3 summarizes. One flagged caveat (D-1, record vs snapshot) surfaced, not silently resolved.
3. **Lease/health types carry exactly `RecoveryEvidenceSnapshot.leases`'s fields.** ✅ Met — §4 above;
   draft §G. `LeaseSnapshot` = `{name, epoch, holder, tokenDigest, expiresAt}`, exactly what core-06
   reads; `StorageHealth` supplies `leaseHealth`; no extra/missing fields.
4. **Drift check listing each inline re-invention site.** ✅ Met — §5 table, 7 sites with
   file+section+drift nature; worst offenders called out.
5. **Lists where the new file lives + no corpus edit.** ✅ Met — §6 (placement A/B + amend paths);
   verification in §9. No `docs/**` file touched.

---

## 9. Verification — no corpus file touched

`git status --porcelain docs/` was run from the worktree root after authoring; it returned **empty**
(no changes under `docs/`). All authored output is under
`design-closure/outputs/wave-1/T4-fnd02-contracts/` only.
