import { describe, expect, it } from 'vitest';

import { checkTerminalAnalysisInvariant } from '../../../../src/core/observability/records/index.js';

import { createEvent, createRecordInput, createReplay, createTerminalEvent, redactedReportRef } from './shared.js';

describe('core-07-s3 terminal analysis invariant', () => {
  it('reports terminal usable replay with no analysis fact as analysis-invariant-missing', () => {
    const result = checkTerminalAnalysisInvariant(createReplay([createTerminalEvent()]));

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-invariant-missing',
    });
  });

  it('does not report corrupt replay as satisfied', () => {
    const result = checkTerminalAnalysisInvariant(createReplay([createTerminalEvent()], 'interior-corrupt'));

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-record-unwritable',
    });
  });

  it('reports satisfied only when an analysis fact exists at or after the terminal sequence', () => {
    const input = createRecordInput();
    const payload = {
      schema: 'kit-vnext.analysis-recorded.v1' as const,
      request: input.request,
      inputHealth: input.inputHealth,
      issues: [],
      metrics: {},
      evidenceRefs: [],
      reportArtifactRef: redactedReportRef,
    };
    const result = checkTerminalAnalysisInvariant(
      createReplay([
        createTerminalEvent(10),
        createEvent({
          eventId: 'analysis:after-terminal',
          sequence: 11,
          type: 'AnalysisRecorded',
          payload,
        }),
      ]),
    );

    expect(result.status).toBe('satisfied');
  });
});
