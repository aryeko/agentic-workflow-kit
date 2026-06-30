# 03 — Product Skills Inventory (R03-PRODUCT-SKILLS-INVENTORY)

## 1. Summary

The useful product-management references are present as local source material, not as
callable dependencies for this workflow. `/Users/aryekogan/repos/pm-skills` provides a PM
methodology corpus: discovery, strategy, PRD writing, red-team review, metrics, and
ship-readiness workflows. The cached Codex `product-design` plugin provides UX/prototype
workflows, but it is not installed/enabled as a current Codex plugin and should not drive
this product-layer rewrite.

Use these references to shape the review method: start from value proposition and product
strategy, stress-test load-bearing assumptions, keep the PRD thin, and reserve
ship-readiness or visual/prototype methods for later work. Do not import the slash-command
ceremony into the repository product layer.

## 2. Available PM/Product References

- `/Users/aryekogan/repos/pm-skills/README.md` describes a marketplace of 9 PM plugins,
  68 skills, and 42 commands. It also says Codex can read the same plugin marketplace, but
  Codex does not expose the Claude slash commands as first-class slash commands.
- `/Users/aryekogan/repos/pm-skills/CLAUDE.md` is the repo guidance. It frames skills as
  reusable nouns/frameworks and commands as verb workflows, and warns against hard
  cross-plugin command references.
- `/Users/aryekogan/repos/pm-skills/.claude-plugin/marketplace.json` and
  `*/.claude-plugin/plugin.json` define the nine plugin areas: product discovery, product
  strategy, execution, market research, data analytics, marketing/growth, go-to-market,
  toolkit, and AI shipping.
- PM command docs most relevant to this rewrite:
  - `/Users/aryekogan/repos/pm-skills/pm-product-strategy/commands/strategy.md`
  - `/Users/aryekogan/repos/pm-skills/pm-product-strategy/commands/value-proposition.md`
  - `/Users/aryekogan/repos/pm-skills/pm-product-discovery/commands/discover.md`
  - `/Users/aryekogan/repos/pm-skills/pm-product-discovery/commands/brainstorm.md`
  - `/Users/aryekogan/repos/pm-skills/pm-product-discovery/commands/setup-metrics.md`
  - `/Users/aryekogan/repos/pm-skills/pm-execution/commands/write-prd.md`
  - `/Users/aryekogan/repos/pm-skills/pm-execution/commands/red-team-prd.md`
  - `/Users/aryekogan/repos/pm-skills/pm-ai-shipping/commands/ship-check.md`
- Cached Product Design materials exist at
  `/Users/aryekogan/.codex/plugins/cache/openai-curated-remote/product-design/0.1.47`.
  Its README and skill frontmatter center on UX research, product-flow audits, visual
  ideation, prototypes, URL/image-to-code, design QA, and sharing prototypes.

## 3. Useful Frameworks For This Rewrite

- **Value proposition / JTBD framing** from `value-proposition.md`: force the rewrite to
  name who Jig serves, what job they are hiring it for, what current alternative fails,
  and what outcome changes after adoption.
- **Product strategy framing** from `strategy.md`: useful for product boundaries,
  non-goals, tradeoffs, differentiation, and strategic scope control.
- **Discovery and assumption mapping** from `discover.md` and `brainstorm.md`: useful for
  separating product beliefs from design-derived assumptions before committing a new
  product layer.
- **Metrics framing** from `setup-metrics.md`: useful for success signals and
  counter-metrics, especially preventing "more automation" from becoming a bad north star.
- **PRD baseline** from `write-prd.md`: useful as a checklist for executive summary,
  background, objectives, target users, requirements, open questions, and phasing. The
  rewrite should use this lightly, not reproduce a full 10-file PRD ceremony.
- **Red-team review** from `red-team-prd.md`: directly useful for this branch because the
  current problem is not missing content but overconfident, over-detailed content.
- **Ship-check** from `ship-check.md`: useful later as a final review packet pattern, but
  not as the driver of product discovery or product-layer shape.
- **Product Design `audit`/`research` skills**: useful only if a future rewrite needs UX
  evidence for an operator surface. They are not a substitute for product strategy.

## 4. References That Should Not Drive This Rewrite

- `pm-toolkit` is peripheral utility content and should not shape Jig product strategy.
- `pm-data-analytics`, `pm-market-research`, `pm-go-to-market`, and
  `pm-marketing-growth` should be secondary unless the next phase explicitly asks for
  market, GTM, or instrumentation work.
- Product Design prototype skills should not shape the canonical product layer. Their
  value is in later UI exploration and evidence-backed UX audits.
- Claude slash command mechanics should not appear in the product docs. For this repo,
  treat command files as methodological references only.

## 5. Codex Availability Caveats

- `codex plugin list --json` in this environment did not list the `pm-skills` plugin
  family as installed or available.
- The same live plugin list did not list `product-design` as installed/enabled, even
  though cached materials exist under
  `/Users/aryekogan/.codex/plugins/cache/openai-curated-remote/product-design/0.1.47`.
- Because PM skills are not active Codex tools here, this review must not depend on
  invoking `/strategy`, `/write-prd`, `/red-team-prd`, or similar commands. Reading their
  markdown files is sufficient and more stable.
- No plugin installation is needed for this review packet, and installing plugins would be
  outside the requested scope.

## 6. How To Use These References In The Rebuild

Use the PM references as a lightweight sequence:

1. **Value proposition first**: write a one-page Jig product promise around user, job,
   before/after, and alternative.
2. **Strategy second**: lock audience, non-goals, differentiation, and tradeoffs before
   writing requirements.
3. **Thin PRD third**: keep requirements product-visible and behavior-level; avoid
   protocol fields, driver milestones, and exact implementation semantics.
4. **Red-team fourth**: attack load-bearing assumptions, especially the assumption that
   more detailed acceptance criteria create better product clarity.
5. **Ship-readiness last**: once the rewrite exists, use an intent-vs-artifact check to
   confirm the product layer is simple, product-only, and traceable to design without
   being captured by it.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig product layer rebuild review](./README.md) · **← Prev:** [Report 2 — Design-Reference Behaviors for JIG Rebuild](./02-design-reference-behaviors.md) · **Next →:** [04 - Rebuild Recommendation (R04-REBUILD-RECOMMENDATION)](./04-rebuild-recommendation.md)

<!-- /DOCS-NAV -->
