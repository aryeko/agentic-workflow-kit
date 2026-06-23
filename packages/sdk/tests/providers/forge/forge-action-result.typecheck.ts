import type { ForgeActionResult, ForgeDegraded } from '../../../src/index.js';

import { acceptedActionResultFixture, degradedResultFixture, refusedActionResultFixture } from './fixtures.js';

const accepted = acceptedActionResultFixture satisfies Extract<ForgeActionResult, { kind: 'accepted' }>;
const refused = refusedActionResultFixture satisfies Extract<ForgeActionResult, { kind: 'refused' }>;
const degraded = degradedResultFixture satisfies ForgeDegraded;

const impossibleAccepted: Extract<ForgeActionResult, { kind: 'accepted' }> = {
  ...accepted,
  // @ts-expect-error AC-4 accepted results cannot carry kind degraded.
  kind: 'degraded',
};

void accepted;
void refused;
void degraded;
void impossibleAccepted;
