import type {
  TelemetryTopic,
  TelemetryTopicCatalog,
  TelemetryTopicEntry,
} from '../../../../src/core/observability/telemetry/index.js';

import { assertNever, expectedTelemetryTopics } from './shared.js';

const describeTopic = (value: TelemetryTopic): TelemetryTopic => {
  switch (value) {
    case 'lifecycle':
    case 'capability':
    case 'approval':
    case 'liveness':
    case 'completion':
    case 'recovery':
    case 'provider-evidence':
    case 'storage':
    case 'privacy':
    case 'analysis':
      return value;
    default:
      return assertNever(value);
  }
};

const describedTopics = expectedTelemetryTopics.map((topic) => describeTopic(topic));
const readonlyCatalog: TelemetryTopicCatalog = [];
const readonlyEntry: TelemetryTopicEntry = {
  topic: 'analysis',
  eventTypeNames: ['AnalysisRecorded'],
};

// @ts-expect-error AC-1 TelemetryTopic admits only the 10 design topic labels.
const invalidTopic: TelemetryTopic = 'unknown-topic';

// @ts-expect-error TelemetryTopicCatalog is readonly.
readonlyCatalog.push(readonlyEntry);

// @ts-expect-error TelemetryTopicEntry eventTypeNames is readonly.
readonlyEntry.eventTypeNames.push('AnalysisFailed');

void describedTopics;
void invalidTopic;
void readonlyCatalog;
void readonlyEntry;
