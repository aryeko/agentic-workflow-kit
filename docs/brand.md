# Brand

The agentic-workflow-kit visual identity. The chosen direction is **Rail Contract**; two alternate directions
are preserved under [`assets/branding/`](../assets/branding/) for reference and are not used by the
project surfaces.

## Identity — Rail Contract

The mark is the architecture: two driver nodes feed one shared rail that resolves into a tracker cell —
interactive and autonomous drivers reading one repo-local contract. It reads at favicon size and works
monochrome, which is the point.

**Tagline:** One tracker. Two drivers.

**Positioning:** agentic-workflow-kit turns a repo into a spec-first delivery pipeline by making the tracker and
config the shared source of truth. Interactive Claude Code work and autonomous Codex orchestration follow
the same contract, so teams get repeatable delivery without forking their process every time PR gating or
merge policy changes.

## Logo

All marks live under [`assets/branding/rail-contract/`](../assets/branding/rail-contract/):

| File | Use |
| --- | --- |
| `logo-lockup.svg` | Icon + wordmark (`agentic-workflow-kit`), `currentColor` — inherits theme color in HTML/docs contexts |
| `logo-lockup.png` | Transparent raster render of the lockup (1568x288) |
| `logo-lockup-stacked.svg` | Icon above wordmark, `currentColor` — for square/narrow contexts |
| `logo-icon.svg` | Icon only, `currentColor` |
| `logo-icon-accent.svg` | Icon only, fixed accent `#0B5CAD` — use where theme color is not inherited (e.g. GitHub README, which renders `currentColor` as black) |
| `logo-icon.png` | 1024x1024 transparent raster |
| `favicon.svg` | Simplified small-size mark; export PNGs at 16, 32, 48, 180 (apple-touch), 512 |

Note: GitHub renders an `<img>`-referenced SVG's `currentColor` as black, which disappears on the dark
theme — use the accent or PNG marks in GitHub contexts, and prefer the `currentColor` lockup in contexts
that set a text color (docs sites, app shells).

### Hero banner

The README header uses [`hero-1280x400.png`](../assets/branding/rail-contract/hero-1280x400.png) (header
ratio); [`hero.png`](../assets/branding/rail-contract/hero.png) is the 1280x640 version. Both are
full-dark (`#0B0D10`) with the rail motif weighted right and a uniform dark left zone (verified, so a
near-white headline overlay stays legible). No baked text — overlay any headline in HTML/templating.

## Color

Full tokens: [`assets/branding/rail-contract/tokens.css`](../assets/branding/rail-contract/tokens.css)
and [`tokens.json`](../assets/branding/rail-contract/tokens.json). All text pairings meet WCAG 2.1 AA
(verified: min 4.80:1 light, 8.47:1 dark).

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#FAFAF8` | `#0B0D10` |
| Surface | `#FFFFFF` | `#12161B` |
| Primary text | `#111315` | `#F4F7FA` |
| Accent / link | `#0B5CAD` | `#7CC7FF` |
| Muted text | `#5B626A` | `#A9B2BD` |
| Success / verified | `#2F7D55` | `#79C795` |

## Typography

| Use | Typeface |
| --- | --- |
| Headings | Space Grotesk |
| Body | Inter |
| Monospace | JetBrains Mono |

All open-source (Google Fonts). Use the monospace face for `agentic-workflow-kit`, package names, config keys,
and CLI snippets.

## Social / SEO launch kit

- **GitHub About:** Tracker-driven, spec-first delivery pipeline for Claude Code, Codex, and TypeScript orchestration.
- **Meta title:** agentic-workflow-kit: Spec-first AI delivery pipeline
- **Meta description:** Open-source Claude Code and Codex tooling that turns any repo into a tracker-driven, spec-first delivery pipeline.
- **Topics:** `agentic-workflow-kit` `claude-code` `codex` `ai-assisted-development` `spec-first` `tracker-driven` `developer-tools` `typescript` `nodejs` `pnpm` `vitest` `orchestrator` `cli` `github-workflow` `workflow-automation` `open-source`
- **Launch post:** Launching `agentic-workflow-kit`: an open-source Claude Code + Codex plugin and TypeScript orchestrator for tracker-driven, spec-first delivery. One markdown tracker, one config file, two drivers, no forked repo process theatre.

### Social card

[`assets/branding/rail-contract/og.png`](../assets/branding/rail-contract/og.png) (1200x630, no baked
text). Overlay headline + subhead in HTML/templating, not in the raster:

- Headline `Spec-first delivery, one rail` — Space Grotesk, 56px, 700, line-height 1.02, `#F4F7FA`, at x=96 y=178, max-width 520px.
- Subhead `A tracker-driven contract for Claude Code, Codex, and autonomous TypeScript orchestration.` — Inter, 25px, 500, line-height 1.3, `#A9B2BD`, at x=96 y=322, max-width 500px.

## Caveats

- The Rail Contract `hero.png` has been regenerated full-dark and is in use. The `hero.png` in the
  other two variants (`status-matrix`, `maintainers-ledger`) still has a light-gray left third that
  would swallow a near-white overlay headline — regenerate those full-dark before using them as banners.

## Alternate directions (not in use)

Preserved for reference: `assets/branding/status-matrix/` (bold grid/matrix identity) and
`assets/branding/maintainers-ledger/` (warm editorial OSS identity). Each carries its own logos,
favicon, tokens, and og image.
