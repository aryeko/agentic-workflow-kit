---
title: Redirect endpoint delta
status: approved
owner: "—"
last-reviewed: 2026-06-02
related:
  - ../../../README.md
  - ../../2026-06-02-lk01-short-code-foundation.md
  - ../../../../example-prd/08-acceptance-criteria.md
---

# Redirect endpoint delta

*The first endpoint built on the LK01 playbook, so it doubles as the pilot — it must confirm or
amend LK01's open questions before LK03 starts.*

**PRD acceptance criteria:** satisfies `L-2` (visiting a short code 301-redirects to the
original URL).

## Story identifier

| ID | Depends on | Blocks | Wave |
| --- | --- | --- | --- |
| LK02 | LK01 | LK03 | W2 |

## Current files

- **Store:** `src/links/store.ts` — consumes `findByCode` (created in LK01).
- **Tests:** net-new; no existing redirect tests.

## Target files

```
src/links/
  redirect-endpoint.ts          ← GET /:code: look up, 301 to the original URL
  __tests__/
    redirect-endpoint.test.ts
```

## Patterns to apply

- **Endpoint playbook (LK01)** — validate the code, call `store.findByCode`, return via the
  shared path. The redirect is a `301` to `data.url` on hit.
- **Unknown-code handling (LK01 open question 2)** — this story decides the exact response and
  promotes the decision into the LK01 playbook.

## Behavioural changes (deliberate)

- A new `GET /:code` route returns `301` with a `Location` header on a known code.

## Behavioural changes (forbidden)

- The create-link endpoint's request/response envelope from LK01 must remain identical.
- `store.ts`'s `findByCode` signature must remain unchanged — LK02 consumes it, it does not
  modify it.
- The short-code alphabet/length fixed in LK01 must not change here (raise it as a playbook
  amendment if needed, in the same PR).

## Gotchas

- **301 vs 302.** The PRD specifies `301` (permanent). Do not use `302` — caches and the PRD
  acceptance check both depend on `301`.
- **Open redirects.** Only redirect to URLs that came through the LK01 create path; never
  reflect an arbitrary client-supplied target.

## Estimated blast radius

S — under 10 files.

## Related

- [../../../README.md](../../../README.md) — the tracker
- [../../2026-06-02-lk01-short-code-foundation.md](../../2026-06-02-lk01-short-code-foundation.md) — the LK01 playbook
