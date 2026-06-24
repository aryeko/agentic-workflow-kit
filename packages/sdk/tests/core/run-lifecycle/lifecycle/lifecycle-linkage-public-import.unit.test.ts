import { describe, expect, it } from 'vitest';
import {
  hasContiguousSessionLinkOrdinals,
  LIFECYCLE_LEGAL_EDGE_CATALOG,
  reduceRunLifecycle,
  resolveSessionLinkage,
  validateLifecycleTransition,
} from '../../../../src/index.js';

describe('core-01-s3 public sdk imports', () => {
  it('imports the lifecycle surface from the sdk source entrypoint barrel', () => {
    expect(typeof validateLifecycleTransition).toBe('function');
    expect(typeof reduceRunLifecycle).toBe('function');
    expect(typeof hasContiguousSessionLinkOrdinals).toBe('function');
    expect(typeof resolveSessionLinkage).toBe('function');
    expect(Array.isArray(LIFECYCLE_LEGAL_EDGE_CATALOG)).toBe(true);
    expect(LIFECYCLE_LEGAL_EDGE_CATALOG.length).toBeGreaterThan(0);
  });
});
