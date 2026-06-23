import type { HostFailure, WorkspaceAttachment } from '../../../../src/index.js';

import { hostFailureFixture, workspaceAttachmentFixture } from './shared.js';

export const workspaceMountUnavailableAttachment: WorkspaceAttachment = workspaceAttachmentFixture({
  kind: 'workspace-mount',
  worktreePath: undefined,
  mountRef: 'mount://missing',
});

export const workspaceMountUnavailableFailure: HostFailure = hostFailureFixture('workspace-mount-unavailable');
