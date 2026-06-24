# PR Review Rounds

This page captures the follow-up analysis requested after observing that the final two
finding-bearing Codex reviews still contained P1 issues.

Source: live GitHub data for PR #144 fetched from `pulls/144/reviews`, `pulls/144/comments`, and
`issues/144/comments`.

Definitions:

- Round: one submitted review by `chatgpt-codex-connector[bot]`.
- Finding: one inline review comment in that Codex review.
- Severity: parsed from the Codex P-badge in the inline comment.
- Evidence class: observed.

## Summary

| Metric | Value |
|---|---:|
| Finding-bearing Codex review rounds | 46 |
| Inline Codex findings | 91 |
| P0 findings | 0 |
| P1 findings | 29 |
| P2 findings | 59 |
| P3 findings | 3 |
| Unclassified findings | 0 |
| Final Codex no-major-issues issue comment | 1 |

The final Codex issue comment said it did not find major issues on reviewed commit `2c0b260c68` at
`2026-06-24T07:45:09Z`.

## Bucket Trend

| Rounds | Findings | P1 | P2 | P3 |
|---|---:|---:|---:|---:|
| 1-10 | 23 | 8 | 14 | 1 |
| 11-20 | 22 | 9 | 12 | 1 |
| 21-30 | 20 | 6 | 13 | 1 |
| 31-40 | 19 | 4 | 15 | 0 |
| 41-46 | 7 | 2 | 5 | 0 |

Finding volume declined over time: rounds 1-10 averaged 2.3 findings per round; rounds 41-46 averaged
1.17 findings per round.

Severity did not monotonically decline. The final two finding-bearing reviews were both single P1
findings.

## Round Table

| Round | UTC time | Commit | Findings | P1 | P2 | P3 | Highest |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | 2026-06-23 20:30 | `601e0e31eb` | 4 | 2 | 2 | 0 | P1 |
| 2 | 2026-06-23 20:44 | `b27b7435e3` | 3 | 1 | 2 | 0 | P1 |
| 3 | 2026-06-23 21:00 | `e6b0e09359` | 2 | 2 | 0 | 0 | P1 |
| 4 | 2026-06-23 21:11 | `42cea1cb35` | 1 | 0 | 1 | 0 | P2 |
| 5 | 2026-06-23 21:23 | `46fd8e3b14` | 3 | 0 | 2 | 1 | P2 |
| 6 | 2026-06-23 21:34 | `020955a680` | 2 | 0 | 2 | 0 | P2 |
| 7 | 2026-06-23 21:48 | `7bfc444f39` | 1 | 0 | 1 | 0 | P2 |
| 8 | 2026-06-23 21:58 | `2c0ba83914` | 2 | 0 | 2 | 0 | P2 |
| 9 | 2026-06-23 22:16 | `d5ca26c567` | 3 | 1 | 2 | 0 | P1 |
| 10 | 2026-06-23 22:33 | `c0760bf73a` | 2 | 2 | 0 | 0 | P1 |
| 11 | 2026-06-23 22:47 | `15a3fb4295` | 3 | 1 | 2 | 0 | P1 |
| 12 | 2026-06-23 23:01 | `45babc19f4` | 3 | 1 | 2 | 0 | P1 |
| 13 | 2026-06-23 23:17 | `f7b6b09e91` | 1 | 0 | 1 | 0 | P2 |
| 14 | 2026-06-23 23:31 | `00fd364ef5` | 2 | 0 | 2 | 0 | P2 |
| 15 | 2026-06-23 23:42 | `4c14be0856` | 2 | 2 | 0 | 0 | P1 |
| 16 | 2026-06-23 23:57 | `1b9c9b477d` | 2 | 1 | 1 | 0 | P1 |
| 17 | 2026-06-24 00:12 | `678a2d2c8f` | 2 | 1 | 1 | 0 | P1 |
| 18 | 2026-06-24 00:25 | `6f07a89e84` | 3 | 1 | 2 | 0 | P1 |
| 19 | 2026-06-24 00:38 | `4a4d962a3b` | 2 | 2 | 0 | 0 | P1 |
| 20 | 2026-06-24 00:51 | `5befd256d1` | 2 | 0 | 1 | 1 | P2 |
| 21 | 2026-06-24 01:04 | `c23d1ad216` | 2 | 0 | 2 | 0 | P2 |
| 22 | 2026-06-24 01:18 | `d2bc8edf1c` | 2 | 0 | 2 | 0 | P2 |
| 23 | 2026-06-24 01:32 | `88be5fe217` | 2 | 2 | 0 | 0 | P1 |
| 24 | 2026-06-24 01:50 | `184ac45128` | 1 | 0 | 1 | 0 | P2 |
| 25 | 2026-06-24 02:07 | `d5f9ef98cf` | 2 | 2 | 0 | 0 | P1 |
| 26 | 2026-06-24 02:26 | `4a6000503c` | 2 | 1 | 1 | 0 | P1 |
| 27 | 2026-06-24 02:44 | `6953b31e80` | 2 | 0 | 1 | 1 | P2 |
| 28 | 2026-06-24 02:58 | `ee9b0cd019` | 2 | 0 | 2 | 0 | P2 |
| 29 | 2026-06-24 03:13 | `12ac8cdca2` | 3 | 1 | 2 | 0 | P1 |
| 30 | 2026-06-24 03:34 | `bff289ed0a` | 2 | 0 | 2 | 0 | P2 |
| 31 | 2026-06-24 03:49 | `2e5905253f` | 2 | 1 | 1 | 0 | P1 |
| 32 | 2026-06-24 04:03 | `93e8ac2084` | 3 | 0 | 3 | 0 | P2 |
| 33 | 2026-06-24 04:19 | `e56b958b1a` | 2 | 0 | 2 | 0 | P2 |
| 34 | 2026-06-24 04:35 | `a3569d3354` | 3 | 1 | 2 | 0 | P1 |
| 35 | 2026-06-24 04:49 | `d03532f2cb` | 1 | 0 | 1 | 0 | P2 |
| 36 | 2026-06-24 05:06 | `467ce4dd18` | 2 | 1 | 1 | 0 | P1 |
| 37 | 2026-06-24 05:23 | `e6d5a27e55` | 2 | 0 | 2 | 0 | P2 |
| 38 | 2026-06-24 05:37 | `394b615089` | 1 | 0 | 1 | 0 | P2 |
| 39 | 2026-06-24 05:53 | `8ec42f9cf9` | 2 | 1 | 1 | 0 | P1 |
| 40 | 2026-06-24 06:10 | `cb27ba2f79` | 1 | 0 | 1 | 0 | P2 |
| 41 | 2026-06-24 06:28 | `0ff8398fd2` | 1 | 0 | 1 | 0 | P2 |
| 42 | 2026-06-24 06:39 | `e5e3fb36a8` | 2 | 0 | 2 | 0 | P2 |
| 43 | 2026-06-24 06:53 | `070f6ec6dc` | 1 | 0 | 1 | 0 | P2 |
| 44 | 2026-06-24 07:07 | `80112705d7` | 1 | 0 | 1 | 0 | P2 |
| 45 | 2026-06-24 07:17 | `f138e42eb2` | 1 | 1 | 0 | 0 | P1 |
| 46 | 2026-06-24 07:29 | `88df6c8f16` | 1 | 1 | 0 | 0 | P1 |

## Late P1 Detail

The last two finding-bearing Codex rounds were:

- Round 45: P1, `packages/sdk/src/core/capability/evaluator/guarantee-predicates.ts`, "Deny
  unattended-run gates after terminal lifecycle".
- Round 46: P1, `packages/sdk/src/core/observability/records/record-idempotency.ts`, "Preserve current
  analysis heads across cursor advances".

Both were single-finding rounds. That matters because the loop had already reduced volume, but the
remaining findings still touched invariant-level behavior.

## Interpretation

The review loop converged on fewer findings per review. It did not converge monotonically on lower
severity.

This weakens the simple interpretation that "following reviews should make future findings less
significant." It supports a different interpretation: repeated reviews were expanding coverage across
the invariant surface. Once one invariant gap was fixed, the next review could inspect a different
edge of the composed runtime and still find a P1.

The late P1s were not random style findings. They were in two hot invariant zones already present
throughout the loop:

- capability gates and terminal lifecycle denial;
- analysis-record idempotency across cursor movement.

This points to a missing pre-PR integration invariant sweep more than a failure to apply individual
review comments.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 Delivery Retro](./README.md) · **← Prev:** [Spawned Sessions](./02-spawned-sessions.md) · **Next →:** [Cause Analysis and Recommendations](./04-cause-analysis-and-recommendations.md)

<!-- /DOCS-NAV -->
