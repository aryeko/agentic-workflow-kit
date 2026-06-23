export type { ReducedRunLifecycle } from './lifecycle-reducer.js';
export { reduceRunLifecycle } from './lifecycle-reducer.js';
export type { ResolvedSessionLinkage } from './linkage-resolver.js';
export { hasContiguousSessionLinkOrdinals, resolveSessionLinkage } from './linkage-resolver.js';
export type { LifecycleLegalEdge, LifecycleTransitionConstraint } from './transition-table.js';
export {
  LIFECYCLE_LEGAL_EDGE_CATALOG,
  NON_TERMINAL_LIFECYCLE_STATE_SET,
  RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
  TERMINAL_LIFECYCLE_STATE_SET,
} from './transition-table.js';
export { validateLifecycleTransition } from './transition-validator.js';
