import { describe, expect, it } from 'vitest';

import type { CommandKind, ContainmentStrength, HostCapability, HostFailureReason } from '../../../src/index.js';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const describeCapability = (value: HostCapability): string => {
  switch (value) {
    case 'canKill':
    case 'containmentStrength':
    case 'emitsStructuredToolExit':
    case 'egress-confinement':
      return value;
    default:
      return assertNever(value);
  }
};

const describeContainment = (value: ContainmentStrength): string => {
  switch (value) {
    case 'none':
    case 'process-group':
    case 'kernel-tree':
    case 'job-object':
      return value;
    default:
      return assertNever(value);
  }
};

const describeCommandKind = (value: CommandKind): string => {
  switch (value) {
    case 'repo-setup':
    case 'verify':
    case 'diagnostic':
      return value;
    default:
      return assertNever(value);
  }
};

const describeFailureReason = (value: HostFailureReason): string => {
  switch (value) {
    case 'host-capability-unattested':
    case 'workspace-mount-unavailable':
    case 'workspace-cwd-outside-mount':
    case 'credential-injection-rejected':
    case 'egress-confinement-unattested':
    case 'worker-spawn-failed':
    case 'host-observation-incomplete':
    case 'termination-unproven':
    case 'runner-command-capture-incomplete':
    case 'credential-destroy-unconfirmed':
      return value;
    default:
      return assertNever(value);
  }
};

describe('prov-04-s1 host union members', () => {
  it('defines the exact host capability members', () => {
    const values = [
      'canKill',
      'containmentStrength',
      'emitsStructuredToolExit',
      'egress-confinement',
    ] satisfies readonly HostCapability[];

    expect(values.map(describeCapability)).toEqual(values);
  });

  it('defines the exact containment, command, and failure members', () => {
    const containmentValues = [
      'none',
      'process-group',
      'kernel-tree',
      'job-object',
    ] satisfies readonly ContainmentStrength[];
    const commandKinds = ['repo-setup', 'verify', 'diagnostic'] satisfies readonly CommandKind[];
    const failureReasons = [
      'host-capability-unattested',
      'workspace-mount-unavailable',
      'workspace-cwd-outside-mount',
      'credential-injection-rejected',
      'egress-confinement-unattested',
      'worker-spawn-failed',
      'host-observation-incomplete',
      'termination-unproven',
      'runner-command-capture-incomplete',
      'credential-destroy-unconfirmed',
    ] satisfies readonly HostFailureReason[];

    expect(containmentValues.map(describeContainment)).toEqual(containmentValues);
    expect(commandKinds.map(describeCommandKind)).toEqual(commandKinds);
    expect(failureReasons.map(describeFailureReason)).toEqual(failureReasons);
  });
});
