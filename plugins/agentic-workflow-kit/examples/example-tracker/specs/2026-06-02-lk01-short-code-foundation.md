---
title: LK01 — Short-code foundation
status: approved
owner: "—"
last-reviewed: 2026-06-02
related:
  - ../README.md
  - ../../example-prd/08-acceptance-criteria.md
---

# LK01 — Short-code foundation

*The foundation story for Linkly: the short-code generator, the link store, and the endpoint
playbook that every later endpoint story follows. This spec is also the living playbook — LK02
reads it.*

**PRD acceptance criteria:** satisfies `L-1` (an owner can submit a long URL and receive a
unique short code), from [../../example-prd/08-acceptance-criteria.md](../../example-prd/08-acceptance-criteria.md).
The PRD remains the authoritative source of done-ness.

## Goal

Every public Linkly endpoint is built the same way: validate input, call the link store, and
return the shared response envelope. LK01 delivers the store, the code generator, and the
create-link endpoint as the reference implementation, validated by the gate below.

## Non-goals

- The redirect endpoint — that is LK02.
- Click analytics — that is LK03 (`A-1`, a target).
- Custom/vanity codes — deferred; not in the PRD's V1 acceptance criteria.

## Files to create / change

```
src/links/
  store.ts                  ← in-memory link store (create, findByCode)
  short-code.ts             ← collision-resistant code generator
  create-endpoint.ts        ← POST /links: validate, store, return envelope
  __tests__/
    store.test.ts
    short-code.test.ts
    create-endpoint.test.ts
```

**Endpoint playbook (the convention LK02 follows):** every endpoint module validates its input
first and returns the envelope `{ ok: boolean, data?: T, error?: string }`; storage access goes
through `store.ts` only; one test file per module covering the happy path and each validation
failure.

## Validation gate

1. **Fast gate** — the repo's `verify.changed` command passes on touched files.
2. **Full gate** — the repo's `verify.full` command passes.
3. **No regressions** — none (net-new module).
4. **Tracker updated** — LK01 Status flipped to `done` in the tracker matrix in the same PR.

**Playbook-update gate:** the open questions below are resolved (with concrete answers added
here) before LK02 closes.

## Open questions for LK02 to resolve

1. **Code length & alphabet.** LK01 proposes 7 chars, base62. LK02 confirms this survives the
   redirect path or proposes a change here.
2. **Error envelope on not-found.** LK02 decides the exact `error` string for an unknown code
   and records it in the playbook.

## Risks and mitigations

- **Code collisions.** Two links could hash to the same code. **Mitigation:** the store rejects
  a duplicate and the generator retries. **Fallback:** widen the alphabet/length.

## Estimated blast radius

S — under 10 files, well under 500 LoC including tests.

## Related

- [../README.md](../README.md) — the tracker
- [../../example-prd/08-acceptance-criteria.md](../../example-prd/08-acceptance-criteria.md) — the PRD criteria
