export interface AgentToolOutputInput {
  readonly runId: string;
  readonly toolObservationId: string;
  readonly stream: 'stdout' | 'stderr' | 'combined';
  readonly bytes: string;
  readonly redactionSetId: string;
  readonly contentEncoding: 'utf8' | 'base64';
}

export interface AgentToolOutputResult {
  readonly outputRef: string;
  readonly digest: string;
  readonly redactionApplied: true;
}

export interface AgentOutputSink {
  putToolOutput(input: AgentToolOutputInput): AgentToolOutputResult;
}
