export type RunAppendFailureCode =
  | 'stale-writer-fenced'
  | 'sequence-conflict'
  | 'illegal-lifecycle-transition'
  | 'durability-insufficient'
  | 'partial-ack-unknown'
  | 'interior-corrupt'
  | 'event-log-unavailable';
