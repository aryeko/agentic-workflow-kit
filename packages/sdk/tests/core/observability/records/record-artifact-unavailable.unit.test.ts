import { describe, expect, it } from 'vitest';

import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';

import {
  createArtifactStore,
  createRecordInput,
  createWriter,
  onlyPayload,
  reportArtifactInput,
  storageError,
} from './shared.js';

describe('core-07-s3 artifact unavailable failure', () => {
  it('records AnalysisFailed with analysis-artifact-unavailable when ArtifactStore.put fails', async () => {
    const writer = createWriter();
    const result = await recordAnalysisOutcome(createRecordInput(), writer, {
      artifactStore: createArtifactStore(storageError),
      reportArtifact: reportArtifactInput,
    });

    expect(result.ok).toBe(true);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.[0]?.type).toBe('AnalysisFailed');

    const payload = onlyPayload(writer);
    expect(payload.schema).toBe('kit-vnext.analysis-failed.v1');
    if (payload.schema !== 'kit-vnext.analysis-failed.v1') {
      throw new Error('expected failed payload');
    }
    expect(payload.reason).toBe('analysis-artifact-unavailable');
  });
});
