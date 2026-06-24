export type TelemetryTopic =
  | 'lifecycle'
  | 'capability'
  | 'approval'
  | 'liveness'
  | 'completion'
  | 'recovery'
  | 'provider-evidence'
  | 'storage'
  | 'privacy'
  | 'analysis';

export interface TelemetryTopicEntry {
  readonly topic: TelemetryTopic;
  readonly eventTypeNames: readonly string[];
}

export type TelemetryTopicCatalog = readonly TelemetryTopicEntry[];
